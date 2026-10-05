import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';
import { IPlaceRepository, PlaceRow } from './interfaces/place-repository.interface';
import { IEmbeddingService } from './interfaces/embedding-service.interface';
import { GeoJsonService } from '../geo/services/geojson.service';
import { GeoJsonFeatureCollection, PlaceGeoInput } from '../geo/interfaces/geo.interface';
import { NominatimService } from './services/nominatim.service';
import { SearchPlacesDto } from './dto/search-places.dto';
import { NearbyPlacesDto } from './dto/nearby-places.dto';
import { SemanticSearchDto, SyncEmbeddingsDto } from './dto/semantic-search.dto';
import {
  PaginatedPlacesResponseDto,
  PlaceDetailDto,
  PlaceItemDto,
  CategoryItemDto,
  TravelAreaItemDto,
} from './dto/place-response.dto';
import { BudgetLevel } from '@prisma/client';
import { detectSearchIntent } from '../../common/utils/string.util';
import { checkIsOpenNow } from '../../common/utils/opening-hours.util';

/** Max rows scanned when filtering by openNow in memory (see ponytail note in searchPlaces). */
const OPEN_NOW_SCAN_LIMIT = 500;

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    @Inject(INJECT_TOKENS.PLACE_REPOSITORY)
    private readonly placeRepo: IPlaceRepository,
    @Inject(INJECT_TOKENS.EMBEDDING_SERVICE)
    private readonly embeddingService: IEmbeddingService,
    private readonly geoJsonService: GeoJsonService,
    private readonly nominatim: NominatimService,
  ) {}

  /**
   * Unified search with 3-tier fallback:
   * 1. Coordinates → reverse-geocode → single PIN (items=[])
   * 2. Address     → Nominatim geocode → single PIN (items=[])
   * 3. Keyword     → DB keyword search → NLP semantic fallback
   *
   * Matches Google Maps: coordinates/address show a single pin.
   * Frontend adds a "Tìm quanh đây" button for user-initiated nearby search.
   */
  async searchPlaces(dto: SearchPlacesDto): Promise<PaginatedPlacesResponseDto> {
    const keyword = dto.keyword?.trim() ?? '';
    const intent = keyword ? detectSearchIntent(keyword) : 'keyword';
    const page = dto.page || 1;
    const limit = dto.limit || 20;

    // ── Tier 1: Coordinates → PIN only ───────────────────────────────────────
    if (intent === 'coordinates') {
      const [latStr, lngStr] = keyword.split(/[,\s]+/);
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      const displayName = await this.nominatim.reverseGeocode(lat, lng);
      return {
        items: [],
        meta: { totalItems: 0, page: 1, limit, totalPages: 0 },
        geocoded: { lat, lng, displayName: displayName ?? keyword },
      };
    }

    // ── Tier 2 & 3: DB keyword search first ──────────────────────────────────
    // ponytail: opening_hours is free-form text/JSON, so openNow is evaluated in memory over at most
    // OPEN_NOW_SCAN_LIMIT rows, then paginated here. Ceiling: rows beyond the limit are never considered.
    // Upgrade: normalize opening_hours into a table and filter in SQL.
    const openNowOnly = dto.openNow === true;
    const { items: rawItems, total: dbTotal } = await this.placeRepo.searchPlaces(
      openNowOnly ? { ...dto, page: 1, limit: OPEN_NOW_SCAN_LIMIT } : dto,
    );

    let items: PlaceItemDto[] = rawItems.map((row) => this.mapToPlaceItemDto(row));
    let total = dbTotal;
    if (openNowOnly) {
      items = items.filter((item) => item.isOpenNow === true);
      total = items.length;
      items = items.slice((page - 1) * limit, page * limit);
    }

    if (items.length > 0 || (openNowOnly && total > 0)) {
      const totalItems = total;
      return {
        items,
        meta: { totalItems, page, limit, totalPages: Math.ceil(totalItems / limit) || 1 },
      };
    }

    // ── Nothing in DB ────────────────────────────────────────────────────────
    if (intent === 'address' && keyword) {
      // Address → PIN only, matches Google Maps behavior
      const geocoded = await this.nominatim.geocode(keyword);
      if (geocoded) {
        return {
          items: [],
          meta: { totalItems: 0, page: 1, limit, totalPages: 0 },
          geocoded,
        };
      }
      // Geocode failed → fall through to NLP
    }

    // ── Tier 3: NLP semantic fallback ────────────────────────────────────────
    if (keyword) {
      this.logger.log(`Keyword "${keyword}" not found in DB — falling back to semantic search`);
      const semantic = await this.searchSemantic({
        query: keyword,
        areaId: dto.areaId,
        limit,
        minSimilarity: 0.25,
      });
      return {
        items: semantic,
        meta: { totalItems: semantic.length, page: 1, limit, totalPages: 1 },
        isFallback: true,
      };
    }

    return { items: [], meta: { totalItems: 0, page, limit, totalPages: 0 } };
  }

  /**
   * Search places and return RFC 7946 compliant GeoJSON FeatureCollection.
   */
  async searchPlacesGeoJson(dto: SearchPlacesDto): Promise<GeoJsonFeatureCollection> {
    const limit = dto.limit ?? 100;
    const { items: rawItems, total } = await this.placeRepo.searchPlaces({
      ...dto,
      limit,
    });

    const geoInputs: PlaceGeoInput[] = rawItems.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      addressNormalized: row.address_normalized || row.address,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      ratingAvg: row.rating_avg ? Number(row.rating_avg) : null,
      reviewCount: row.review_count ? Number(row.review_count) : null,
      priceLevel: row.price_level || null,
      category: row.category_id
        ? { id: row.category_id, name: row.category_name_vi || row.category_name || '' }
        : null,
      area: row.area_id
        ? { id: row.area_id, name: row.area_name_vi || row.area_name || '' }
        : null,
      distanceMeters:
        row.distance_meters !== null && row.distance_meters !== undefined
          ? Math.round(Number(row.distance_meters))
          : null,
    }));

    return this.geoJsonService.buildFeatureCollection(geoInputs, {
      total,
      count: geoInputs.length,
      page: dto.page || 1,
    });
  }

  /**
   * Find nearby places using GPS coordinates.
   */
  async getNearbyPlaces(dto: NearbyPlacesDto): Promise<PlaceItemDto[]> {
    const rawItems = await this.placeRepo.findNearby(dto);
    return rawItems.map((row) => this.mapToPlaceItemDto(row));
  }

  /**
   * Natural language semantic search using Gemini Vector Embeddings & pgvector.
   */
  async searchSemantic(dto: SemanticSearchDto): Promise<PlaceItemDto[]> {
    this.logger.log(`Generating embedding for semantic query: "${dto.query}"`);
    const vector = await this.embeddingService.generateEmbedding(dto.query);

    const rawItems = await this.placeRepo.searchSemantic(
      vector,
      dto.limit || 10,
      dto.areaId,
      dto.minSimilarity || 0.3,
    );

    return rawItems.map((row) => {
      const dtoItem = this.mapToPlaceItemDto(row);
      dtoItem.similarityScore = Number(row.similarity_score) || null;
      return dtoItem;
    });
  }

  /**
   * Generates and stores vector embeddings for places without embeddings.
   */
  async syncEmbeddings(
    dto: SyncEmbeddingsDto,
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    const limit = dto.limit || 50;
    const places = await this.placeRepo.findPlacesWithoutEmbedding(limit, dto.areaId);

    this.logger.log(`Syncing vector embeddings for ${places.length} places...`);
    let succeeded = 0;
    let failed = 0;

    for (const place of places) {
      try {
        const categoryName = place.category?.nameVi || place.category?.name || '';
        const areaName = place.area?.nameVi || place.area?.name || '';
        const address = place.addressNormalized || place.address || '';
        const tags = Array.isArray(place.tags) && place.tags.length > 0 ? `Đặc trưng: ${place.tags.join(', ')}.` : '';
        const desc = place.description ? `Mô tả: ${place.description}.` : '';
        const areaPart = areaName ? `Khu vực: ${areaName}.` : '';
        const contentText = `${place.name}. Danh mục: ${categoryName}. Địa chỉ: ${address}. ${areaPart} ${desc} ${tags}`.trim().replace(/\s+/g, ' ');

        const vector = await this.embeddingService.generateEmbedding(contentText);
        await this.placeRepo.upsertPlaceEmbedding(
          place.id,
          contentText,
          vector,
          this.embeddingService.getModelName(),
        );
        succeeded++;
      } catch (err) {
        failed++;
        this.logger.warn(
          `Failed to sync embedding for place "${place.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      processed: places.length,
      succeeded,
      failed,
    };
  }

  /**
   * Retrieve full details of a place by its UUID.
   */
  async getPlaceById(id: string): Promise<PlaceDetailDto> {
    const place = await this.placeRepo.findById(id);
    if (!place) {
      throw new NotFoundException(`Place with ID "${id}" not found`);
    }

    const baseDto = this.mapToPlaceItemDto({
      id: place.id,
      name: place.name,
      description: place.description,
      address: place.address,
      address_normalized: place.addressNormalized,
      district: null,
      city: place.area?.nameVi || place.area?.name || null,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      price_level: place.priceLevel,
      opening_hours: place.openingHours,
      phone: place.phone,
      website: place.website,
      rating_avg: Number(place.ratingAvg),
      review_count: place.reviewCount,
      image_count: place.imageCount,
      category_id: place.category?.id,
      category_name: place.category?.name,
      category_name_vi: place.category?.nameVi,
      category_slug: place.category?.slug,
      category_icon_url: place.category?.iconUrl,
      area_id: place.area?.id,
      area_name: place.area?.name,
      area_name_vi: place.area?.nameVi,
      area_slug: place.area?.slug,
      primary_image: place.images?.[0]?.imageUrl || null,
      distance_meters: null,
    });

    return {
      ...baseDto,
      priceRange: place.priceRange as Record<string, unknown> | null,
      tags: place.tags || [],
      attributes: (place.attributes as Record<string, unknown>) || {},
      images: (place.images || []).map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        thumbnailUrl: img.thumbnailUrl,
        isPrimary: img.isPrimary,
        caption: img.caption,
      })),
      sources: (place.sources || []).map((src) => ({
        provider: src.provider,
        externalUrl: src.externalUrl,
        sourceRating: src.sourceRating,
        sourceReviewCount: src.sourceReviewCount,
      })),
    };
  }

  /**
   * List all categories for the frontend filter form.
   */
  async getCategories(): Promise<CategoryItemDto[]> {
    const categories = await this.placeRepo.findCategories();
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      nameVi: cat.nameVi,
      slug: cat.slug,
      iconUrl: cat.iconUrl,
      sortOrder: cat.sortOrder,
      placeCount: cat._count?.places || 0,
    }));
  }

  /**
   * List all active travel areas.
   */
  async getTravelAreas(): Promise<TravelAreaItemDto[]> {
    const areas = await this.placeRepo.findTravelAreas();
    return areas.map((area) => {
      const sortedHubs = [...(area.transitHubs || [])].sort((a, b) => {
        const order: Record<string, number> = { AIRPORT: 1, BUS_TERMINAL: 2, TRAIN_STATION: 3 };
        return (order[a.hubType] ?? 99) - (order[b.hubType] ?? 99);
      });
      const primaryHub = sortedHubs[0];
      const lat =
        primaryHub?.latitude ??
        (area.bboxMinLat !== null && area.bboxMaxLat !== null
          ? (area.bboxMinLat + area.bboxMaxLat) / 2
          : null);
      const lng =
        primaryHub?.longitude ??
        (area.bboxMinLng !== null && area.bboxMaxLng !== null
          ? (area.bboxMinLng + area.bboxMaxLng) / 2
          : null);
      const hubBadge = primaryHub
        ? primaryHub.hubType === 'AIRPORT'
          ? `${primaryHub.name} (${primaryHub.id})`
          : primaryHub.name
        : area.nameVi || area.name;

      return {
        id: area.id,
        name: area.name,
        nameVi: area.nameVi,
        slug: area.slug,
        type: area.type,
        bbox: {
          minLat: area.bboxMinLat,
          maxLat: area.bboxMaxLat,
          minLng: area.bboxMinLng,
          maxLng: area.bboxMaxLng,
        },
        latitude: lat,
        longitude: lng,
        hubBadge,
      };
    });
  }

  /**
   * Private helper to map raw SQL or Prisma row to PlaceItemDto.
   */
  private mapToPlaceItemDto(row: PlaceRow): PlaceItemDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description || null,
      address: row.address,
      district: row.district || null,
      city: row.city || null,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      distanceMeters:
        row.distance_meters !== null && row.distance_meters !== undefined
          ? Math.round(Number(row.distance_meters))
          : null,
      ratingAvg: Number(row.rating_avg) || 0,
      reviewCount: Number(row.review_count) || 0,
      imageCount: Number(row.image_count) || 0,
      priceLevel: (row.price_level as BudgetLevel) || null,
      phone: row.phone || null,
      website: row.website || null,
      openingHours: (row.opening_hours as Record<string, unknown>) || null,
      isOpenNow: checkIsOpenNow(row.opening_hours),
      primaryImage: row.primary_image || null,
      similarityScore:
        row.similarity_score !== null && row.similarity_score !== undefined
          ? Number(row.similarity_score)
          : null,
      category: row.category_id
        ? {
            id: row.category_id,
            name: row.category_name as string,
            nameVi: row.category_name_vi as string,
            slug: row.category_slug as string,
            iconUrl: row.category_icon_url ?? null,
          }
        : null,
      area: row.area_id
        ? {
            id: row.area_id,
            name: row.area_name as string,
            nameVi: row.area_name_vi as string,
            slug: row.area_slug as string,
          }
        : null,
    };
  }
}

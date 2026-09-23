import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';
import { IPlaceRepository } from './interfaces/place-repository.interface';
import { IEmbeddingService } from './interfaces/embedding-service.interface';
import { GeoJsonService } from '../geo/services/geojson.service';
import { GeoJsonFeatureCollection, PlaceGeoInput } from '../geo/interfaces/geo.interface';
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

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    @Inject(INJECT_TOKENS.PLACE_REPOSITORY)
    private readonly placeRepo: IPlaceRepository,
    @Inject(INJECT_TOKENS.EMBEDDING_SERVICE)
    private readonly embeddingService: IEmbeddingService,
    private readonly geoJsonService: GeoJsonService,
  ) {}

  /**
   * Search places using multi-criteria filter form.
   */
  async searchPlaces(dto: SearchPlacesDto): Promise<PaginatedPlacesResponseDto> {
    const { items: rawItems, total } = await this.placeRepo.searchPlaces(dto);

    let items: PlaceItemDto[] = rawItems.map((row) => this.mapToPlaceItemDto(row));

    // If openNow filter was requested, filter in-memory for places with opening hours data
    if (dto.openNow === true) {
      items = items.filter((item) => item.isOpenNow === true);
    }

    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const totalItems = dto.openNow === true ? items.length : total;
    const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

    return {
      items,
      meta: {
        totalItems,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Search places and return RFC 7946 compliant GeoJSON FeatureCollection.
   */
  async searchPlacesGeoJson(dto: SearchPlacesDto): Promise<GeoJsonFeatureCollection> {
    const limit = dto.limit ? Math.min(dto.limit, 500) : 100;
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
        ? { id: row.category_id, name: row.category_name_vi || row.category_name }
        : null,
      area: row.area_id
        ? { id: row.area_id, name: row.area_name_vi || row.area_name }
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
      } catch (err: any) {
        failed++;
        this.logger.warn(`Failed to sync embedding for place "${place.name}": ${err.message}`);
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
      ...place,
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
      images: (place.images || []).map((img: any) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        thumbnailUrl: img.thumbnailUrl,
        isPrimary: img.isPrimary,
        caption: img.caption,
      })),
      sources: (place.sources || []).map((src: any) => ({
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
    return areas.map((area) => ({
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
    }));
  }

  /**
   * Helper to evaluate whether a place is currently open based on opening_hours.
   */
  checkIsOpenNow(openingHours: any): boolean | null {
    if (!openingHours) return null;

    if (typeof openingHours === 'string') {
      const trimmed = openingHours.trim().toLowerCase();
      if (trimmed === '24/7') return true;

      const simpleMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
      if (simpleMatch) {
        const now = new Date();
        // Vietnam timezone UTC+7
        const vnHours = (now.getUTCHours() + 7) % 24;
        const currentMinutes = vnHours * 60 + now.getUTCMinutes();
        const startMinutes = parseInt(simpleMatch[1], 10) * 60 + parseInt(simpleMatch[2], 10);
        const endMinutes = parseInt(simpleMatch[3], 10) * 60 + parseInt(simpleMatch[4], 10);

        if (endMinutes >= startMinutes) {
          return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } else {
          // Overnight window (e.g., 18:00 - 02:00)
          return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }
      }
      return null;
    }

    if (typeof openingHours === 'object') {
      if ('openNow' in openingHours && typeof openingHours.openNow === 'boolean') {
        return openingHours.openNow;
      }
      if ('is_open' in openingHours && typeof openingHours.is_open === 'boolean') {
        return openingHours.is_open;
      }
    }

    return null;
  }

  /**
   * Private helper to map raw SQL or Prisma row to PlaceItemDto.
   */
  private mapToPlaceItemDto(row: any): PlaceItemDto {
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
      priceLevel: row.price_level || null,
      phone: row.phone || null,
      website: row.website || null,
      openingHours: (row.opening_hours as Record<string, unknown>) || null,
      isOpenNow: this.checkIsOpenNow(row.opening_hours),
      primaryImage: row.primary_image || null,
      similarityScore:
        row.similarity_score !== null && row.similarity_score !== undefined
          ? Number(row.similarity_score)
          : null,
      category: row.category_id
        ? {
            id: row.category_id,
            name: row.category_name,
            nameVi: row.category_name_vi,
            slug: row.category_slug,
            iconUrl: row.category_icon_url,
          }
        : null,
      area: row.area_id
        ? {
            id: row.area_id,
            name: row.area_name,
            nameVi: row.area_name_vi,
            slug: row.area_slug,
          }
        : null,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  IPlaceRepository,
  PlaceSearchResult,
  PlaceRow,
  PlaceDetail,
  CategoryWithCount,
  TravelAreaRow,
  PlaceForEmbedding,
} from './interfaces/place-repository.interface';
import { AMENITY_FILTERS, AMENITY_ALIASES } from './amenity-filters';
import { SearchPlacesDto } from './dto/search-places.dto';
import { NearbyPlacesDto } from './dto/nearby-places.dto';
import { PlaceSortBy, SortOrder } from '../../common/enums/places.enum';

/** Columns shared by every place listing query. district/city come from the area and its parent. */
const PLACE_COLUMNS = `
        p.id,
        p.name,
        p.description,
        p.address,
        p.address_normalized,
        CASE WHEN a.type::text = 'DISTRICT' THEN a.name END AS district,
        COALESCE(pa.name, a.name) AS city,
        p.latitude,
        p.longitude,
        p.price_level,
        p.opening_hours,
        p.phone,
        p.website,
        p.rating_avg,
        p.review_count,
        p.image_count,
        c.id AS category_id,
        c.name AS category_name,
        c.name_vi AS category_name_vi,
        c.slug AS category_slug,
        c.icon_url AS category_icon_url,
        a.id AS area_id,
        a.name AS area_name,
        a.name_vi AS area_name_vi,
        a.slug AS area_slug,
        (
          SELECT pi.image_url FROM place_images pi
          WHERE pi.place_id = p.id
          ORDER BY pi.is_primary DESC, pi.display_order ASC, pi.created_at ASC
          LIMIT 1
        ) AS primary_image`;

const PLACE_JOINS = `
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN travel_areas a ON p.area_id = a.id
      LEFT JOIN travel_areas pa ON a.parent_id = pa.id`;

@Injectable()
export class PlacesRepository implements IPlaceRepository {
  private readonly logger = new Logger(PlacesRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async searchPlaces(filters: SearchPlacesDto): Promise<PlaceSearchResult> {
    const {
      keyword,
      areaId,
      categorySlugs,
      amenities,
      lat,
      lng,
      radiusMeters,
      budgetLevels,
      minRating,
      sortBy = PlaceSortBy.DISTANCE,
      sortOrder = SortOrder.DESC,
      page = 1,
      limit = 20,
    } = filters;

    const hasLocation = lat !== undefined && lng !== undefined;
    const conditions: string[] = ["p.status = 'ACTIVE'", 'p.deleted_at IS NULL'];
    const args: unknown[] = [];
    let paramIdx = 1;

    // Optional GPS location parameters
    let locLngIdx: number | null = null;
    let locLatIdx: number | null = null;
    if (hasLocation) {
      locLngIdx = paramIdx++;
      locLatIdx = paramIdx++;
      args.push(lng, lat);
    }

    // Filter by Travel Area
    if (areaId !== undefined) {
      conditions.push(`p.area_id = $${paramIdx++}`);
      args.push(areaId);
    }

    // Filter by Categories (by slug)
    if (categorySlugs && categorySlugs.length > 0) {
      const placeholders = categorySlugs.map(() => `$${paramIdx++}`).join(', ');
      conditions.push(`c.slug IN (${placeholders})`);
      args.push(...categorySlugs);
    }

    // Filter by Contextual Amenities / Tags
    if (amenities && amenities.length > 0) {
      for (const a of amenities) {
        const slug = a.trim().toLowerCase();
        if (!slug) continue;
        const predicate = AMENITY_FILTERS[AMENITY_ALIASES[slug] ?? slug];
        if (predicate) {
          conditions.push(predicate);
        } else {
          const tagIdx = paramIdx++;
          conditions.push(`($${tagIdx} = ANY(p.tags) OR p.description ILIKE '%' || $${tagIdx} || '%')`);
          args.push(slug);
        }
      }
    }

    // Filter by Budget Levels
    if (budgetLevels && budgetLevels.length > 0) {
      const placeholders = budgetLevels.map(() => `$${paramIdx++}`).join(', ');
      conditions.push(`p.price_level::text IN (${placeholders})`);
      args.push(...budgetLevels);
    }

    // Filter by minimum Rating
    if (minRating !== undefined) {
      conditions.push(`p.rating_avg >= $${paramIdx++}`);
      args.push(minRating);
    }

    // Filter by Keyword (name, normalized name, address)
    if (keyword && keyword.trim() !== '') {
      const kw = `%${keyword.trim().replace(/[\\%_]/g, '\\$&')}%`; // escape LIKE wildcards
      const kwIdx = paramIdx++;
      conditions.push(
        `(p.name ILIKE $${kwIdx} OR p.name_normalized ILIKE $${kwIdx} OR p.address ILIKE $${kwIdx})`,
      );
      args.push(kw);
    }

    // Filter by Spatial Bounding Radius (PostGIS ST_DWithin)
    if (hasLocation && locLngIdx && locLatIdx) {
      const radius = radiusMeters || 5000;
      const radiusIdx = paramIdx++;
      conditions.push(
        `ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($${locLngIdx}, $${locLatIdx}), 4326), $${radiusIdx})`,
      );
      args.push(radius);
    }

    // Sort order construction
    const orderDir = sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
    const hasImageOrder = '(CASE WHEN p.image_count > 0 THEN 0 ELSE 1 END) ASC';
    let orderByClause = '';

    if (sortBy === PlaceSortBy.DISTANCE && hasLocation) {
      orderByClause = `${hasImageOrder}, distance_meters ASC, p.rating_avg DESC`; // nearest first, regardless of sortOrder
    } else if (sortBy === PlaceSortBy.RATING) {
      orderByClause = `${hasImageOrder}, p.rating_avg ${orderDir}, p.review_count ${orderDir}`;
    } else if (sortBy === PlaceSortBy.POPULARITY) {
      orderByClause = `${hasImageOrder}, p.review_count ${orderDir}, p.rating_avg ${orderDir}`;
    } else if (sortBy === PlaceSortBy.NAME) {
      orderByClause = `${hasImageOrder}, p.name ${orderDir}`;
    } else {
      // Fallback
      orderByClause = hasLocation
        ? `${hasImageOrder}, distance_meters ASC`
        : `${hasImageOrder}, p.rating_avg DESC, p.created_at DESC`;
    }

    // Pagination
    const offset = (page - 1) * limit;
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;
    args.push(limit, offset);

    const distanceSelect = hasLocation && locLngIdx && locLatIdx
      ? `ST_Distance(p.location, ST_SetSRID(ST_MakePoint($${locLngIdx}, $${locLatIdx}), 4326), true) AS distance_meters`
      : `NULL AS distance_meters`;

    const sql = `
      SELECT
        ${PLACE_COLUMNS},
        ${distanceSelect},
        COUNT(*) OVER() AS full_count
      FROM places p${PLACE_JOINS}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderByClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const rows = await this.prisma.$queryRawUnsafe<PlaceRow[]>(sql, ...args);
    const total = rows.length > 0 ? Number(rows[0].full_count) : 0;

    return {
      items: rows,
      total,
    };
  }

  async findNearby(dto: NearbyPlacesDto): Promise<PlaceRow[]> {
    const { lat, lng, radiusMeters = 3000, categorySlug, limit = 10 } = dto;
    const args: unknown[] = [lng, lat, radiusMeters];
    let catCondition = '';

    if (categorySlug && categorySlug.trim() !== '') {
      args.push(categorySlug.trim());
      catCondition = 'AND c.slug = $4';
    }

    args.push(limit);
    const limitIdx = args.length;

    const sql = `
      SELECT
        ${PLACE_COLUMNS},
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326), true) AS distance_meters
      FROM places p${PLACE_JOINS}
      WHERE p.status = 'ACTIVE' AND p.deleted_at IS NULL
        AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
        ${catCondition}
      ORDER BY distance_meters ASC
      LIMIT $${limitIdx};
    `;

    return this.prisma.$queryRawUnsafe<PlaceRow[]>(sql, ...args);
  }

  async findById(id: string): Promise<PlaceDetail | null> {
    return this.prisma.place.findUnique({
      where: { id },
      include: {
        category: true,
        area: true,
        images: {
          orderBy: [
            { isPrimary: 'desc' },
            { displayOrder: 'asc' },
            { createdAt: 'asc' },
          ],
        },
        sources: {
          select: {
            provider: true,
            externalUrl: true,
            sourceRating: true,
            sourceReviewCount: true,
          },
        },
      },
    });
  }

  async findCategories(): Promise<CategoryWithCount[]> {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        nameVi: true,
        slug: true,
        iconUrl: true,
        sortOrder: true,
        _count: {
          select: { places: true },
        },
      },
    });
  }

  async findTravelAreas(): Promise<TravelAreaRow[]> {
    return this.prisma.travelArea.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        nameVi: true,
        slug: true,
        type: true,
        bboxMinLat: true,
        bboxMaxLat: true,
        bboxMinLng: true,
        bboxMaxLng: true,
        transitHubs: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            hubType: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
  }

  async upsertPlaceEmbedding(
    placeId: string,
    contentText: string,
    embedding: number[],
    modelName: string,
  ): Promise<void> {
    const vectorString = `[${embedding.join(',')}]`;
    await this.prisma.$executeRaw`
      INSERT INTO place_embeddings (place_id, content_text, embedding, model_name, updated_at)
      VALUES (
        ${placeId}::uuid,
        ${contentText},
        ${vectorString}::vector,
        ${modelName},
        NOW()
      )
      ON CONFLICT (place_id) DO UPDATE SET
        content_text = EXCLUDED.content_text,
        embedding = EXCLUDED.embedding,
        model_name = EXCLUDED.model_name,
        updated_at = NOW();
    `;
  }

  async searchSemantic(
    vector: number[],
    limit: number = 10,
    areaId?: number,
    minSimilarity: number = 0.3,
  ): Promise<PlaceRow[]> {
    const vectorString = `[${vector.join(',')}]`;
    const areaCondition =
      areaId !== undefined ? 'AND (p.area_id = $4 OR a.parent_id = $4)' : '';
    const args: unknown[] = [vectorString, minSimilarity, limit];
    if (areaId !== undefined) args.push(areaId);

    const sql = `
      SELECT
        ${PLACE_COLUMNS},
        NULL AS distance_meters,
        ROUND((1 - (pe.embedding <=> $1::vector))::numeric, 4) AS similarity_score
      FROM place_embeddings pe
      JOIN places p ON pe.place_id = p.id${PLACE_JOINS}
      WHERE p.status = 'ACTIVE' AND p.deleted_at IS NULL
        ${areaCondition}
        AND (1 - (pe.embedding <=> $1::vector)) >= $2
      ORDER BY pe.embedding <=> $1::vector ASC
      LIMIT $3;
    `;

    return this.prisma.$queryRawUnsafe<PlaceRow[]>(sql, ...args);
  }

  async findPlacesWithoutEmbedding(limit: number = 50, areaId?: number): Promise<PlaceForEmbedding[]> {
    return this.prisma.place.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        embedding: null,
        ...(areaId !== undefined
          ? {
              OR: [
                { areaId },
                { area: { parentId: areaId } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        area: true,
      },
      take: limit,
      orderBy: [
        { imageCount: 'desc' },
        { ratingAvg: 'desc' },
      ],
    });
  }
}

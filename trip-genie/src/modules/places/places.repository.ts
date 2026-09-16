import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IPlaceRepository, PlaceSearchResult } from './interfaces/place-repository.interface';
import { SearchPlacesDto } from './dto/search-places.dto';
import { NearbyPlacesDto } from './dto/nearby-places.dto';
import { PlaceSortBy, SortOrder } from '../../common/enums/places.enum';

@Injectable()
export class PlacesRepository implements IPlaceRepository {
  private readonly logger = new Logger(PlacesRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async searchPlaces(filters: SearchPlacesDto): Promise<PlaceSearchResult> {
    const {
      keyword,
      areaId,
      categorySlugs,
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
    const args: any[] = [];
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
      const kw = `%${keyword.trim()}%`;
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
    let orderByClause = '';

    if (sortBy === PlaceSortBy.DISTANCE && hasLocation) {
      orderByClause = `distance_meters ${orderDir}, p.rating_avg DESC`;
    } else if (sortBy === PlaceSortBy.RATING) {
      orderByClause = `p.rating_avg ${orderDir}, p.review_count ${orderDir}`;
    } else if (sortBy === PlaceSortBy.POPULARITY) {
      orderByClause = `p.review_count ${orderDir}, p.rating_avg ${orderDir}`;
    } else if (sortBy === PlaceSortBy.NAME) {
      orderByClause = `p.name ${orderDir}`;
    } else {
      // Fallback
      orderByClause = hasLocation ? `distance_meters ASC` : `p.rating_avg DESC, p.created_at DESC`;
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
        p.id,
        p.name,
        p.name_normalized,
        p.description,
        p.address,
        p.district,
        p.city,
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
        ) AS primary_image,
        ${distanceSelect},
        COUNT(*) OVER() AS full_count
      FROM places p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN travel_areas a ON p.area_id = a.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderByClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...args);
    const total = rows.length > 0 ? Number(rows[0].full_count) : 0;

    return {
      items: rows,
      total,
    };
  }

  async findNearby(dto: NearbyPlacesDto): Promise<any[]> {
    const { lat, lng, radiusMeters = 3000, categorySlug, limit = 10 } = dto;
    const args: any[] = [lng, lat, radiusMeters];
    let catCondition = '';

    if (categorySlug && categorySlug.trim() !== '') {
      args.push(categorySlug.trim());
      catCondition = 'AND c.slug = $4';
    }

    args.push(limit);
    const limitIdx = args.length;

    const sql = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.address,
        p.district,
        p.city,
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
        ) AS primary_image,
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326), true) AS distance_meters
      FROM places p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN travel_areas a ON p.area_id = a.id
      WHERE p.status = 'ACTIVE' AND p.deleted_at IS NULL
        AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
        ${catCondition}
      ORDER BY distance_meters ASC
      LIMIT $${limitIdx};
    `;

    return this.prisma.$queryRawUnsafe<any[]>(sql, ...args);
  }

  async findById(id: string): Promise<any | null> {
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

  async findCategories(): Promise<any[]> {
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

  async findTravelAreas(): Promise<any[]> {
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
      },
    });
  }
}

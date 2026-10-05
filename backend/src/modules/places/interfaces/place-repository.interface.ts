import { Prisma } from '@prisma/client';
import { SearchPlacesDto } from '../dto/search-places.dto';
import { NearbyPlacesDto } from '../dto/nearby-places.dto';

type Numeric = number | string | null | undefined;

/** One raw SQL row (snake_case) returned by the place queries. */
export interface PlaceRow {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  address_normalized?: string | null;
  district?: string | null;
  city?: string | null;
  latitude: Numeric;
  longitude: Numeric;
  price_level?: string | null;
  opening_hours?: unknown;
  phone?: string | null;
  website?: string | null;
  rating_avg?: Numeric;
  review_count?: Numeric;
  image_count?: Numeric;
  category_id?: number | null;
  category_name?: string | null;
  category_name_vi?: string | null;
  category_slug?: string | null;
  category_icon_url?: string | null;
  area_id?: number | null;
  area_name?: string | null;
  area_name_vi?: string | null;
  area_slug?: string | null;
  primary_image?: string | null;
  distance_meters?: Numeric;
  similarity_score?: Numeric;
  full_count?: Numeric;
}

export interface PlaceSearchResult {
  items: PlaceRow[];
  total: number;
}

export type PlaceDetail = Prisma.PlaceGetPayload<{
  include: {
    category: true;
    area: true;
    images: true;
    sources: {
      select: {
        provider: true;
        externalUrl: true;
        sourceRating: true;
        sourceReviewCount: true;
      };
    };
  };
}>;

export type CategoryWithCount = Prisma.CategoryGetPayload<{
  select: {
    id: true;
    name: true;
    nameVi: true;
    slug: true;
    iconUrl: true;
    sortOrder: true;
    _count: { select: { places: true } };
  };
}>;

export type TravelAreaRow = Prisma.TravelAreaGetPayload<{
  select: {
    id: true;
    name: true;
    nameVi: true;
    slug: true;
    type: true;
    bboxMinLat: true;
    bboxMaxLat: true;
    bboxMinLng: true;
    bboxMaxLng: true;
    transitHubs: {
      select: {
        id: true;
        name: true;
        hubType: true;
        latitude: true;
        longitude: true;
      };
    };
  };
}>;

export type PlaceForEmbedding = Prisma.PlaceGetPayload<{
  include: { category: true; area: true };
}>;

export interface IPlaceRepository {
  /**
   * Searches and filters places based on multiple dynamic criteria using PostGIS spatial indexing.
   */
  searchPlaces(filters: SearchPlacesDto): Promise<PlaceSearchResult>;

  /**
   * Finds nearby places within a specific radius from given GPS coordinates.
   */
  findNearby(dto: NearbyPlacesDto): Promise<PlaceRow[]>;

  /**
   * Finds a place by its unique UUID with full details, images, and sources.
   */
  findById(id: string): Promise<PlaceDetail | null>;

  /**
   * Retrieves all active categories sorted by sortOrder.
   */
  findCategories(): Promise<CategoryWithCount[]>;

  /**
   * Retrieves all active travel areas.
   */
  findTravelAreas(): Promise<TravelAreaRow[]>;

  /**
   * Upserts a vector embedding record for a place in the place_embeddings table.
   */
  upsertPlaceEmbedding(
    placeId: string,
    contentText: string,
    embedding: number[],
    modelName: string,
  ): Promise<void>;

  /**
   * Performs cosine similarity search using pgvector (<=> operator).
   */
  searchSemantic(
    vector: number[],
    limit: number,
    areaId?: number,
    minSimilarity?: number,
  ): Promise<PlaceRow[]>;

  /**
   * Finds places that do not yet have an embedding in place_embeddings.
   */
  findPlacesWithoutEmbedding(limit: number, areaId?: number): Promise<PlaceForEmbedding[]>;
}

import { SearchPlacesDto } from '../dto/search-places.dto';
import { NearbyPlacesDto } from '../dto/nearby-places.dto';

export interface PlaceSearchResult {
  items: any[];
  total: number;
}

export interface IPlaceRepository {
  /**
   * Searches and filters places based on multiple dynamic criteria using PostGIS spatial indexing.
   */
  searchPlaces(filters: SearchPlacesDto): Promise<PlaceSearchResult>;

  /**
   * Finds nearby places within a specific radius from given GPS coordinates.
   */
  findNearby(dto: NearbyPlacesDto): Promise<any[]>;

  /**
   * Finds a place by its unique UUID with full details, images, and sources.
   */
  findById(id: string): Promise<any | null>;

  /**
   * Retrieves all active categories sorted by sortOrder.
   */
  findCategories(): Promise<any[]>;

  /**
   * Retrieves all active travel areas.
   */
  findTravelAreas(): Promise<any[]>;
}

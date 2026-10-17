import {
  placeService,
  type BackendTravelAreaItem,
} from "@/services/place.service";
import type { Place, SuitableAudience } from "@/types/place";
import { HOME_CONFIG } from "../config/home.config";

export const homeService = {
  /**
   * Fetch and filter verified cities/provinces for the homepage destination grid.
   * Never fabricates fake destinations or IDs.
   */
  async getDestinations(): Promise<BackendTravelAreaItem[]> {
    const areas = await placeService.getTravelAreas();
    if (!Array.isArray(areas)) return [];

    return areas
      .filter(
        (a) =>
          (a.type === "CITY" || a.type === "PROVINCE") &&
          Number.isInteger(a.id) &&
          a.id > 0
      )
      .slice(0, HOME_CONFIG.destinations.limit);
  },

  /**
   * Fetch top rated places for the homepage preference tabs using strict mode.
   * Throws if backend is unavailable so the caller can render a proper error state.
   */
  async getPlaces(audience?: SuitableAudience, limit = HOME_CONFIG.places.limit): Promise<Place[]> {
    const res = await placeService.searchPlaces(
      {
        suitableFor: audience,
        sortBy: "rating",
        limit,
      },
      { allowMockFallback: false }
    );
    return res.places;
  },
};

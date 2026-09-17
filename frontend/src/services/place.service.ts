import { Place, PlaceCategory, SuitableAudience } from "@/types/place";
import { MOCK_PLACES } from "@/mocks/data/places";

export interface PlaceFilterParams {
  keyword?: string;
  category?: PlaceCategory | "all";
  city?: string;
  suitableFor?: SuitableAudience;
  minRating?: number;
  featuredOnly?: boolean;
}

export const placeService = {
  async getPlaces(params?: PlaceFilterParams): Promise<Place[]> {
    // Simulate slight async delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    let places = [...MOCK_PLACES];

    if (!params) return places;

    if (params.keyword) {
      const q = params.keyword.toLowerCase().trim();
      places = places.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (params.category && params.category !== "all") {
      places = places.filter((p) => p.category === params.category);
    }

    if (params.city && params.city !== "all") {
      places = places.filter((p) =>
        p.city.toLowerCase().includes(params.city!.toLowerCase())
      );
    }

    if (params.suitableFor) {
      places = places.filter((p) =>
        p.suitableFor.includes(params.suitableFor!)
      );
    }

    if (params.minRating) {
      places = places.filter((p) => p.rating >= params.minRating!);
    }

    if (params.featuredOnly) {
      places = places.filter((p) => p.featured);
    }

    return places;
  },

  async getPlaceBySlug(slug: string): Promise<Place | null> {
    try {
      const decoded = decodeURIComponent(slug);
      const found = MOCK_PLACES.find((p) => p.slug === slug || p.slug === decoded);
      return found || null;
    } catch {
      const found = MOCK_PLACES.find((p) => p.slug === slug);
      return found || null;
    }
  },

  async getRelatedPlaces(currentPlaceId: string, limit = 3): Promise<Place[]> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const current = MOCK_PLACES.find((p) => p.id === currentPlaceId);
    if (!current) return MOCK_PLACES.slice(0, limit);

    return MOCK_PLACES.filter((p) => p.id !== currentPlaceId).slice(0, limit);
  },
};

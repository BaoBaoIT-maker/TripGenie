import { distance, point } from "@turf/turf";
import type {
  DiscoveryArea,
  DiscoveryCategory,
  DiscoveryFilters,
  DiscoveryPage,
  DiscoveryPlace,
} from "../types";
import {
  MOCK_DISCOVERY_AREAS,
  MOCK_DISCOVERY_CATEGORIES,
  MOCK_DISCOVERY_PLACES,
} from "@/mocks/data/map-discovery";

const PAGE_SIZE = 20;

function calculateDemoAiScore(place: DiscoveryPlace, keyword: string): number {
  const normKeyword = keyword.trim().toLowerCase();
  if (!normKeyword) {
    // Deterministic pseudo score based on place ID character codes
    const seed = place.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return 75 + (seed % 20); // 75 - 94%
  }

  const searchableText = `${place.name} ${place.address} ${place.categoryLabel} ${place.tags.join(" ")}`.toLowerCase();
  const words = normKeyword.split(/\s+/).filter(Boolean);
  let matchedWords = 0;
  for (const word of words) {
    if (searchableText.includes(word)) {
      matchedWords++;
    }
  }

  const matchRatio = words.length > 0 ? matchedWords / words.length : 0.5;
  const ratingBonus = (place.rating ?? 4.0) * 2; // 8 - 10
  const base = 65 + matchRatio * 25 + ratingBonus;
  return Math.min(98, Math.max(55, Math.round(base)));
}

export const mapDiscoveryService = {
  async getAreas(): Promise<DiscoveryArea[]> {
    return [...MOCK_DISCOVERY_AREAS];
  },

  async getCategories(): Promise<DiscoveryCategory[]> {
    return MOCK_DISCOVERY_CATEGORIES.map((cat) => {
      const count = MOCK_DISCOVERY_PLACES.filter((p) => p.category === cat.slug).length;
      return {
        ...cat,
        placeCount: count,
      };
    });
  },

  async searchPlaces(filters: DiscoveryFilters): Promise<DiscoveryPage> {
    const origin = point([filters.longitude, filters.latitude]);
    const normKeyword = filters.keyword.trim().toLowerCase();

    // 1. Calculate distances
    const placesWithDistance = MOCK_DISCOVERY_PLACES.map((place) => {
      const p = point([place.longitude, place.latitude]);
      const dist = distance(origin, p, { units: "kilometers" });
      return {
        ...place,
        distanceKm: Math.round(dist * 10) / 10,
      };
    });

    // 2. Filter
    let filtered = placesWithDistance.filter((place) => {
      // Area filter: only apply areaSlug if not in GPS/nearby mode and areaSlug !== "all"
      if (
        filters.areaSlug &&
        filters.areaSlug !== "all" &&
        filters.areaSlug !== "quanh-toi" &&
        place.areaSlug !== filters.areaSlug
      ) {
        return false;
      }

      // Radius filter: must be within radiusKm
      if (typeof place.distanceKm === "number" && place.distanceKm > filters.radiusKm) {
        return false;
      }

      // Category filter
      if (filters.categorySlug && filters.categorySlug !== "all" && place.category !== filters.categorySlug) {
        return false;
      }

      // Keyword filter
      if (normKeyword) {
        const text = `${place.name} ${place.address} ${place.categoryLabel} ${place.tags.join(" ")}`.toLowerCase();
        if (filters.mode === "ai") {
          // Natural language prompt: match any keyword or tag
          const words = normKeyword.split(/\s+/).filter((w) => w.length > 1);
          const hasMatch = words.some((w) => text.includes(w));
          if (!hasMatch) {
            return false;
          }
        } else {
          if (!text.includes(normKeyword)) {
            return false;
          }
        }
      }

      // Open now filter
      if (filters.openNow && place.isOpenNow !== true) {
        return false;
      }

      // Price levels & maxPriceVnd filter
      if (filters.maxPriceVnd && filters.maxPriceVnd > 0) {
        if (filters.maxPriceVnd <= 100000 && place.priceLevel !== null && place.priceLevel > 1) {
          return false;
        }
        if (filters.maxPriceVnd <= 300000 && place.priceLevel !== null && place.priceLevel > 2) {
          return false;
        }
        if (filters.maxPriceVnd <= 800000 && place.priceLevel !== null && place.priceLevel > 3) {
          return false;
        }
      } else if (filters.priceLevels && filters.priceLevels.length > 0) {
        if (place.priceLevel === null || !filters.priceLevels.includes(place.priceLevel)) {
          return false;
        }
      }

      // Min rating filter
      if (filters.minRating !== null && filters.minRating !== undefined) {
        if (place.rating === null || place.rating < filters.minRating) {
          return false;
        }
      }

      return true;
    });

    // 3. AI Mode: attach demoSimilarityScore
    if (filters.mode === "ai") {
      filtered = filtered.map((place) => ({
        ...place,
        demoSimilarityScore: calculateDemoAiScore(place, filters.keyword),
      }));
    }

    // 4. Sort
    filtered.sort((a, b) => {
      if (filters.mode === "ai" && filters.sortBy === "distance") {
        return (b.demoSimilarityScore ?? 0) - (a.demoSimilarityScore ?? 0);
      }
      if (filters.sortBy === "rating") {
        const rA = a.rating ?? 0;
        const rB = b.rating ?? 0;
        if (rB !== rA) return rB - rA;
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      }
      if (filters.sortBy === "reviews") {
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      }
      // default: distance
      const distA = a.distanceKm ?? 0;
      const distB = b.distanceKm ?? 0;
      if (distA !== distB) return distA - distB;
      return a.name.localeCompare(b.name, "vi");
    });

    // 5. Pagination
    const total = filtered.length;
    const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
    const validPage = total > 0 ? Math.max(1, Math.min(filters.page || 1, totalPages)) : 0;
    const startIdx = total > 0 ? (validPage - 1) * PAGE_SIZE : 0;
    const items = total > 0 ? filtered.slice(startIdx, startIdx + PAGE_SIZE) : [];

    return {
      items,
      total,
      page: validPage,
      pageSize: PAGE_SIZE,
      totalPages,
    };
  },

  async getPlaceById(id: string): Promise<DiscoveryPlace | null> {
    const found = MOCK_DISCOVERY_PLACES.find((p) => p.id === id);
    if (!found) return null;
    return { ...found };
  },
};

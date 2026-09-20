import { describe, it, expect } from "vitest";
import { mapDiscoveryService } from "@/features/map/services/map-discovery.service";
import type { DiscoveryFilters } from "@/features/map/types";

describe("mapDiscoveryService", () => {
  const defaultFilters: DiscoveryFilters = {
    mode: "keyword",
    areaSlug: "da-nang",
    keyword: "",
    categorySlug: "all",
    radiusKm: 10,
    latitude: 16.0544,
    longitude: 108.2022,
    openNow: false,
    priceLevels: [],
    minRating: null,
    sortBy: "distance",
    page: 1,
  };

  it("returns areas with Da Nang as the default primary area", async () => {
    const areas = await mapDiscoveryService.getAreas();
    expect(areas.length).toBeGreaterThan(0);
    const daNang = areas.find((a) => a.slug === "da-nang");
    expect(daNang).toBeDefined();
    expect(daNang?.latitude).toBeCloseTo(16.0544, 3);
    expect(daNang?.longitude).toBeCloseTo(108.2022, 3);
  });

  it("returns categories with dynamic place counts derived from fixtures", async () => {
    const categories = await mapDiscoveryService.getCategories();
    expect(categories.length).toBeGreaterThan(0);
    const cafeCat = categories.find((c) => c.slug === "ca-phe");
    expect(cafeCat).toBeDefined();
    expect(typeof cafeCat?.placeCount).toBe("number");
    expect(cafeCat!.placeCount).toBeGreaterThan(0);
  });

  it("filters places by area and radius with Turf distance calculation", async () => {
    const result = await mapDiscoveryService.searchPlaces(defaultFilters);
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.areaSlug).toBe("da-nang");
      expect(typeof item.distanceKm).toBe("number");
      expect(item.distanceKm!).toBeLessThanOrEqual(10);
    }
  });

  it("filters places by keyword matching name, address, or tags", async () => {
    const result = await mapDiscoveryService.searchPlaces({
      ...defaultFilters,
      keyword: "hải sản",
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      const text = `${item.name} ${item.address} ${item.tags.join(" ")}`.toLowerCase();
      expect(text).toContain("hải sản");
    }
  });

  it("filters places by category", async () => {
    const result = await mapDiscoveryService.searchPlaces({
      ...defaultFilters,
      categorySlug: "ca-phe",
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.category).toBe("ca-phe");
    }
  });

  it("filters places by openNow status", async () => {
    const result = await mapDiscoveryService.searchPlaces({
      ...defaultFilters,
      openNow: true,
    });
    for (const item of result.items) {
      expect(item.isOpenNow).toBe(true);
    }
  });

  it("filters places by minimum rating", async () => {
    const result = await mapDiscoveryService.searchPlaces({
      ...defaultFilters,
      minRating: 4.5,
    });
    for (const item of result.items) {
      expect(item.rating).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("sorts places by rating, reviewCount, and distance", async () => {
    const byRating = await mapDiscoveryService.searchPlaces({
      ...defaultFilters,
      sortBy: "rating",
    });
    for (let i = 0; i < byRating.items.length - 1; i++) {
      expect((byRating.items[i].rating ?? 0) >= (byRating.items[i + 1].rating ?? 0)).toBe(true);
    }

    const byDistance = await mapDiscoveryService.searchPlaces({
      ...defaultFilters,
      sortBy: "distance",
    });
    for (let i = 0; i < byDistance.items.length - 1; i++) {
      expect(byDistance.items[i].distanceKm! <= byDistance.items[i + 1].distanceKm!).toBe(true);
    }
  });

  it("returns deterministic demo similarity score in AI search mode", async () => {
    const result = await mapDiscoveryService.searchPlaces({
      ...defaultFilters,
      mode: "ai",
      keyword: "quán cafe yên tĩnh làm việc gần biển",
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(typeof item.demoSimilarityScore).toBe("number");
      expect(item.demoSimilarityScore!).toBeGreaterThanOrEqual(50);
      expect(item.demoSimilarityScore!).toBeLessThanOrEqual(100);
    }
  });

  it("handles zero results cleanly without crashing", async () => {
    const result = await mapDiscoveryService.searchPlaces({
      ...defaultFilters,
      keyword: "từ_khóa_không_tồn_tại_xyz_123",
    });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it("retrieves place by id with detail fields", async () => {
    const list = await mapDiscoveryService.searchPlaces(defaultFilters);
    const first = list.items[0];
    const detail = await mapDiscoveryService.getPlaceById(first.id);
    expect(detail).toBeDefined();
    expect(detail?.id).toBe(first.id);
    expect(detail?.name).toBe(first.name);
  });
});

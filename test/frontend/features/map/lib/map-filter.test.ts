import { describe, expect, it } from "vitest";
import { filterNearbyPlaces, formatDistanceKm } from "@/features/map/lib/map-filter";
import type { Place } from "@/types/place";

const basePlace: Place = {
  id: "base",
  slug: "base",
  name: "Base Cafe",
  description: "Mock",
  category: "cafe",
  categoryLabel: "Quán Cafe",
  address: "Quận 1, TP. Hồ Chí Minh",
  city: "TP. Hồ Chí Minh",
  latitude: 10.7769,
  longitude: 106.7009,
  rating: 4.5,
  reviewCount: 10,
  priceLevel: 2,
  priceRangeText: "50.000đ",
  images: [],
  coverImage: "https://images.unsplash.com/photo-1",
  tags: ["Chill"],
  suitableFor: ["friends"],
  styles: ["chill"],
};

const places: Place[] = [
  basePlace,
  { ...basePlace, id: "near", slug: "near", name: "Near Museum", category: "culture", categoryLabel: "Văn hóa", latitude: 10.7869 },
  { ...basePlace, id: "far", slug: "far", name: "Far Cafe", latitude: 10.8669 },
];

describe("filterNearbyPlaces", () => {
  it("keeps places inside the radius and sorts nearest first", () => {
    const result = filterNearbyPlaces(places, {
      latitude: 10.7769,
      longitude: 106.7009,
      maxDistanceKm: 5,
      city: "all",
      category: "all",
      keyword: "",
    });
    expect(result.map(({ place }) => place.id)).toEqual(["base", "near"]);
    expect(result[1].distanceKm).toBeGreaterThan(1);
  });

  it("composes keyword, city and category filters", () => {
    const result = filterNearbyPlaces(places, {
      latitude: 10.7769,
      longitude: 106.7009,
      maxDistanceKm: 20,
      city: "TP. Hồ Chí Minh",
      category: "cafe",
      keyword: "far",
    });
    expect(result.map(({ place }) => place.id)).toEqual(["far"]);
  });

  it("formats sub-kilometer and kilometer distances", () => {
    expect(formatDistanceKm(0.42)).toBe("420 m");
    expect(formatDistanceKm(2.34)).toBe("2,3 km");
  });
});

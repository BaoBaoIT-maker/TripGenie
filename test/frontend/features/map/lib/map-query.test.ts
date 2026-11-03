import { describe, expect, it } from "vitest";
import { mergeMapSearchParams, parseMapSearchParams } from "@/features/map/lib/map-query";
import type { DiscoveryFilters } from "@/features/map/types";
import { DEFAULT_MAP_CENTER } from "@/features/map/map-config";

describe("map query", () => {
  it("uses safe Đà Nẵng defaults and marks an absent center as implicit", () => {
    const parsed = parseMapSearchParams(new URLSearchParams());
    expect(parsed.hasExplicitCenter).toBe(false);
    expect(parsed.filters.areaSlug).toBe("da-nang");
    expect(parsed.filters.mode).toBe("keyword");
    expect(parsed.filters.radiusKm).toBe(5);
    expect(parsed.filters.categorySlug).toBe("all");
    expect(parsed.filters.page).toBe(1);
    expect(parsed.filters.latitude).toBeCloseTo(DEFAULT_MAP_CENTER.latitude, 4);
    expect(parsed.filters.longitude).toBeCloseTo(DEFAULT_MAP_CENTER.longitude, 4);
  });

  it("accepts valid explicit coordinates, areaSlug, and allowed radius only", () => {
    const parsed = parseMapSearchParams(
      new URLSearchParams("latitude=15.88&longitude=108.33&radiusKm=3&areaSlug=hoi-an&page=2&mode=ai")
    );
    expect(parsed.hasExplicitCenter).toBe(true);
    expect(parsed.filters.latitude).toBe(15.88);
    expect(parsed.filters.longitude).toBe(108.33);
    expect(parsed.filters.radiusKm).toBe(3);
    expect(parsed.filters.areaSlug).toBe("hoi-an");
    expect(parsed.filters.mode).toBe("ai");
    expect(parsed.filters.page).toBe(2);

    const invalid = parseMapSearchParams(
      new URLSearchParams("latitude=999&longitude=nope&radiusKm=7&page=-1")
    );
    expect(invalid.hasExplicitCenter).toBe(false);
    expect(invalid.filters.radiusKm).toBe(5);
    expect(invalid.filters.page).toBe(1);
  });

  it("preserves unknown parameters when merging filter updates", () => {
    const filters: DiscoveryFilters = {
      mode: "keyword",
      areaSlug: "da-nang",
      keyword: "cà phê",
      categorySlug: "ca-phe",
      radiusKm: 3,
      latitude: 16.0544,
      longitude: 108.2022,
      openNow: true,
      priceLevels: [1, 2],
      minRating: 4.5,
      sortBy: "reviews",
      page: 1,
    };

    const query = mergeMapSearchParams(new URLSearchParams("ref=shared&tab=1"), filters);
    const params = new URLSearchParams(query);
    expect(params.get("ref")).toBe("shared");
    expect(params.get("tab")).toBe("1");
    expect(params.get("categorySlug")).toBe("ca-phe");
    expect(params.get("radiusKm")).toBe("3");
    expect(params.get("openNow")).toBe("true");
    expect(params.get("priceLevels")).toBe("1,2");
    expect(params.get("minRating")).toBe("4.5");
    expect(params.get("sortBy")).toBe("reviews");
  });
});

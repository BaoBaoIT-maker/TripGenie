import { describe, expect, it } from "vitest";
import { mergeMapSearchParams, parseMapSearchParams } from "@/features/map/lib/map-query";

describe("map query", () => {
  it("uses safe defaults and marks an absent center as implicit", () => {
    const parsed = parseMapSearchParams(new URLSearchParams());
    expect(parsed.hasExplicitCenter).toBe(false);
    expect(parsed.filters.maxDistanceKm).toBe(5);
    expect(parsed.filters.category).toBe("all");
  });

  it("accepts valid coordinates and allowed radius only", () => {
    const parsed = parseMapSearchParams(new URLSearchParams("latitude=11.94&longitude=108.45&maxDistanceKm=10"));
    expect(parsed.hasExplicitCenter).toBe(true);
    expect(parsed.filters).toMatchObject({ latitude: 11.94, longitude: 108.45, maxDistanceKm: 10 });

    const invalid = parseMapSearchParams(new URLSearchParams("latitude=999&longitude=nope&maxDistanceKm=7"));
    expect(invalid.hasExplicitCenter).toBe(false);
    expect(invalid.filters.maxDistanceKm).toBe(5);
  });

  it("keeps unrelated params while replacing the map filter fields", () => {
    const query = mergeMapSearchParams(new URLSearchParams("ref=shared&keyword=old"), {
      latitude: 10.7769,
      longitude: 106.7009,
      maxDistanceKm: 3,
      city: "all",
      category: "cafe",
      keyword: "cà phê",
    });
    const params = new URLSearchParams(query);
    expect(params.get("ref")).toBe("shared");
    expect(params.get("maxDistanceKm")).toBe("3");
    expect(params.get("keyword")).toBe("cà phê");
  });
});

import { describe, expect, it } from "vitest";
import { parseSearchIntent, snapToRadiusKm } from "@/features/map/lib/search-intent";

describe("parseSearchIntent", () => {
  it("snaps numeric distances to valid system RadiusKm", () => {
    expect(snapToRadiusKm(0.8)).toBe(1);
    expect(snapToRadiusKm(2)).toBe(3);
    expect(snapToRadiusKm(6)).toBe(5);
    expect(snapToRadiusKm(12)).toBe(10);
    expect(snapToRadiusKm(25)).toBe(20);
  });

  it("extracts nearby intent and radius in Vietnamese", () => {
    const res = parseSearchIntent("quán cafe quanh đây trong khoảng 20km");
    expect(res.cleanedKeyword).toBe("quán cafe");
    expect(res.isNearbyIntent).toBe(true);
    expect(res.extractedRadiusKm).toBe(20);
  });

  it("extracts nearby intent and radius in English", () => {
    const res = parseSearchIntent("coffee shops near me within 5km");
    expect(res.cleanedKeyword).toBe("coffee shops");
    expect(res.isNearbyIntent).toBe(true);
    expect(res.extractedRadiusKm).toBe(5);
  });

  it("extracts landmark anchor in relative search", () => {
    const res = parseSearchIntent("quán ăn gần Chùa Cầu Hội An");
    expect(res.cleanedKeyword).toBe("quán ăn");
    expect(res.anchorLandmark).toBe("Chùa Cầu Hội An");
    expect(res.isNearbyIntent).toBe(false);
  });

  it("extracts both landmark anchor and distance constraint", () => {
    const resVn = parseSearchIntent("quán ăn gần Chùa Cầu Hội An trong khoảng 5km");
    expect(resVn.cleanedKeyword).toBe("quán ăn");
    expect(resVn.anchorLandmark).toBe("Chùa Cầu Hội An");
    expect(resVn.extractedRadiusKm).toBe(5);
    expect(resVn.isNearbyIntent).toBe(false);

    const resEn = parseSearchIntent("hotels near My Khe Beach within 3km");
    expect(resEn.cleanedKeyword).toBe("hotels");
    expect(resEn.anchorLandmark).toBe("My Khe Beach");
    expect(resEn.extractedRadiusKm).toBe(3);
    expect(resEn.isNearbyIntent).toBe(false);
  });

  it("handles pure nearby query without keyword", () => {
    const res = parseSearchIntent("quanh đây");
    expect(res.cleanedKeyword).toBe("");
    expect(res.isNearbyIntent).toBe(true);
  });

  it("handles 'bán kính 10km quanh đây'", () => {
    const res = parseSearchIntent("bán kính 10km quanh đây");
    expect(res.cleanedKeyword).toBe("");
    expect(res.isNearbyIntent).toBe(true);
    expect(res.extractedRadiusKm).toBe(10);
  });

  it("leaves standard exact names untouched", () => {
    const res = parseSearchIntent("Bà Nà Hills");
    expect(res.cleanedKeyword).toBe("Bà Nà Hills");
    expect(res.isNearbyIntent).toBe(false);
    expect(res.anchorLandmark).toBeUndefined();
    expect(res.extractedRadiusKm).toBeUndefined();
  });

  it("extracts administrative area intent in Vietnamese", () => {
    const res = parseSearchIntent("quán cafe ở Đà Nẵng");
    expect(res.cleanedKeyword).toBe("quán cafe");
    expect(res.areaName).toBe("Đà Nẵng");
    expect(res.isNearbyIntent).toBe(false);

    const res2 = parseSearchIntent("khách sạn tại Hà Nội");
    expect(res2.cleanedKeyword).toBe("khách sạn");
    expect(res2.areaName).toBe("Hà Nội");

    const resPure = parseSearchIntent("ở Đà Nẵng");
    expect(resPure.cleanedKeyword).toBe("");
    expect(resPure.areaName).toBe("Đà Nẵng");
  });
});

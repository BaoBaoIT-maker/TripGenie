import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  routingService,
  calculateDirectDistanceKm,
  formatDistanceKm,
  formatDurationMinutes,
  estimateDurationMinutes,
  getGoogleMapsDirectionsUrl,
  fetchRoute,
} from "@/services/routing.service";

describe("Routing Service", () => {
  // Da Nang Coordinates: Dragon Bridge & My Khe Beach
  const dragonBridge = { latitude: 16.0611, longitude: 108.2238 };
  const myKheBeach = { latitude: 16.0678, longitude: 108.2467 };

  it("calculates direct distance accurately between 2 coordinates", () => {
    const dist = calculateDirectDistanceKm(dragonBridge, myKheBeach);
    // Dragon Bridge to My Khe Beach is roughly 2.5 - 2.8 km in a straight line
    expect(dist).toBeGreaterThan(2.0);
    expect(dist).toBeLessThan(3.5);
  });

  it("handles edge cases and invalid coordinates gracefully", () => {
    // @ts-expect-error test invalid param
    expect(calculateDirectDistanceKm(null, null)).toBe(0);
    expect(calculateDirectDistanceKm({ latitude: NaN, longitude: 0 }, dragonBridge)).toBe(0);
  });

  it("formats distances correctly in Vietnamese locale", () => {
    expect(formatDistanceKm(0.45)).toBe("450 m");
    expect(formatDistanceKm(3.2)).toContain("3,2");
    expect(formatDistanceKm(12.5)).toContain("12,5");
  });

  it("estimates durations according to vehicle profiles", () => {
    const distKm = 10;
    const motorcycleTime = estimateDurationMinutes(distKm, "motorcycle");
    const drivingTime = estimateDurationMinutes(distKm, "driving");
    const walkingTime = estimateDurationMinutes(distKm, "walking");

    // Walking should take significantly longer than motorcycle
    expect(walkingTime).toBeGreaterThan(motorcycleTime);
    // Driving speed (30km/h in city) is slightly slower than motorcycle (35km/h)
    expect(drivingTime).toBeGreaterThan(motorcycleTime);
  });

  it("formats duration minutes into human readable text", () => {
    expect(formatDurationMinutes(8.4)).toBe("8 phút");
    expect(formatDurationMinutes(60)).toBe("1 giờ");
    expect(formatDurationMinutes(75)).toBe("1 giờ 15 phút");
  });

  it("generates correct Google Maps directions URL with appropriate travel mode", () => {
    const motoUrl = getGoogleMapsDirectionsUrl(dragonBridge, myKheBeach, "motorcycle");
    expect(motoUrl).toContain("travelmode=two_wheeler");
    expect(motoUrl).toContain(`origin=${dragonBridge.latitude},${dragonBridge.longitude}`);
    expect(motoUrl).toContain(`destination=${myKheBeach.latitude},${myKheBeach.longitude}`);

    const carUrl = getGoogleMapsDirectionsUrl(dragonBridge, myKheBeach, "driving");
    expect(carUrl).toContain("travelmode=driving");

    const walkUrl = getGoogleMapsDirectionsUrl(dragonBridge, myKheBeach, "walking");
    expect(walkUrl).toContain("travelmode=walking");
  });

  it("fetches route from OSRM or falls back cleanly on network issue", async () => {
    // Mock global fetch to return a simulated OSRM response
    const mockOsrmResponse = {
      code: "Ok",
      routes: [
        {
          distance: 3120, // 3.12 km
          duration: 480,  // 8 mins
          geometry: {
            type: "LineString",
            coordinates: [
              [108.2238, 16.0611],
              [108.2350, 16.0640],
              [108.2467, 16.0678],
            ],
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockOsrmResponse,
    } as Response);

    const result = await fetchRoute(dragonBridge, myKheBeach, "motorcycle");

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.distanceKm).toBeCloseTo(3.12, 1);
    expect(result.durationMinutes).toBe(8);
    expect(result.geometry.type).toBe("LineString");
    expect(result.mode).toBe("motorcycle");

    fetchSpy.mockRestore();
  });

  it("provides reliable fallback LineString if OSRM endpoint fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network Error"));

    const fallbackResult = await fetchRoute(dragonBridge, myKheBeach, "driving");

    expect(fallbackResult.fallback).toBe(true);
    expect(fallbackResult.geometry.type).toBe("LineString");
    expect(fallbackResult.geometry.coordinates).toHaveLength(2);
    expect(fallbackResult.distanceKm).toBeGreaterThan(0);
    expect(fallbackResult.durationMinutes).toBeGreaterThan(0);

    fetchSpy.mockRestore();
  });
});

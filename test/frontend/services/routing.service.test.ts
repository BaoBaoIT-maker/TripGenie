import { describe, it, expect, vi } from "vitest";
import {
  calculateDirectDistanceKm,
  formatDistanceKm,
  formatDurationMinutes,
  estimateDurationMinutes,
  getGoogleMapsDirectionsUrl,
  getGoogleMapsMultiStopUrl,
  fetchRoute,
  fetchMultiStopRoute,
  isSyntheticRouteOriginId,
  buildInitialRouteStops,
  addStopToRoute,
  setOriginInRoute,
  applyUserLocationToRoute,
  removeStopFromRoute,
} from "@/services/routing.service";
import {
  ROUTE_STOP_ID_AREA_CENTER,
  ROUTE_STOP_ID_USER_LOCATION,
  MAX_NEARBY_PROXIMITY_KM,
} from "@/features/map/map-config";

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
    const mockOsrmResponse = {
      code: "Ok",
      routes: [
        {
          distance: 3120,
          duration: 480,
          geometry: {
            type: "LineString",
            coordinates: [
              [108.2238, 16.0611],
              [108.235, 16.064],
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
    expect(result.durationMinutes).toBeGreaterThan(4);
    expect(result.durationMinutes).toBeLessThan(12);
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

describe("Multi-Stop Routing (New Features)", () => {
  const daNang = { latitude: 16.0544, longitude: 108.2022 };
  const banahills = { latitude: 15.9988, longitude: 107.9959 };
  const hoian = { latitude: 15.8801, longitude: 108.338 };

  it("getGoogleMapsMultiStopUrl: 1 stop returns search URL", () => {
    const url = getGoogleMapsMultiStopUrl([{ coordinate: daNang, name: "Đà Nẵng" }]);
    expect(url).toContain("https://www.google.com/maps/search/?api=1");
    expect(url).toContain("query=");
  });

  it("getGoogleMapsMultiStopUrl: 2 stops returns directions URL without waypoints", () => {
    const url = getGoogleMapsMultiStopUrl([
      { coordinate: daNang, name: "Điểm A" },
      { coordinate: hoian, name: "Hội An" },
    ]);
    expect(url).toContain("dir/?api=1");
    expect(url).toContain("origin=");
    expect(url).toContain("destination=");
    expect(url).not.toContain("waypoints=");
  });

  it("getGoogleMapsMultiStopUrl: 3+ stops adds waypoints param", () => {
    const url = getGoogleMapsMultiStopUrl([
      { coordinate: daNang, name: "Điểm A" },
      { coordinate: banahills, name: "Bà Nà Hills" },
      { coordinate: hoian, name: "Hội An" },
    ]);
    expect(url).toContain("waypoints=");
    expect(url).toContain(encodeURIComponent("Bà Nà Hills"));
  });

  it("fetchMultiStopRoute: throws when < 2 points given", async () => {
    await expect(fetchMultiStopRoute([daNang])).rejects.toThrow();
  });

  it("fetchMultiStopRoute: geometric fallback when OSRM offline", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const res = await fetchMultiStopRoute([daNang, banahills, hoian], "motorcycle");
    expect(res.fallback).toBe(true);
    expect(res.distanceKm).toBeGreaterThan(0);
    expect(res.geometry.type).toBe("LineString");
    expect(res.waypoints?.length).toBe(3);
    spy.mockRestore();
  });

  it("MAX_NEARBY_PROXIMITY_KM is configured to 20km", () => {
    expect(MAX_NEARBY_PROXIMITY_KM).toBe(20);
  });

  it("buildInitialRouteStops: uses user GPS when within 20km, and area center when > 20km or null", () => {
    const targetStop = {
      id: "place-dragon-bridge",
      name: "Cầu Rồng",
      coordinate: { latitude: 16.0611, longitude: 108.2238 },
    };
    const nearbyUser = { latitude: 16.0544, longitude: 108.2022 }; // ~2.4km away
    const farUserHoiAn = { latitude: 15.8794, longitude: 108.335 }; // ~23.5km away (> 20km)

    const nearStops = buildInitialRouteStops({
      targetStop,
      userLocation: nearbyUser,
      areaCenter: daNang,
      areaName: "Đà Nẵng",
    });
    expect(nearStops).toHaveLength(2);
    expect(nearStops[0].id).toBe(ROUTE_STOP_ID_USER_LOCATION);
    expect(nearStops[0].name).toBe("Vị trí của bạn");
    expect(nearStops[1].id).toBe("place-dragon-bridge");

    const farStops = buildInitialRouteStops({
      targetStop,
      userLocation: farUserHoiAn,
      areaCenter: daNang,
      areaName: "Đà Nẵng",
    });
    expect(farStops).toHaveLength(2);
    expect(farStops[0].id).toBe(ROUTE_STOP_ID_AREA_CENTER);
    expect(farStops[0].name).toBe("Trung tâm Đà Nẵng");
    expect(isSyntheticRouteOriginId(farStops[0].id)).toBe(true);
  });

  it("addStopToRoute: appends new stop to end and prevents duplicate stops", () => {
    const stopA = { id: "place-a", name: "Điểm A", coordinate: daNang };
    const stopB = { id: "place-b", name: "Điểm B", coordinate: banahills };
    const stopC = { id: "place-c", name: "Điểm C", coordinate: hoian };

    const afterAdd = addStopToRoute([stopA, stopB], stopC);
    expect(afterAdd.map((s) => s.id)).toEqual(["place-a", "place-b", "place-c"]);

    // Adding an already-present stop does not duplicate it
    const afterDuplicate = addStopToRoute(afterAdd, stopB);
    expect(afterDuplicate.map((s) => s.id)).toEqual(["place-a", "place-b", "place-c"]);
  });

  it("setOriginInRoute: replaces synthetic origin (Trung tâm / Vị trí của bạn) but pushes real place origin to Stop 2", () => {
    const syntheticOrigin = {
      id: ROUTE_STOP_ID_AREA_CENTER,
      name: "Trung tâm Đà Nẵng",
      coordinate: daNang,
    };
    const placeA = { id: "place-a", name: "Khách sạn A", coordinate: daNang };
    const placeB = { id: "place-b", name: "Bà Nà Hills", coordinate: banahills };
    const placeC = { id: "place-c", name: "Phố cổ Hội An", coordinate: hoian };

    // Case 1: Stop 0 is synthetic ("Trung tâm Đà Nẵng") -> replaced by placeA
    const replaced = setOriginInRoute([syntheticOrigin, placeB], placeA);
    expect(replaced.map((s) => s.id)).toEqual(["place-a", "place-b"]);

    // Case 2: Stop 0 is a real place ("Khách sạn A") -> placeA is pushed to Stop 2, placeC becomes Stop 1
    const pushed = setOriginInRoute([placeA, placeB], placeC);
    expect(pushed.map((s) => s.id)).toEqual(["place-c", "place-a", "place-b"]);

    // Case 3: Promoting an existing stop (placeB) to Origin deduplicates it from its old index
    const promoted = setOriginInRoute([placeA, placeB, placeC], placeB);
    expect(promoted.map((s) => s.id)).toEqual(["place-b", "place-a", "place-c"]);
  });

  it("applyUserLocationToRoute: respects 20km in auto mode, but bypasses 20km and preserves real origin in force mode", () => {
    const farUserHcmc = { latitude: 10.7769, longitude: 106.7009 }; // ~600km from Da Nang
    const areaOrigin = {
      id: ROUTE_STOP_ID_AREA_CENTER,
      name: "Trung tâm Đà Nẵng",
      coordinate: daNang,
    };
    const placeA = { id: "place-a", name: "Khách sạn A", coordinate: daNang };
    const placeB = { id: "place-b", name: "Cầu Rồng", coordinate: banahills };

    // Auto mode (force: false) when user is > 20km away: does NOT hijack
    const autoRes = applyUserLocationToRoute([areaOrigin, placeB], farUserHcmc, { force: false });
    expect(autoRes.applied).toBe(false);
    expect(autoRes.stops[0].id).toBe(ROUTE_STOP_ID_AREA_CENTER);

    // Explicit click on "Từ vị trí của tôi" (force: true) when Stop 0 is area center: replaces area center even > 20km
    const forcedFromArea = applyUserLocationToRoute([areaOrigin, placeB], farUserHcmc, { force: true });
    expect(forcedFromArea.applied).toBe(true);
    expect(forcedFromArea.stops.map((s) => s.id)).toEqual([ROUTE_STOP_ID_USER_LOCATION, "place-b"]);

    // Explicit click on "Từ vị trí của tôi" (force: true) when Stop 0 is a real place: prepends user location before placeA
    const forcedFromRealPlace = applyUserLocationToRoute([placeA, placeB], farUserHcmc, { force: true });
    expect(forcedFromRealPlace.applied).toBe(true);
    expect(forcedFromRealPlace.stops.map((s) => s.id)).toEqual([
      ROUTE_STOP_ID_USER_LOCATION,
      "place-a",
      "place-b",
    ]);
  });

  it("removeStopFromRoute: removes by index or ID and clears route when < 2 stops remain", () => {
    const s1 = { id: "p1", name: "P1", coordinate: daNang };
    const s2 = { id: "p2", name: "P2", coordinate: banahills };
    const s3 = { id: "p3", name: "P3", coordinate: hoian };

    const afterRemoveById = removeStopFromRoute([s1, s2, s3], "p2");
    expect(afterRemoveById.map((s) => s.id)).toEqual(["p1", "p3"]);

    // Removing from a 2-stop route clears the entire route
    const cleared = removeStopFromRoute(afterRemoveById, 0);
    expect(cleared).toEqual([]);
  });
});

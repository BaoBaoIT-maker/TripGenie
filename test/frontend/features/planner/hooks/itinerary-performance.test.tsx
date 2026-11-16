import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { fetchDailyRouteSegments, fetchMultiStopRoute } from "@/services/routing.service";
import { itineraryService } from "@/services/itinerary-planner.service";
import { itineraryKeys, useItineraryQuery } from "@/features/planner/hooks/use-itinerary-planner";
import ItineraryTimeline from "@/features/planner/components/itinerary/ItineraryTimeline";
import type { ItineraryDetail } from "@/types/itinerary";

vi.mock("@/services/itinerary-planner.service", () => ({
  itineraryService: {
    getItinerary: vi.fn(),
    getWeather: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status = 500;
  },
}));

describe("Itinerary Performance & Honest Metadata", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("deduplicates concurrent identical OSRM requests via in-flight map", async () => {
    let resolveFetch!: (val: any) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    globalThis.fetch = fetchMock as any;

    const points = [
      { latitude: 16.0544, longitude: 108.2022 },
      { latitude: 16.061, longitude: 108.227 },
    ];

    const p1 = fetchMultiStopRoute(points, "motorcycle");
    const p2 = fetchMultiStopRoute(points, "motorcycle");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 3500,
            geometry: {
              type: "LineString",
              coordinates: [
                [108.2022, 16.0544],
                [108.227, 16.061],
              ],
            },
            legs: [{ distance: 3500 }],
          },
        ],
      }),
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(r1.distanceKm).toBeCloseTo(3.5);
  });

  it("does not cache geometric fallback so a transient OSRM outage is retried", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    globalThis.fetch = fetchMock as any;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const points = [
      { latitude: 10.01, longitude: 106.01 },
      { latitude: 10.02, longitude: 106.02 },
    ];

    const first = await fetchMultiStopRoute(points, "motorcycle");
    const second = await fetchMultiStopRoute(points, "motorcycle");

    expect(first.fallback).toBe(true);
    expect(second.fallback).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("dispatches all visible day routes concurrently via fetchDailyRouteSegments instead of sequential waterfall", async () => {
    const pendingResolvers: Array<(val: any) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          pendingResolvers.push(resolve);
        })
    );
    globalThis.fetch = fetchMock as any;

    const batchPromise = fetchDailyRouteSegments(
      [
        {
          dayNumber: 1,
          points: [
            { latitude: 16.01, longitude: 108.21 },
            { latitude: 16.02, longitude: 108.22 },
          ],
        },
        {
          dayNumber: 2,
          points: [
            { latitude: 16.03, longitude: 108.23 },
            { latitude: 16.04, longitude: 108.24 },
          ],
        },
      ],
      "motorcycle"
    );

    // Both day requests must fire immediately in parallel before either resolves
    expect(fetchMock).toHaveBeenCalledTimes(2);

    pendingResolvers.forEach((resolve, idx) =>
      resolve({
        ok: true,
        json: async () => ({
          code: "Ok",
          routes: [
            {
              distance: 2000 + idx * 500,
              geometry: {
                type: "LineString",
                coordinates: [
                  [108.21 + idx * 0.02, 16.01 + idx * 0.02],
                  [108.22 + idx * 0.02, 16.02 + idx * 0.02],
                ],
              },
              legs: [{ distance: 2000 }],
            },
          ],
        }),
      })
    );

    const segments = await batchPromise;
    expect(segments).toHaveLength(2);
    expect(segments[0].dayNumber).toBe(1);
    expect(segments[1].dayNumber).toBe(2);
  });

  it("does not refetch fresh cached itinerary on mount when cache was seeded via setQueryData", () => {
    const queryClient = new QueryClient();
    const seeded: ItineraryDetail = {
      id: "itin-cached",
      title: "Cached Trip",
      description: null,
      destination: "Đà Nẵng",
      startDate: "2026-11-12",
      endDate: "2026-11-13",
      totalDays: 2,
      partySize: 2,
      budgetLevel: "MEDIUM",
      intercityTransit: null,
      budgetBreakdown: null,
      days: [],
    };
    queryClient.setQueryData(itineraryKeys.detail("itin-cached"), seeded);

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useItineraryQuery("itin-cached"), { wrapper: Wrapper });

    expect(result.current.data).toEqual(seeded);
    expect(itineraryService.getItinerary).not.toHaveBeenCalled();
  });

  it("renders honest missing rating, real openingStatus, and lazy thumbnail in ItineraryTimeline", () => {
    render(
      <ItineraryTimeline
        days={[
          {
            dayNumber: 1,
            theme: "Di tích",
            activities: [
              {
                id: "dest-1",
                placeId: "place-1",
                placeName: "Bảo tàng Chăm",
                startTime: "18:00",
                endTime: "19:30",
                durationMinutes: 90,
                visitOrder: 1,
                notes: null,
                latitude: 16.0606,
                longitude: 108.2233,
                address: "Đà Nẵng",
                imageUrl: "https://example.com/full.jpg",
                thumbnailUrl: "https://example.com/thumb.jpg",
                categoryName: "Bảo tàng",
                distanceToNextKm: null,
                ratingAvg: null,
                reviewCount: null,
                openingStatus: {
                  state: "CLOSED",
                  label: "Ngoài giờ mở cửa (07:00-17:30)",
                  todayHours: "07:00-17:30",
                },
              },
            ],
          },
        ]}
        startDate="2026-11-12"
        endDate="2026-11-12"
      />
    );

    expect(screen.getByText("Chưa có đánh giá")).toBeInTheDocument();
    expect(screen.queryByText("4.7")).not.toBeInTheDocument();
    expect(screen.getByText("Ngoài giờ mở cửa (07:00-17:30)")).toBeInTheDocument();
    expect(screen.queryByText("Đang mở cửa")).not.toBeInTheDocument();

    const img = screen.getByAltText("Bảo tàng Chăm") as HTMLImageElement;
    expect(img.src).toContain("https://example.com/thumb.jpg");
    expect(img).toHaveAttribute("loading", "lazy");
  });
});

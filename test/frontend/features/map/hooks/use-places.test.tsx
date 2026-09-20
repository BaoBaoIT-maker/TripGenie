import { ReactNode } from "vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  usePlacesQuery,
  useDiscoveryAreasQuery,
  useDiscoveryCategoriesQuery,
  discoveryKeys,
} from "@/features/map/hooks/use-places";
import { mapDiscoveryService } from "@/features/map/services/map-discovery.service";
import type { DiscoveryFilters } from "@/features/map/types";

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

vi.mock("@/features/map/services/map-discovery.service", () => ({
  mapDiscoveryService: {
    searchPlaces: vi.fn(),
    getAreas: vi.fn(),
    getCategories: vi.fn(),
  },
}));

describe("use-places discovery queries", () => {
  const filters: DiscoveryFilters = {
    mode: "keyword",
    areaSlug: "da-nang",
    keyword: "",
    categorySlug: "all",
    radiusKm: 5,
    latitude: 16.0544,
    longitude: 108.2022,
    openNow: false,
    priceLevels: [],
    minRating: null,
    sortBy: "distance",
    page: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defines distinct cache keys", () => {
    expect(discoveryKeys.all).toEqual(["discovery-places"]);
    expect(discoveryKeys.areas()).toEqual(["discovery-places", "areas"]);
    expect(discoveryKeys.categories()).toEqual(["discovery-places", "categories"]);
    expect(discoveryKeys.search(filters)).toEqual(["discovery-places", "search", filters]);
  });

  it("loads discovery page via mapDiscoveryService.searchPlaces", async () => {
    const mockPage = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };
    vi.mocked(mapDiscoveryService.searchPlaces).mockResolvedValue(mockPage);

    const { result } = renderHook(() => usePlacesQuery(filters), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPage);
    expect(mapDiscoveryService.searchPlaces).toHaveBeenCalledWith(filters);
  });

  it("loads areas and categories via mapDiscoveryService", async () => {
    const mockAreas = [{ slug: "da-nang", name: "Đà Nẵng", latitude: 16.0544, longitude: 108.2022, radiusKm: 5 as const }];
    const mockCategories = [{ slug: "ca-phe", name: "Cà phê", icon: "Coffee", placeCount: 3 }];

    vi.mocked(mapDiscoveryService.getAreas).mockResolvedValue(mockAreas);
    vi.mocked(mapDiscoveryService.getCategories).mockResolvedValue(mockCategories);

    const { result: areaResult } = renderHook(() => useDiscoveryAreasQuery(), {
      wrapper: createQueryWrapper(),
    });
    const { result: catResult } = renderHook(() => useDiscoveryCategoriesQuery(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(areaResult.current.isSuccess).toBe(true));
    await waitFor(() => expect(catResult.current.isSuccess).toBe(true));

    expect(areaResult.current.data).toEqual(mockAreas);
    expect(catResult.current.data).toEqual(mockCategories);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapExplorer } from "@/features/map/MapExplorer";
import type { VietMapProps } from "@/features/map/types";
import {
  usePlacesQuery,
  useDiscoveryAreasQuery,
  useDiscoveryCategoriesQuery,
} from "@/features/map/hooks/use-places";
import { useMapFilters } from "@/features/map/hooks/use-map-filters";
import { useGeolocation } from "@/features/map/hooks/use-geolocation";
import type { DiscoveryPlace } from "@/features/map/types";

vi.mock("@/components/map/VietMapLoader", () => ({
  VietMapLoader: ({ places }: VietMapProps) => (
    <div data-testid="map-probe" data-place-count={places.length} />
  ),
}));

vi.mock("@/features/map/hooks/use-places", () => ({
  usePlacesQuery: vi.fn(),
  useDiscoveryAreasQuery: vi.fn(),
  useDiscoveryCategoriesQuery: vi.fn(),
}));

vi.mock("@/features/map/hooks/use-map-filters", () => ({
  useMapFilters: vi.fn(),
}));

vi.mock("@/features/map/hooks/use-geolocation", () => ({
  useGeolocation: vi.fn(),
}));

const mockDiscoveryPlace: DiscoveryPlace = {
  id: "dn-cafe-1",
  slug: "goc-an-yen-cafe",
  name: "Góc An Yên Cafe & Bistro",
  category: "ca-phe",
  categoryLabel: "Cà phê",
  areaSlug: "da-nang",
  areaName: "Đà Nẵng",
  address: "32 Bạch Đằng, Quận Hải Châu, Đà Nẵng",
  latitude: 16.0682,
  longitude: 108.2241,
  rating: 4.8,
  reviewCount: 312,
  priceLevel: 2,
  isOpenNow: true,
  primaryImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80",
  images: [],
  phone: "0236 3888 999",
  website: null,
  openingHours: "07:00 - 22:30",
  tags: ["View sông Hàn"],
  distanceKm: 1.2,
};

describe("MapExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDiscoveryAreasQuery).mockReturnValue({
      data: [{ slug: "da-nang", name: "Đà Nẵng", latitude: 16.0544, longitude: 108.2022, radiusKm: 5 }],
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useDiscoveryCategoriesQuery).mockReturnValue({
      data: [{ slug: "ca-phe", name: "Cà phê", icon: "Coffee", placeCount: 1 }],
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useMapFilters).mockReturnValue({
      filters: {
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
      },
      hasExplicitCenter: true,
      replaceFilters: vi.fn(),
    });

    vi.mocked(useGeolocation).mockReturnValue({
      status: "idle",
      coordinate: null,
      message: null,
      requestLocation: vi.fn(),
    });
  });

  it("passes synchronized items to both map and result list in split layout", () => {
    vi.mocked(usePlacesQuery).mockReturnValue({
      data: {
        items: [mockDiscoveryPlace],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
    } as any);

    render(<MapExplorer />);

    expect(screen.getAllByText(/Góc An Yên Cafe/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("map-probe")).toHaveAttribute("data-place-count", "1");
  });

  it("toggles mobile view between list and map", async () => {
    vi.mocked(usePlacesQuery).mockReturnValue({
      data: {
        items: [mockDiscoveryPlace],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
    } as any);

    const user = userEvent.setup();
    render(<MapExplorer />);

    const toggleBtn = screen.getByRole("button", { name: /xem bản đồ/i });
    expect(toggleBtn).toBeInTheDocument();
    await user.click(toggleBtn);
    expect(screen.getByRole("button", { name: /xem danh sách/i })).toBeInTheDocument();
  });
});

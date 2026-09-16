import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MapExplorer } from "@/features/map/MapExplorer";
import type { VietMapProps } from "@/features/map/types";
import { usePlacesQuery } from "@/features/map/hooks/use-places";
import { useMapFilters } from "@/features/map/hooks/use-map-filters";
import { useGeolocation } from "@/features/map/hooks/use-geolocation";
import { MOCK_PLACES } from "@/mocks/data/places";

vi.mock("@/components/map/VietMapLoader", () => ({
  VietMapLoader: ({ places }: VietMapProps) => (
    <div data-testid="map-probe" data-place-count={places.length} />
  ),
}));
vi.mock("@/features/map/hooks/use-places", () => ({ usePlacesQuery: vi.fn() }));
vi.mock("@/features/map/hooks/use-map-filters", () => ({ useMapFilters: vi.fn() }));
vi.mock("@/features/map/hooks/use-geolocation", () => ({ useGeolocation: vi.fn() }));

describe("MapExplorer", () => {
  it("passes the same nearby set to the map and result list", () => {
    vi.mocked(usePlacesQuery).mockReturnValue({
      data: MOCK_PLACES,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof usePlacesQuery>);
    vi.mocked(useMapFilters).mockReturnValue({
      filters: {
        latitude: 10.7769,
        longitude: 106.7009,
        maxDistanceKm: 10,
        city: "TP. Hồ Chí Minh",
        category: "all",
        keyword: "",
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

    render(<MapExplorer />);

    expect(screen.getAllByText(/Thảo Cầm Viên/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Tràng An/)).not.toBeInTheDocument();
    expect(screen.getByTestId("map-probe")).toHaveAttribute("data-place-count", "2");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapResults } from "@/features/map/MapResults";
import { MapPlaceCard } from "@/features/map/MapPlaceCard";
import type { NearbyPlace } from "@/features/map/types";
import { formatDistanceKm } from "@/features/map/lib/map-filter";
import { MOCK_PLACES } from "@/mocks/data/places";

const nearbyPlace: NearbyPlace = {
  place: MOCK_PLACES[0],
  distanceKm: 1.2,
};

describe("MapResults and MapPlaceCard", () => {
  it("shows addresses and computed distances", () => {
    render(
      <MapResults
        places={[nearbyPlace]}
        radiusKm={5}
        selectedPlaceId={null}
        hoveredPlaceId={null}
        onSelectPlace={vi.fn()}
        onHoverPlace={vi.fn()}
        onExpandRadius={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );
    expect(screen.getByText(nearbyPlace.place.address)).toBeInTheDocument();
    expect(screen.getByText(formatDistanceKm(nearbyPlace.distanceKm))).toBeInTheDocument();
  });

  it("synchronizes focus and click without hijacking the detail link", async () => {
    const onSelect = vi.fn();
    const onHover = vi.fn();
    render(
      <MapPlaceCard
        nearbyPlace={nearbyPlace}
        selected={false}
        hovered={false}
        onSelect={onSelect}
        onHover={onHover}
      />
    );
    const card = screen.getByRole("button", { name: new RegExp(`Chọn ${nearbyPlace.place.name}`) });
    card.focus();
    expect(onHover).toHaveBeenCalledWith(nearbyPlace.place.id);
    await userEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(nearbyPlace.place.id);
    expect(screen.getByRole("link", { name: /Xem chi tiết/i })).toHaveAttribute(
      "href",
      `/places/${nearbyPlace.place.slug}`
    );
  });

  it("shows empty state with actions when no places match", async () => {
    const onExpandRadius = vi.fn();
    const onClearFilters = vi.fn();
    const user = userEvent.setup();

    render(
      <MapResults
        places={[]}
        radiusKm={5}
        selectedPlaceId={null}
        hoveredPlaceId={null}
        onSelectPlace={vi.fn()}
        onHoverPlace={vi.fn()}
        onExpandRadius={onExpandRadius}
        onClearFilters={onClearFilters}
      />
    );

    const expandBtn = screen.getByRole("button", { name: /Mở rộng đến 10 km/i });
    const clearBtn = screen.getByRole("button", { name: /Xóa bộ lọc/i });

    await user.click(expandBtn);
    expect(onExpandRadius).toHaveBeenCalled();

    await user.click(clearBtn);
    expect(onClearFilters).toHaveBeenCalled();
  });
});

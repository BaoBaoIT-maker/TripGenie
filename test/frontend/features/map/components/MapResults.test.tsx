import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapResults } from "@/features/map/MapResults";
import { MapPlaceCard } from "@/features/map/MapPlaceCard";
import type { DiscoveryPlace } from "@/features/map/types";

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
  demoSimilarityScore: 88,
};

describe("MapResults and MapPlaceCard", () => {
  it("shows addresses, computed distances, and AI score badge in card", () => {
    render(
      <MapResults
        places={[mockDiscoveryPlace]}
        total={1}
        currentPage={1}
        totalPages={1}
        radiusKm={5}
        selectedPlaceId={null}
        hoveredPlaceId={null}
        onSelectPlace={vi.fn()}
        onHoverPlace={vi.fn()}
        onExpandRadius={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );
    expect(screen.getByText(mockDiscoveryPlace.address)).toBeInTheDocument();
    expect(screen.getAllByText(/1[,.]2 km/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Phù hợp: 88%/)).toBeInTheDocument();
  });

  it("synchronizes focus, click, and triggers onOpenDetail", async () => {
    const onSelect = vi.fn();
    const onHover = vi.fn();
    const onOpenDetail = vi.fn();

    render(
      <MapPlaceCard
        place={mockDiscoveryPlace}
        selected={false}
        hovered={false}
        onSelect={onSelect}
        onHover={onHover}
        onOpenDetail={onOpenDetail}
      />
    );

    const card = screen.getByRole("button", { name: new RegExp(`Xem thông tin ${mockDiscoveryPlace.name}`) });
    card.focus();
    expect(onHover).toHaveBeenCalledWith(mockDiscoveryPlace.id);

    await userEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(mockDiscoveryPlace.id);
    expect(onOpenDetail).toHaveBeenCalledWith(mockDiscoveryPlace.id);
  });

  it("renders pagination controls and triggers onPageChange", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MapResults
        places={[mockDiscoveryPlace]}
        total={25}
        currentPage={1}
        totalPages={2}
        radiusKm={5}
        selectedPlaceId={null}
        hoveredPlaceId={null}
        onSelectPlace={vi.fn()}
        onHoverPlace={vi.fn()}
        onExpandRadius={vi.fn()}
        onClearFilters={vi.fn()}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText(/Trang 1 \/ 2/)).toBeInTheDocument();
    const nextBtn = screen.getByRole("button", { name: /sau/i });
    await user.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("shows empty state with actions when no places match", async () => {
    const onExpandRadius = vi.fn();
    const onClearFilters = vi.fn();
    const user = userEvent.setup();

    render(
      <MapResults
        places={[]}
        total={0}
        currentPage={1}
        totalPages={0}
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

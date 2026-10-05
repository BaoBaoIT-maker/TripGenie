import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapFilters } from "@/features/map/MapFilters";
import type { DiscoveryArea, DiscoveryCategory, DiscoveryFilters } from "@/features/map/types";

const mockAreas: DiscoveryArea[] = [
  { slug: "da-nang", name: "Đà Nẵng", latitude: 16.0544, longitude: 108.2022, radiusKm: 5 },
  { slug: "hoi-an", name: "Hội An", latitude: 15.8801, longitude: 108.338, radiusKm: 5 },
];

const mockCategories: DiscoveryCategory[] = [
  { slug: "ca-phe", name: "Cà phê", icon: "Coffee", placeCount: 3 },
  { slug: "nha-hang", name: "Nhà hàng", icon: "Utensils", placeCount: 2 },
];

const defaultFilters: DiscoveryFilters = {
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

describe("MapFilters", () => {
  it("renders tabs with interactive AI demo mode and visible AI mô phỏng badge", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MapFilters
        filters={defaultFilters}
        areas={mockAreas}
        categories={mockCategories}
        onChange={onChange}
        onUseCurrentLocation={vi.fn()}
        locating={false}
      />
    );

    expect(screen.getByRole("tab", { name: /bộ lọc & tìm kiếm/i })).toBeInTheDocument();
    const aiTab = screen.getByRole("tab", { name: /trợ lý ai/i });
    expect(aiTab).toBeInTheDocument();
    expect(screen.getByText(/ai mô phỏng|bản demo/i)).toBeInTheDocument();

    await user.click(aiTab);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "ai", page: 1 })
    );
  });

  it("selects area from dropdown and moves coordinates", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MapFilters
        filters={defaultFilters}
        areas={mockAreas}
        categories={mockCategories}
        onChange={onChange}
        onUseCurrentLocation={vi.fn()}
        locating={false}
      />
    );

    await user.click(screen.getByRole("combobox", { name: /vùng du lịch/i }));
    await user.click(await screen.findByRole("option", { name: "Hội An" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        areaSlug: "hoi-an",
        latitude: 15.8801,
        longitude: 108.338,
        page: 1,
      })
    );
  });

  it("renders category chips with place counts and toggles category selection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MapFilters
        filters={defaultFilters}
        areas={mockAreas}
        categories={mockCategories}
        onChange={onChange}
        onUseCurrentLocation={vi.fn()}
        locating={false}
      />
    );

    expect(screen.getByText("Cà phê")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cà phê/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlug: "ca-phe", page: 1 })
    );
  });

  it("changes radius and resets page", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MapFilters
        filters={{ ...defaultFilters, page: 3 }}
        areas={mockAreas}
        categories={mockCategories}
        onChange={onChange}
        onUseCurrentLocation={vi.fn()}
        locating={false}
      />
    );

    await user.click(screen.getByRole("button", { name: "Trong bán kính 3 km" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ radiusKm: 3, page: 1 })
    );
  });

  it("triggers GPS request on 'Tìm quanh đây' click", async () => {
    const onUseCurrentLocation = vi.fn();
    const user = userEvent.setup();

    render(
      <MapFilters
        filters={defaultFilters}
        areas={mockAreas}
        categories={mockCategories}
        onChange={vi.fn()}
        onUseCurrentLocation={onUseCurrentLocation}
        locating={false}
      />
    );

    await user.click(screen.getByRole("button", { name: /tìm quanh đây/i }));
    expect(onUseCurrentLocation).toHaveBeenCalledTimes(1);
  });
});

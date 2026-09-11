import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapFilters as MapFiltersComponent } from "@/features/map/MapFilters";
import type { MapFilters } from "@/features/map/types";
import { CITY_CENTERS } from "@/features/map/map-config";

const filters: MapFilters = {
  latitude: 10.7769,
  longitude: 106.7009,
  maxDistanceKm: 5,
  city: "all",
  category: "all",
  keyword: "",
};

describe("MapFilters", () => {
  it("changes the radius without losing other filters", async () => {
    const onChange = vi.fn();
    render(
      <MapFiltersComponent
        filters={filters}
        onChange={onChange}
        onUseCurrentLocation={vi.fn()}
        locating={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Trong bán kính 10 km" }));
    expect(onChange).toHaveBeenCalledWith({ ...filters, maxDistanceKm: 10 });
  });

  it("moves the center when a city is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MapFiltersComponent
        filters={filters}
        onChange={onChange}
        onUseCurrentLocation={vi.fn()}
        locating={false}
      />
    );
    await user.click(screen.getByRole("combobox", { name: /Thành phố/i }));
    await user.click(screen.getByRole("option", { name: "TP. Hồ Chí Minh" }));
    expect(onChange).toHaveBeenCalledWith({
      ...filters,
      ...CITY_CENTERS["TP. Hồ Chí Minh"],
      city: "TP. Hồ Chí Minh",
    });
  });

  it("renders category chips with wrap layout and has a keyword input", () => {
    render(
      <MapFiltersComponent
        filters={filters}
        onChange={vi.fn()}
        onUseCurrentLocation={vi.fn()}
        locating={false}
      />
    );
    expect(screen.getByLabelText(/Tìm địa điểm/i)).toBeInTheDocument();
    const categoryGroup = screen.getByRole("group", { name: /Danh mục/i });
    expect(categoryGroup.className).toMatch(/flex-wrap/);
  });
});

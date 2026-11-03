import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPlaceMarkerElement } from "@/components/map/PlaceMarker";
import { createMapPopupElement } from "@/components/map/MapPopup";
import { VietMapLoader } from "@/components/map/VietMapLoader";
import { MapControls } from "@/components/map/MapControls";
import type { NearbyPlace, VietMapProps } from "@/features/map/types";
import { MOCK_PLACES } from "@/mocks/data/places";

const nearbyPlace: NearbyPlace = { place: MOCK_PLACES[0], distanceKm: 1.2 };
const props: VietMapProps = {
  places: [nearbyPlace],
  center: { latitude: 11.9404, longitude: 108.4583 },
  radiusKm: 5,
  selectedPlaceId: null,
  hoveredPlaceId: null,
  onSelectPlace: vi.fn(),
  onViewportChange: vi.fn(),
  onRequestCurrentLocation: vi.fn(),
  locating: false,
};

describe("VietMap DOM factories and controls", () => {
  it("creates an accessible active marker", () => {
    const onSelect = vi.fn();
    const element = createPlaceMarkerElement(nearbyPlace, {
      selected: true,
      hovered: false,
      onSelect,
    });
    expect(element).toHaveAttribute("aria-label", `Xem ${nearbyPlace.place.name} trên bản đồ`);
    expect(element.dataset.active).toBe("true");
    element.click();
    expect(onSelect).toHaveBeenCalledWith(nearbyPlace.place.id);
  });

  it("creates popup content with address, distance and detail link", () => {
    const popup = createMapPopupElement(nearbyPlace);
    expect(popup).toHaveTextContent(nearbyPlace.place.address);
    expect(popup).toHaveTextContent(/km|m/);
    expect(popup.querySelector("a")).toHaveAttribute("href", `/places/${nearbyPlace.place.slug}`);
  });

  it("keeps a result-compatible fallback when the key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_VIETMAP_API_KEY", "");
    render(<VietMapLoader {...props} />);
    expect(screen.getByText(/chưa cấu hình khóa VietMap/i)).toBeInTheDocument();
  });

  it("renders map controls and triggers zoom and location actions", async () => {
    const user = userEvent.setup();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onRequestCurrentLocation = vi.fn();

    render(
      <MapControls
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onRequestCurrentLocation={onRequestCurrentLocation}
        locating={false}
      />
    );

    await user.click(screen.getByRole("button", { name: /phóng to/i }));
    expect(onZoomIn).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /thu nhỏ/i }));
    expect(onZoomOut).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /vị trí của tôi/i }));
    expect(onRequestCurrentLocation).toHaveBeenCalled();
  });
});

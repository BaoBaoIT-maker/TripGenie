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
    const { container, button } = createPlaceMarkerElement(nearbyPlace, {
      selected: true,
      hovered: false,
      onSelect,
    });
    expect(container.dataset.placeId).toBe(nearbyPlace.place.id);
    expect(button).toHaveAttribute("aria-label", `Xem ${nearbyPlace.place.name} trên bản đồ`);
    expect(button.dataset.active).toBe("true");
    button.click();
    expect(onSelect).toHaveBeenCalledWith(nearbyPlace.place.id);
  });

  it("creates popup content with address, distance and detail link", () => {
    const popup = createMapPopupElement(nearbyPlace);
    expect(popup).toHaveTextContent(nearbyPlace.place.address);
    expect(popup).toHaveTextContent(/km|m/);
    expect(popup.querySelector("a")).toHaveAttribute("href", `/places/${nearbyPlace.place.slug}`);
  });

  it("renders routing popup actions without 'Đích mới' when place is not yet in route", () => {
    const onAddStopToRoute = vi.fn();
    const onSetOrigin = vi.fn();
    const onRequestDirections = vi.fn();

    const popup = createMapPopupElement(
      nearbyPlace,
      vi.fn(),
      onRequestDirections,
      {
        isRoutingActive: true,
        routeStopIndex: -1,
        onAddStopToRoute,
        onSetOrigin,
      }
    );

    expect(popup).toHaveTextContent("Thêm chặng");
    expect(popup).toHaveTextContent("Điểm xuất phát");
    expect(popup).not.toHaveTextContent("Đích mới");

    const buttons = Array.from(popup.querySelectorAll("button"));
    const addStopBtn = buttons.find((b) => b.textContent?.includes("Thêm chặng"));
    const originBtn = buttons.find((b) => b.textContent?.includes("Điểm xuất phát"));

    addStopBtn?.click();
    expect(onAddStopToRoute).toHaveBeenCalledWith(nearbyPlace.place);

    originBtn?.click();
    expect(onSetOrigin).toHaveBeenCalledWith(nearbyPlace.place);
  });

  it("renders active stop badge and 'Gỡ chặng' button when place is already in route", () => {
    const onAddStopToRoute = vi.fn();
    const onRemoveStopFromRoute = vi.fn();
    const onSetOrigin = vi.fn();

    const popup = createMapPopupElement(
      nearbyPlace,
      vi.fn(),
      vi.fn(),
      {
        isRoutingActive: true,
        routeStopIndex: 2, // Stop C (#3)
        onAddStopToRoute,
        onRemoveStopFromRoute,
        onSetOrigin,
      }
    );

    expect(popup).toHaveTextContent("Đang là Chặng C (#3)");
    expect(popup).toHaveTextContent("Gỡ chặng");
    expect(popup).not.toHaveTextContent("Thêm chặng");
    expect(popup).not.toHaveTextContent("Đích mới");

    const buttons = Array.from(popup.querySelectorAll("button"));
    const removeBtn = buttons.find((b) => b.textContent?.includes("Gỡ chặng"));
    removeBtn?.click();
    expect(onRemoveStopFromRoute).toHaveBeenCalledWith(nearbyPlace.place.id);
  });

  it("renders 'Thêm lịch trình' button in popup and invokes onAddToItinerary", () => {
    const onAddToItinerary = vi.fn();
    const onSetOrigin = vi.fn();

    const popup = createMapPopupElement(
      nearbyPlace,
      vi.fn(),
      vi.fn(),
      {
        isRoutingActive: false,
        onAddToItinerary,
        onSetOrigin,
      }
    );

    expect(popup).toHaveTextContent("Thêm lịch trình");
    const buttons = Array.from(popup.querySelectorAll("button"));
    const addItineraryBtn = buttons.find((b) =>
      b.textContent?.includes("Thêm lịch trình")
    );
    expect(addItineraryBtn).toBeDefined();
    addItineraryBtn?.click();
    expect(onAddToItinerary).toHaveBeenCalledWith(nearbyPlace.place);
  });

  it("renders accessible loading skeleton while VietMapLoader initializes", () => {
    render(<VietMapLoader {...props} />);
    expect(screen.getByLabelText("Đang tải bản đồ")).toBeInTheDocument();
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

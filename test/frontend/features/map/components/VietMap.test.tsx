import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPlaceMarkerElement } from "@/components/map/PlaceMarker";
import { createMapPopupElement } from "@/components/map/MapPopup";
import { VietMapLoader } from "@/components/map/VietMapLoader";
import { MapControls } from "@/components/map/MapControls";
import { RouteControlPanel } from "@/components/map/RouteControlPanel";
import { computeRouteFitPadding } from "@/features/map/map-config";
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

  it("localizes marker aria-label and popup actions in English when locale='en'", () => {
    const { button } = createPlaceMarkerElement(nearbyPlace, { locale: "en" });
    expect(button).toHaveAttribute("aria-label", `View ${nearbyPlace.place.name} on map`);

    const popup = createMapPopupElement(nearbyPlace, vi.fn(), vi.fn(), {
      locale: "en",
      isRoutingActive: true,
      routeStopIndex: 1,
      onRemoveStopFromRoute: vi.fn(),
      onSetOrigin: vi.fn(),
    });
    expect(popup).toHaveTextContent("Stop B (#2)");
    expect(popup).toHaveTextContent("Remove");
    expect(popup).toHaveTextContent("Set start");
    expect(popup).toHaveTextContent("View details");
  });

  it("omits dead GPS button when onRequestCurrentLocation is undefined and toggles desktop Layers tray via click & Escape", async () => {
    const user = userEvent.setup();
    const onChangeTheme = vi.fn();
    render(
      <MapControls
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        locating={false}
        currentTheme="bright"
        onChangeTheme={onChangeTheme}
      />
    );

    expect(screen.queryByRole("button", { name: /vị trí của tôi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();

    // Desktop thumbnail trigger shows satellite preview image when currently in bright mode
    const layerTriggers = screen.getAllByRole("button", { name: /chọn loại bản đồ/i });
    const desktopTrigger = layerTriggers[layerTriggers.length - 1];
    expect(desktopTrigger.querySelector("img")?.getAttribute("src")).toBe(
      "/images/map/layer-satellite.jpg"
    );

    // Click to open layer choices (Sáng / Vệ tinh, never Tối)
    await user.click(desktopTrigger);
    expect(screen.getByRole("radio", { name: /sáng/i })).toHaveAttribute("aria-checked", "true");
    const satRadio = screen.getByRole("radio", { name: /vệ tinh/i });
    expect(satRadio).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("radio", { name: /tối/i })).not.toBeInTheDocument();

    await user.click(satRadio);
    expect(onChangeTheme).toHaveBeenCalledWith("satellite");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();

    // Reopen and close with Escape for keyboard accessibility
    await user.click(desktopTrigger);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("renders RouteControlPanel with Font Awesome vehicle icons (no emojis) and interactive stop controls", async () => {
    const user = userEvent.setup();
    const onToggleCollapse = vi.fn();
    const onChangeMode = vi.fn();
    const onMoveStop = vi.fn();
    const onSwapRoute = vi.fn();
    const onClearRoute = vi.fn();

    const { container } = render(
      <RouteControlPanel
        routeStops={[
          { id: "stop-a", name: "Cầu Rồng", coordinate: { latitude: 16.0611, longitude: 108.2275 } },
          { id: "stop-b", name: "Biển Mỹ Khê", coordinate: { latitude: 16.0678, longitude: 108.2467 } },
        ]}
        routeMode="motorcycle"
        routeResult={{
          distanceKm: 3.4,
          durationMinutes: 9,
          geometry: { type: "LineString", coordinates: [[108.2275, 16.0611], [108.2467, 16.0678]] },
          mode: "motorcycle",
          origin: { latitude: 16.0611, longitude: 108.2275 },
          destination: { latitude: 16.0678, longitude: 108.2467 },
        }}
        routeLoading={false}
        locale="vi"
        isCollapsed={false}
        mapContainerRef={{ current: null }}
        onToggleCollapse={onToggleCollapse}
        onChangeMode={onChangeMode}
        onMoveStop={onMoveStop}
        onRemoveStop={vi.fn()}
        onUseMyLocationAsOrigin={vi.fn()}
        onSwapRoute={onSwapRoute}
        onClearRoute={onClearRoute}
      />
    );

    expect(container.textContent).not.toMatch(/🏍️|🚗|🚶/);
    expect(container.querySelector("i.fa-motorcycle")).toBeInTheDocument();
    expect(screen.getByText("Cầu Rồng")).toBeInTheDocument();
    expect(screen.getByText("Biển Mỹ Khê")).toBeInTheDocument();
    expect(screen.getByText(/3,4 km/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ô tô/i }));
    expect(onChangeMode).toHaveBeenCalledWith("driving");

    await user.click(screen.getByRole("button", { name: /đổi chiều/i }));
    expect(onSwapRoute).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /thu gọn bảng/i }));
    expect(onToggleCollapse).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("button", { name: /đóng chỉ đường/i }));
    expect(onClearRoute).toHaveBeenCalled();
  });

  it("avoids invalid py-0.2 class and double outer border on map popup container", () => {
    const popup = createMapPopupElement(nearbyPlace);
    expect(popup.className).not.toContain("border-slate-200/80");
    expect(popup.className).not.toContain("rounded-2xl");
    expect(popup.innerHTML).not.toContain("py-0.2");
  });

  it("computes route fitBounds left padding to clear expanded RouteControlPanel on desktop", () => {
    expect(computeRouteFitPadding(1000, true).left).toBe(408);
    expect(computeRouteFitPadding(768, true).left).toBe(346);
    expect(computeRouteFitPadding(1000, false).left).toBe(60);
    expect(computeRouteFitPadding(390, true).left).toBe(60);
  });
});

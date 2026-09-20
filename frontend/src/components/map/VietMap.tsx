"use client";

import { useEffect, useRef, useState } from "react";
import vietmapgl from "@vietmap/vietmap-gl-js";
import type { VietMapProps } from "@/features/map/types";
import { DEFAULT_MAP_ZOOM } from "@/features/map/map-config";
import { createPlaceMarkerElement } from "./PlaceMarker";
import { createMapPopupElement } from "./MapPopup";
import { MapControls } from "./MapControls";

export default function VietMap({
  places,
  center,
  radiusKm,
  selectedPlaceId,
  hoveredPlaceId,
  onSelectPlace,
  onViewportChange,
  onRequestCurrentLocation,
  locating,
}: VietMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<vietmapgl.Map | null>(null);
  const markersRef = useRef<vietmapgl.Marker[]>([]);
  const popupRef = useRef<vietmapgl.Popup | null>(null);
  const [hasError, setHasError] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY || "";
  const style = `https://maps.vietmap.vn/maps/styles/lm/style.json?apikey=${encodeURIComponent(apiKey)}`;

  const onViewportChangeRef = useRef(onViewportChange);
  const initialCenterRef = useRef(center);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  // Map initialization
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const map = new vietmapgl.Map({
        container: containerRef.current,
        style,
        center: [initialCenterRef.current.longitude, initialCenterRef.current.latitude],
        zoom: DEFAULT_MAP_ZOOM,
      });

      map.on("moveend", () => {
        const c = map.getCenter();
        onViewportChangeRef.current({
          latitude: c.lat,
          longitude: c.lng,
          zoom: map.getZoom(),
        });
      });

      map.on("error", (e) => {
        console.error("VietMap error:", e);
        setTimeout(() => setHasError(true), 0);
      });

      mapRef.current = map;

      return () => {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        map.remove();
        mapRef.current = null;
      };
    } catch (err) {
      console.error("Failed to initialize VietMap:", err);
      setTimeout(() => setHasError(true), 0);
    }
  }, [style]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const newMarkers: vietmapgl.Marker[] = [];
    places.forEach((item: any) => {
      const place = "place" in item ? item.place : item;
      const isSelected = place.id === selectedPlaceId;
      const isHovered = place.id === hoveredPlaceId;

      const el = createPlaceMarkerElement(item, {
        selected: isSelected,
        hovered: isHovered,
        onSelect: onSelectPlace,
      });

      const marker = new vietmapgl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);

      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;
  }, [places, selectedPlaceId, hoveredPlaceId, onSelectPlace]);

  // Fit bounds when center, radius or place list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = new vietmapgl.LngLatBounds(
      [center.longitude, center.latitude],
      [center.longitude, center.latitude]
    );
    places.forEach((item: any) => {
      const place = "place" in item ? item.place : item;
      bounds.extend([place.longitude, place.latitude]);
    });

    map.fitBounds(bounds, {
      padding: 72,
      maxZoom: 15,
      duration: 500,
    });
  }, [center.latitude, center.longitude, radiusKm, places]);

  // Handle selected place popup and camera flyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (!selectedPlaceId) return;

    const selectedItem = places.find((item: any) => {
      const place = "place" in item ? item.place : item;
      return place.id === selectedPlaceId;
    });
    if (!selectedItem) return;

    const place = "place" in selectedItem ? selectedItem.place : selectedItem;

    map.flyTo({
      center: [place.longitude, place.latitude],
      zoom: 15,
      duration: 600,
    });

    const popupEl = createMapPopupElement(selectedItem);
    const popup = new vietmapgl.Popup({
      offset: 24,
      closeButton: true,
      closeOnClick: false,
    })
      .setLngLat([place.longitude, place.latitude])
      .setDOMContent(popupEl)
      .addTo(map);

    popup.on("close", () => {
      onSelectPlace(null);
    });

    popupRef.current = popup;
  }, [selectedPlaceId, places, onSelectPlace]);

  return (
    <div className="relative h-[430px] w-full overflow-hidden rounded-2xl border bg-muted/20 md:h-[520px]">
      <div ref={containerRef} className="h-full w-full" />
      <MapControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onRequestCurrentLocation={onRequestCurrentLocation}
        locating={locating}
      />
      <div className="sr-only" aria-live="polite">
        {`Hiển thị ${places.length} địa điểm trong bán kính ${radiusKm} km`}
      </div>
      {hasError && (
        <div
          role="alert"
          className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 p-6 text-center backdrop-blur-sm"
        >
          <p className="text-sm font-medium text-destructive">
            Không thể tải bản đồ. Danh sách địa điểm vẫn có thể sử dụng.
          </p>
        </div>
      )}
    </div>
  );
}

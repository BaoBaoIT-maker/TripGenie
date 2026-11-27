"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAP_LAYER_OPTIONS } from "@/features/map/map-config";
import { useI18n } from "@/i18n";

export type MapStyleTheme = "bright" | "satellite";
type DesktopMenuMode = "closed" | "hover" | "pinned";

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRequestCurrentLocation?: () => void;
  locating: boolean;
  currentTheme?: MapStyleTheme;
  onChangeTheme?: (theme: MapStyleTheme) => void;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onRequestCurrentLocation,
  locating,
  currentTheme = "bright",
  onChangeTheme,
}: MapControlsProps) {
  const { t } = useI18n();
  const [desktopMenuMode, setDesktopMenuMode] = useState<DesktopMenuMode>("closed");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const desktopLayersRef = useRef<HTMLDivElement>(null);
  const mobileLayersRef = useRef<HTMLDivElement>(null);
  const isDesktopMenuOpen = desktopMenuMode !== "closed";

  useEffect(() => {
    if (!isDesktopMenuOpen && !isMobileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (desktopLayersRef.current && !desktopLayersRef.current.contains(target)) {
        setDesktopMenuMode("closed");
      }
      if (mobileLayersRef.current && !mobileLayersRef.current.contains(target)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDesktopMenuMode("closed");
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDesktopMenuOpen, isMobileMenuOpen]);

  const previewOption =
    MAP_LAYER_OPTIONS.find((opt) => opt.id !== currentTheme) ?? MAP_LAYER_OPTIONS[0];

  const renderLayerOptions = (onSelectComplete: () => void) => (
    <div
      role="radiogroup"
      aria-label={t("map.controls.layersTitle")}
      className="flex items-center gap-1.5 rounded-xl border border-[#D5E2F0] bg-white p-1.5 shadow-xl"
    >
      {MAP_LAYER_OPTIONS.map((option) => {
        const isActive = currentTheme === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={t(option.labelKey)}
            title={t(option.titleKey)}
            onClick={() => {
              onChangeTheme?.(option.id);
              onSelectComplete();
            }}
            className={`w-14 flex flex-col items-center gap-1 rounded-lg border p-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0194F3] ${
              isActive
                ? "border-[#0194F3] bg-[#F0F7FF] text-[#0194F3]"
                : "border-transparent bg-white text-[#10243A] hover:bg-[#F0F7FF] hover:text-[#0194F3]"
            }`}
          >
            <div
              className={`relative w-12 h-12 overflow-hidden rounded-md border shrink-0 ${
                isActive ? "border-[#0194F3]" : "border-[#E2E8F0]"
              }`}
            >
              <img
                src={option.previewImage}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover"
              />
              {isActive && (
                <span className="absolute top-1 right-1 size-4 rounded-full bg-[#0194F3] text-white flex items-center justify-center shadow-xs">
                  <i className="fa-solid fa-check text-[9px]" aria-hidden="true" />
                </span>
              )}
            </div>
            <span className="text-[11px] font-semibold leading-tight whitespace-nowrap">
              {t(option.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Top-Right Compact Google Maps Zoom + GPS Rail (+ Mobile Layers Popover) */}
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-1.5 font-sans select-none">
        {/* Narrow Zoom In / Out Rail (32px desktop, 40px mobile) */}
        <div className="flex flex-col w-10 sm:w-8 overflow-hidden rounded-lg border border-[#D5E2F0] bg-white shadow-md">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 sm:size-8 rounded-none border-b border-[#E2E8F0] text-[#10243A] hover:bg-[#F0F7FF] hover:text-[#0194F3] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0194F3] focus-visible:ring-inset"
            onClick={onZoomIn}
            aria-label={t("map.controls.zoomIn")}
            title={t("map.controls.zoomIn")}
          >
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 sm:size-8 rounded-none text-[#10243A] hover:bg-[#F0F7FF] hover:text-[#0194F3] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0194F3] focus-visible:ring-inset"
            onClick={onZoomOut}
            aria-label={t("map.controls.zoomOut")}
            title={t("map.controls.zoomOut")}
          >
            <i className="fa-solid fa-minus text-xs" aria-hidden="true" />
          </Button>
        </div>

        {/* GPS Current Location (omitted automatically when map does not supply a handler) */}
        {onRequestCurrentLocation && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-10 sm:size-8 rounded-lg border border-[#D5E2F0] bg-white shadow-md hover:bg-[#F0F7FF] hover:border-[#D0E7FF] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0194F3]"
            onClick={onRequestCurrentLocation}
            disabled={locating}
            aria-label={t("map.controls.myLocation")}
            title={t("map.controls.myLocation")}
          >
            {locating ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs text-[#0194F3]" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-location-crosshairs text-xs text-[#0194F3]" aria-hidden="true" />
            )}
          </Button>
        )}

        {/* Mobile-only compact Layers button (stays clear of bottom carousels & switcher) */}
        {onChangeTheme && (
          <div ref={mobileLayersRef} className="relative lg:hidden">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="size-10 rounded-lg border border-[#D5E2F0] bg-white text-[#10243A] shadow-md hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#D0E7FF] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0194F3]"
              aria-label={t("map.controls.layersTitle")}
              aria-expanded={isMobileMenuOpen}
              aria-haspopup="true"
              title={t("map.controls.layersTitle")}
            >
              <i className="fa-solid fa-layer-group text-xs" aria-hidden="true" />
            </Button>

            {isMobileMenuOpen && (
              <div className="absolute right-full top-0 pr-2 z-30">
                {renderLayerOptions(() => setIsMobileMenuOpen(false))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom-Left Google Maps Desktop Layers Thumbnail Widget (avoids bottom-right AI FAB) */}
      {onChangeTheme && (
        <div
          ref={desktopLayersRef}
          onPointerEnter={(e) => {
            if (e.pointerType !== "touch") {
              setDesktopMenuMode((m) => (m === "closed" ? "hover" : m));
            }
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "touch") {
              setDesktopMenuMode((m) => (m === "hover" ? "closed" : m));
            }
          }}
          className="hidden lg:flex items-end absolute bottom-3 left-3 z-20 font-sans select-none"
        >
          <button
            type="button"
            onClick={() => setDesktopMenuMode((m) => (m === "pinned" ? "closed" : "pinned"))}
            aria-label={t("map.controls.layersTitle")}
            aria-expanded={isDesktopMenuOpen}
            aria-haspopup="true"
            title={t("map.controls.layersTitle")}
            className="relative size-15 overflow-hidden rounded-xl border-2 border-white bg-white shadow-lg ring-1 ring-[#10243A]/15 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0194F3]"
          >
            <img
              src={previewOption.previewImage}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10243A]/85 via-[#10243A]/30 to-transparent pointer-events-none" />
            <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 text-[10px] font-bold text-white leading-none">
              <i className="fa-solid fa-layer-group text-[9px]" aria-hidden="true" />
              <span>{t("map.controls.layers")}</span>
            </span>
          </button>

          {isDesktopMenuOpen && (
            <div className="pl-2">
              {renderLayerOptions(() => setDesktopMenuMode("closed"))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

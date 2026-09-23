"use client";

import { Plus, Minus, LocateFixed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MapStyleTheme = "bright" | "dark" | "satellite";

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRequestCurrentLocation: () => void;
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
  return (
    <div className="absolute right-3 sm:right-4 top-3 sm:top-4 z-20 flex flex-col gap-2">
      {/* Zoom In / Out */}
      <div className="flex flex-col overflow-hidden rounded-xl border bg-background/95 shadow-md backdrop-blur-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 sm:size-11 rounded-none border-b hover:bg-muted/80"
          onClick={onZoomIn}
          aria-label="Phóng to"
          title="Phóng to"
        >
          <Plus className="size-4 sm:size-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 sm:size-11 rounded-none hover:bg-muted/80"
          onClick={onZoomOut}
          aria-label="Thu nhỏ"
          title="Thu nhỏ"
        >
          <Minus className="size-4 sm:size-5" />
        </Button>
      </div>

      {/* GPS Current Location */}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="size-10 sm:size-11 rounded-xl border bg-background/95 shadow-md backdrop-blur-sm hover:bg-muted/80"
        onClick={onRequestCurrentLocation}
        disabled={locating}
        aria-label="Vị trí của tôi"
        title="Vị trí của tôi"
      >
        {locating ? (
          <Loader2 className="size-4 sm:size-5 animate-spin text-primary" />
        ) : (
          <LocateFixed className="size-4 sm:size-5 text-primary" />
        )}
      </Button>

      {/* Map Style Theme Switcher */}
      {onChangeTheme && (
        <div className="flex flex-col overflow-hidden rounded-xl border border-border/80 bg-background/95 shadow-md backdrop-blur-sm p-1 gap-1">
          <button
            type="button"
            onClick={() => onChangeTheme("bright")}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              currentTheme === "bright"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title="Bản đồ Sáng Du lịch (VietMap TM @2x chính thức)"
          >
            <span>🗺️ Sáng</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTheme("dark")}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              currentTheme === "dark"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title="Bản đồ Tối Giao thông (VietMap DM @2x)"
          >
            <span>🌙 Tối</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTheme("satellite")}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              currentTheme === "satellite"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            title="Ảnh chụp vệ tinh thực địa (Esri Satellite)"
          >
            <span>🛰️ Vệ tinh</span>
          </button>
        </div>
      )}
    </div>
  );
}

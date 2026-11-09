"use client";

import { Plus, Minus, Loader2 } from "lucide-react";
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
    <div className="absolute right-3 sm:right-4 top-3 sm:top-4 z-20 flex flex-col gap-2 font-sans select-none">
      {/* Zoom In / Out */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 sm:size-10 rounded-none border-b border-slate-100 text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
          onClick={onZoomIn}
          aria-label="Phóng to"
          title="Phóng to"
        >
          <Plus className="size-4 sm:size-4.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 sm:size-10 rounded-none text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
          onClick={onZoomOut}
          aria-label="Thu nhỏ"
          title="Thu nhỏ"
        >
          <Minus className="size-4 sm:size-4.5" />
        </Button>
      </div>

      {/* GPS Current Location */}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="size-9 sm:size-10 rounded-xl border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-sm hover:bg-slate-50 cursor-pointer"
        onClick={onRequestCurrentLocation}
        disabled={locating}
        aria-label="Vị trí của tôi"
        title="Vị trí của tôi"
      >
        {locating ? (
          <Loader2 className="size-4 sm:size-4.5 animate-spin text-[#0194F3]" />
        ) : (
          <i className="fa-solid fa-location-crosshairs text-sm text-[#0194F3]" />
        )}
      </Button>

      {/* Map Style Theme Switcher */}
      {onChangeTheme && (
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-md backdrop-blur-sm p-1 gap-0.5">
          <button
            type="button"
            onClick={() => onChangeTheme("bright")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              currentTheme === "bright"
                ? "bg-[#0194F3] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            title="Bản đồ Sáng Du lịch (VietMap TM @2x chính thức)"
          >
            <i className="fa-solid fa-sun text-xs" />
            <span>Sáng</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTheme("dark")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              currentTheme === "dark"
                ? "bg-[#0194F3] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            title="Bản đồ Tối Giao thông (VietMap DM @2x)"
          >
            <i className="fa-solid fa-moon text-xs" />
            <span>Tối</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTheme("satellite")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              currentTheme === "satellite"
                ? "bg-[#0194F3] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            title="Ảnh chụp vệ tinh thực địa (Esri Satellite)"
          >
            <i className="fa-solid fa-earth-americas text-xs" />
            <span>Vệ tinh</span>
          </button>
        </div>
      )}
    </div>
  );
}

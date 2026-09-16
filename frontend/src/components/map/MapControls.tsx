"use client";

import { Plus, Minus, LocateFixed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRequestCurrentLocation: () => void;
  locating: boolean;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onRequestCurrentLocation,
  locating,
}: MapControlsProps) {
  return (
    <div className="absolute right-4 top-4 z-20 flex flex-col gap-2">
      <div className="flex flex-col overflow-hidden rounded-xl border bg-background/90 shadow-md backdrop-blur-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-none border-b hover:bg-muted/80"
          onClick={onZoomIn}
          aria-label="Phóng to"
          title="Phóng to"
        >
          <Plus className="size-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-none hover:bg-muted/80"
          onClick={onZoomOut}
          aria-label="Thu nhỏ"
          title="Thu nhỏ"
        >
          <Minus className="size-5" />
        </Button>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="size-11 rounded-xl border bg-background/90 shadow-md backdrop-blur-sm hover:bg-muted/80"
        onClick={onRequestCurrentLocation}
        disabled={locating}
        aria-label="Vị trí của tôi"
        title="Vị trí của tôi"
      >
        {locating ? (
          <Loader2 className="size-5 animate-spin text-primary" />
        ) : (
          <LocateFixed className="size-5 text-primary" />
        )}
      </Button>
    </div>
  );
}

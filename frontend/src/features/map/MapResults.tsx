"use client";

import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NearbyPlace, MapRadiusKm } from "./types";
import { MapPlaceCard } from "./MapPlaceCard";

export interface MapResultsProps {
  places: NearbyPlace[];
  radiusKm: MapRadiusKm;
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  onHoverPlace: (placeId: string | null) => void;
  onExpandRadius: () => void;
  onClearFilters: () => void;
}

export function MapResults({
  places,
  radiusKm,
  selectedPlaceId,
  hoveredPlaceId,
  onSelectPlace,
  onHoverPlace,
  onExpandRadius,
  onClearFilters,
}: MapResultsProps) {
  if (places.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/50">
          <MapPinOff className="size-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">
          Không tìm thấy địa điểm nào
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Không có địa điểm nào phù hợp trong bán kính {radiusKm} km. Bạn có thể mở rộng bán kính hoặc điều chỉnh lại bộ lọc.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onExpandRadius}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            Mở rộng đến 10 km
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearFilters}
          >
            Xóa bộ lọc
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          <span className="font-bold text-orange-600">{places.length}</span> địa điểm trong bán kính {radiusKm} km
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {places.map((nearbyPlace) => (
          <MapPlaceCard
            key={nearbyPlace.place.id}
            nearbyPlace={nearbyPlace}
            selected={nearbyPlace.place.id === selectedPlaceId}
            hovered={nearbyPlace.place.id === hoveredPlaceId}
            onSelect={onSelectPlace}
            onHover={onHoverPlace}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

import { MapPinOff, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiscoveryPlace, NearbyPlace, RadiusKm } from "./types";
import { MapPlaceCard } from "./MapPlaceCard";

export interface MapResultsProps {
  places: (DiscoveryPlace | NearbyPlace)[];
  total?: number;
  currentPage?: number;
  totalPages?: number;
  radiusKm: RadiusKm;
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  onHoverPlace: (placeId: string | null) => void;
  onExpandRadius: () => void;
  onClearFilters: () => void;
  onPageChange?: (page: number) => void;
  onOpenDetail?: (placeId: string) => void;
}

export function MapResults({
  places,
  total = places.length,
  currentPage = 1,
  totalPages = 1,
  radiusKm,
  selectedPlaceId,
  hoveredPlaceId,
  onSelectPlace,
  onHoverPlace,
  onExpandRadius,
  onClearFilters,
  onPageChange,
  onOpenDetail,
}: MapResultsProps) {
  if (places.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20">
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
            className="bg-primary text-primary-foreground hover:bg-primary/90"
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
      {/* Results Count Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Tìm thấy <span className="font-bold text-primary">{total}</span> địa điểm mẫu trong bán kính {radiusKm} km
        </p>
      </div>

      {/* 1-column list on desktop left pane */}
      <div className="flex flex-col gap-3.5">
        {places.map((item) => {
          const isNearby = "place" in item;
          const place = isNearby ? (item as NearbyPlace).place : (item as DiscoveryPlace);
          const isSelected = place.id === selectedPlaceId;
          const isHovered = place.id === hoveredPlaceId;

          return (
            <MapPlaceCard
              key={place.id}
              place={isNearby ? undefined : (item as DiscoveryPlace)}
              nearbyPlace={isNearby ? (item as NearbyPlace) : undefined}
              selected={isSelected}
              hovered={isHovered}
              onSelect={onSelectPlace}
              onHover={onHoverPlace}
              onOpenDetail={onOpenDetail}
            />
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="h-8 gap-1 text-xs"
          >
            <ChevronLeft className="size-3.5" />
            <span>Trước</span>
          </Button>
          <span className="text-xs font-medium text-muted-foreground px-2">
            Trang {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="h-8 gap-1 text-xs"
          >
            <span>Sau</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

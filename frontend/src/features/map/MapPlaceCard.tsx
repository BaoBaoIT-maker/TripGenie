"use client";

import Link from "next/link";
import Image from "next/image";
import type { NearbyPlace } from "./types";
import { formatDistanceKm } from "./lib/map-filter";
import { cn } from "@/lib/utils";

export interface MapPlaceCardProps {
  nearbyPlace: NearbyPlace;
  selected: boolean;
  hovered: boolean;
  onSelect: (placeId: string) => void;
  onHover: (placeId: string | null) => void;
}

export function MapPlaceCard({
  nearbyPlace,
  selected,
  hovered,
  onSelect,
  onHover,
}: MapPlaceCardProps) {
  const { place, distanceKm } = nearbyPlace;

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card text-card-foreground transition-all duration-200 shadow-xs",
        selected && "ring-2 ring-orange-500 shadow-md border-orange-200",
        hovered && !selected && "shadow-md -translate-y-0.5 border-orange-200/60"
      )}
      onPointerEnter={() => onHover(place.id)}
      onPointerLeave={() => onHover(null)}
    >
      <button
        type="button"
        aria-label={`Chọn ${place.name}`}
        onClick={() => onSelect(place.id)}
        onFocus={() => onHover(place.id)}
        onBlur={() => onHover(null)}
        className="flex w-full cursor-pointer items-start gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl"
      >
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {place.images?.[0] ? (
            <Image
              src={place.images[0]}
              alt={place.name}
              fill
              sizes="80px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
              Không có ảnh
            </div>
          )}
          <span className="absolute bottom-1 right-1 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
            {formatDistanceKm(distanceKm)}
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[11px] font-medium text-orange-600">
                {place.categoryLabel || place.category}
              </span>
              {place.rating ? (
                <span className="flex items-center text-[11px] font-semibold text-amber-600 shrink-0">
                  ★ {place.rating}
                </span>
              ) : null}
            </div>
            <h4 className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {place.name}
            </h4>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
              {place.address}
            </p>
          </div>

          <div className="mt-2 text-xs font-semibold text-orange-600">
            Cách bạn {formatDistanceKm(distanceKm)}
          </div>
        </div>
      </button>

      <div className="flex items-center justify-end border-t border-border/50 px-3 py-1.5 bg-muted/20">
        <Link
          href={`/places/${place.slug}`}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-orange-600 focus:text-orange-600 outline-none"
        >
          Xem chi tiết &rarr;
        </Link>
      </div>
    </div>
  );
}

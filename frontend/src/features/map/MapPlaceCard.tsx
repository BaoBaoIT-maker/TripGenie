"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Heart, Sparkles, MapPin } from "lucide-react";
import type { DiscoveryPlace, NearbyPlace } from "./types";
import { formatDistanceKm } from "./lib/map-filter";
import { cn } from "@/lib/utils";

export interface MapPlaceCardProps {
  place?: DiscoveryPlace;
  nearbyPlace?: NearbyPlace;
  selected: boolean;
  hovered: boolean;
  onSelect: (placeId: string) => void;
  onHover: (placeId: string | null) => void;
  onOpenDetail?: (placeId: string) => void;
}

export function MapPlaceCard({
  place: directPlace,
  nearbyPlace,
  selected,
  hovered,
  onSelect,
  onHover,
  onOpenDetail,
}: MapPlaceCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const place: DiscoveryPlace = directPlace || (nearbyPlace?.place as DiscoveryPlace);
  const distanceKm: number | undefined = directPlace
    ? directPlace.distanceKm
    : nearbyPlace?.distanceKm;

  if (!place) return null;

  const imageSrc = place.primaryImage || place.images?.[0];

  const handleCardClick = () => {
    onSelect(place.id);
    if (onOpenDetail) {
      onOpenDetail(place.id);
    }
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card text-card-foreground transition-all duration-200 shadow-xs hover:shadow-md",
        selected && "ring-2 ring-primary shadow-md border-primary/40",
        hovered && !selected && "shadow-md -translate-y-0.5 border-primary/30"
      )}
      onPointerEnter={() => onHover(place.id)}
      onPointerLeave={() => onHover(null)}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Xem thông tin ${place.name}`}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        onFocus={() => onHover(place.id)}
        onBlur={() => onHover(null)}
        className="flex w-full cursor-pointer items-start gap-3.5 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
      >
        {/* Thumbnail Image */}
        <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/50">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={place.name}
              fill
              sizes="96px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-muted text-muted-foreground p-1 text-center">
              <MapPin className="size-5 text-muted-foreground/60 mb-0.5" />
              <span className="text-[10px]">Chưa có ảnh</span>
            </div>
          )}

          {/* Heart favorite button */}
          <button
            type="button"
            onClick={handleHeartClick}
            aria-label="Lưu vào danh sách yêu thích"
            className="absolute top-1 right-1 z-10 p-1.5 rounded-full bg-black/50 text-white/80 hover:text-red-400 hover:bg-black/70 backdrop-blur-xs transition-colors"
          >
            <Heart className={`size-3.5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
          </button>

          {/* Distance Badge */}
          {distanceKm !== undefined && (
            <span className="absolute bottom-1 right-1 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
              {formatDistanceKm(distanceKm)}
            </span>
          )}
        </div>

        {/* Info Column */}
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            {/* Badges row: Category, AI score, Open status */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {place.categoryLabel || place.category}
              </span>

              {place.demoSimilarityScore && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                  <Sparkles className="size-2.5 text-amber-500" />
                  <span>Phù hợp: {place.demoSimilarityScore}%</span>
                </span>
              )}

              {place.isOpenNow === true && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Đang mở
                </span>
              )}
              {place.isOpenNow === false && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  Đóng cửa
                </span>
              )}
              {place.priceLevel && (
                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  {place.priceLevel === 1 && "≤ 100k đ"}
                  {place.priceLevel === 2 && "100k - 300k đ"}
                  {place.priceLevel === 3 && "300k - 800k đ"}
                  {place.priceLevel === 4 && "> 800k đ"}
                </span>
              )}
            </div>

            {/* Place Title */}
            <h4 className="mt-1 truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              {place.name}
            </h4>

            {/* Rating and Reviews */}
            {place.rating && (
              <div className="mt-0.5 flex items-center gap-1 text-xs">
                <span className="flex items-center gap-0.5 font-semibold text-amber-600">
                  <Star className="size-3 fill-amber-500 text-amber-500" />
                  {place.rating}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  ({place.reviewCount} đánh giá)
                </span>
              </div>
            )}

            {/* Address */}
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {place.address}
            </p>
          </div>

          {/* Bottom Action Row */}
          <div className="mt-2 flex items-center justify-between pt-1 text-xs">
            {distanceKm !== undefined ? (
              <span className="text-primary font-medium text-[11px]">
                Cách bạn {formatDistanceKm(distanceKm)}
              </span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
              className="text-xs font-semibold text-primary hover:underline outline-none"
            >
              Xem chi tiết &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

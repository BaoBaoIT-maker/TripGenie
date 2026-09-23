"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark, MapPin, Sparkles, Heart, Camera, UploadCloud } from "lucide-react";
import { Place } from "@/types/place";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/common/RatingStars";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { routingService } from "@/services/routing.service";

interface PlaceCardProps {
  place: Place;
  className?: string;
  onContributePhoto?: (place: Place) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  onCardClick?: (e: React.MouseEvent, place: Place) => void;
  isSelected?: boolean;
}

export function PlaceCard({
  place,
  className,
  onContributePhoto,
  userLocation,
  onCardClick,
  isSelected,
}: PlaceCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Compute direct distance if user location is available
  const distanceKm = useMemo(() => {
    if (!userLocation || !place.latitude || !place.longitude) return null;
    return routingService.calculateDirectDistanceKm(userLocation, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
  }, [userLocation, place.latitude, place.longitude]);

  const toggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
    if (!isBookmarked) {
      toast.success(`Đã lưu "${place.name}" vào Bộ sưu tập!`);
    } else {
      toast.info(`Đã bỏ lưu "${place.name}".`);
    }
  };

  const handleCardInteraction = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    if (onCardClick) {
      onCardClick(e, place);
    }
  };

  return (
    <div
      onClick={handleCardInteraction}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md cursor-pointer",
        isSelected
          ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg"
          : "border-border/80",
        className
      )}
    >
      {/* Card Image Wrapper */}
      <Link
        href={`/places/${place.slug}`}
        onClick={handleCardInteraction}
        className="relative block h-44 sm:h-48 w-full overflow-hidden bg-muted"
      >
        {place.coverImage && !imgError ? (
          <>
            <Image
              src={place.coverImage}
              alt={place.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
            {/* Gradient Overlay for Top Badges */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
          </>
        ) : (
          /* Neutral Graphic Placeholder (TripAdvisor / Google Maps pattern) */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-muted/50 text-center transition-colors group-hover:bg-muted/70">
            <div className="size-10 rounded-full bg-background/80 shadow-xs flex items-center justify-center text-muted-foreground/80 mb-1.5">
              <Camera className="size-5" />
            </div>
            <span className="text-xs font-semibold text-foreground/85">
              Chưa có ảnh thực tế
            </span>
            <span className="text-[11px] text-muted-foreground line-clamp-1">
              Hãy là người đầu tiên chia sẻ
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContributePhoto?.(place);
              }}
              className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-background/90 hover:bg-background border border-border/80 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-xs transition-colors"
            >
              <UploadCloud className="size-3 text-primary" />
              <span>Đóng góp ảnh</span>
            </button>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <Badge
              variant="secondary"
              className="bg-background/90 text-foreground backdrop-blur-md text-[11px] font-semibold py-0.5 px-2.5 shadow-xs"
            >
              {place.categoryLabel}
            </Badge>

            {place.matchScore && (
              <Badge className="bg-primary/95 text-primary-foreground backdrop-blur-md text-[11px] font-bold py-0.5 px-2 shadow-xs gap-1">
                <Sparkles className="size-3" />
                <span>{place.matchScore}% Phù hợp</span>
              </Badge>
            )}
          </div>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={toggleBookmark}
            className={cn(
              "pointer-events-auto flex size-8.5 items-center justify-center rounded-full backdrop-blur-md transition-transform active:scale-90 focus:outline-none",
              isBookmarked
                ? "bg-rose-500 text-white shadow-md"
                : "bg-background/80 text-foreground hover:bg-background shadow-xs"
            )}
            aria-label="Lưu địa điểm"
          >
            {isBookmarked ? (
              <Heart className="size-4 fill-current" />
            ) : (
              <Bookmark className="size-4" />
            )}
          </button>
        </div>

        {/* Bottom Image Info: Price, City & Distance */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-1.5 text-white drop-shadow-sm">
            <div className="flex items-center gap-1">
              <MapPin className="size-3.5 text-primary" />
              <span>{place.city}</span>
            </div>
            {distanceKm !== null && distanceKm > 0 && (
              <span className="rounded-md bg-black/65 text-white font-semibold px-1.5 py-0.5 backdrop-blur-xs text-[10px] border border-white/20 shadow-2xs">
                📍 ~{routingService.formatDistanceKm(distanceKm)}
              </span>
            )}
          </div>
          {place.priceRangeText ? (
            <span className="rounded-md bg-black/60 text-white px-2 py-0.5 backdrop-blur-xs text-[11px]">
              {place.priceRangeText}
            </span>
          ) : null}
        </div>
      </Link>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5 justify-between space-y-3">
        <div className="space-y-1.5">
          <Link href={`/places/${place.slug}`} onClick={handleCardInteraction}>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-1">
              {place.name}
            </h3>
          </Link>

          {place.tagline && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {place.tagline}
            </p>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          {place.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Footer info: Rating & Reviews */}
        <div className="flex items-center justify-between pt-2 border-t border-border/70 text-xs">
          {place.rating > 0 ? (
            <RatingStars
              rating={place.rating}
              showValue
              reviewCount={place.reviewCount}
              size="sm"
            />
          ) : (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Mới • Chưa có đánh giá
            </span>
          )}

          <Link
            href={`/places/${place.slug}`}
            onClick={handleCardInteraction}
            className="font-semibold text-primary hover:underline text-xs"
          >
            Chi tiết →
          </Link>
        </div>
      </div>
    </div>
  );
}

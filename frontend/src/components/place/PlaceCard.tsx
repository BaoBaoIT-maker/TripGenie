"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark, MapPin, Sparkles, Heart } from "lucide-react";
import { Place } from "@/types/place";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/common/RatingStars";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlaceCardProps {
  place: Place;
  className?: string;
}

export function PlaceCard({
  place,
  className,
}: PlaceCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);

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

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md",
        className
      )}
    >
      {/* Card Image Wrapper */}
      <Link
        href={`/places/${place.slug}`}
        className="relative block h-44 sm:h-48 w-full overflow-hidden bg-muted"
      >
        <Image
          src={place.coverImage}
          alt={place.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient Overlay for Top Badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
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
              "flex size-8.5 items-center justify-center rounded-full backdrop-blur-md transition-transform active:scale-90 focus:outline-none",
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

        {/* Bottom Image Info: Price & City */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium">
          <div className="flex items-center gap-1">
            <MapPin className="size-3.5 text-primary" />
            <span className="drop-shadow-sm">{place.city}</span>
          </div>
          <span className="rounded-md bg-black/50 px-2 py-0.5 backdrop-blur-xs text-[11px]">
            {place.priceRangeText}
          </span>
        </div>
      </Link>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5 justify-between space-y-3">
        <div className="space-y-1.5">
          <Link href={`/places/${place.slug}`}>
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
          <RatingStars
            rating={place.rating}
            showValue
            reviewCount={place.reviewCount}
            size="sm"
          />

          <Link
            href={`/places/${place.slug}`}
            className="font-semibold text-primary hover:underline text-xs"
          >
            Chi tiết →
          </Link>
        </div>
      </div>
    </div>
  );
}

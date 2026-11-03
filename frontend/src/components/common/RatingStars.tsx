"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number; // 0 - 5
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showValue?: boolean;
  reviewCount?: number;
  className?: string;
}

export function RatingStars({
  rating,
  maxRating = 5,
  size = "md",
  interactive = false,
  onRatingChange,
  showValue = false,
  reviewCount,
  className,
}: RatingStarsProps) {
  const sizeClasses = {
    sm: "size-3.5",
    md: "size-4",
    lg: "size-5",
  };

  const starSize = sizeClasses[size];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 text-amber-500",
        className
      )}
      role={interactive ? "radiogroup" : "img"}
      aria-label={`Đánh giá ${rating} trên ${maxRating} sao`}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxRating }).map((_, index) => {
          const starValue = index + 1;
          const isFilled = rating >= starValue;
          const isHalf = !isFilled && rating >= index + 0.5;

          return (
            <button
              key={index}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onRatingChange?.(starValue)}
              className={cn(
                "relative transition-transform focus:outline-none",
                interactive
                  ? "cursor-pointer hover:scale-110 focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                  : "cursor-default pointer-events-none"
              )}
              aria-label={`${starValue} sao`}
            >
              {isFilled ? (
                <Star
                  className={cn(starSize, "fill-amber-400 text-amber-400")}
                />
              ) : isHalf ? (
                <div className="relative">
                  <Star className={cn(starSize, "text-muted-foreground/30")} />
                  <div className="absolute inset-0 overflow-hidden w-1/2">
                    <Star
                      className={cn(starSize, "fill-amber-400 text-amber-400")}
                    />
                  </div>
                </div>
              ) : (
                <Star className={cn(starSize, "text-muted-foreground/30")} />
              )}
            </button>
          );
        })}
      </div>

      {showValue && (
        <span className="ml-1 text-sm font-semibold text-foreground">
          {rating.toFixed(1)}
        </span>
      )}

      {reviewCount !== undefined && (
        <span className="text-xs text-muted-foreground">
          ({reviewCount.toLocaleString()})
        </span>
      )}
    </div>
  );
}

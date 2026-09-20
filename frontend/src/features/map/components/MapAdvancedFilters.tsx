"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DiscoveryFilters, SortKey } from "../types";

export interface MapAdvancedFiltersProps {
  filters: DiscoveryFilters;
  onChange: (updated: Partial<DiscoveryFilters>) => void;
  onReset: () => void;
}

const RATING_LABELS: Record<string, string> = {
  all: "Tất cả đánh giá",
  "3": "Từ 3.0★",
  "4": "Từ 4.0★",
  "4.5": "Từ 4.5★",
};

const SORT_LABELS: Record<string, string> = {
  distance: "Gần nhất",
  rating: "Đánh giá cao",
  reviews: "Nhiều đánh giá",
};

const MIN_PRICE = 50000;
const MAX_PRICE = 1000000;
const STEP_PRICE = 25000;

export function MapAdvancedFilters({
  filters,
  onChange,
  onReset,
}: MapAdvancedFiltersProps) {
  // Local state for 60fps buttery-smooth dragging
  const [localPrice, setLocalPrice] = useState(filters.maxPriceVnd ?? MAX_PRICE);
  const [prevPropPrice, setPrevPropPrice] = useState(filters.maxPriceVnd);

  if (filters.maxPriceVnd !== prevPropPrice) {
    setPrevPropPrice(filters.maxPriceVnd);
    setLocalPrice(filters.maxPriceVnd ?? MAX_PRICE);
  }

  const flushPriceChange = useCallback(
    (val: number) => {
      if (val >= MAX_PRICE) {
        onChange({
          maxPriceVnd: null,
          priceLevels: [],
          page: 1,
        });
      } else {
        let levels: number[] = [1];
        if (val > 100000) levels = [1, 2];
        if (val > 300000) levels = [1, 2, 3];
        if (val > 800000) levels = [1, 2, 3, 4];

        onChange({
          maxPriceVnd: val,
          priceLevels: levels,
          page: 1,
        });
      }
    },
    [onChange]
  );

  // Debounced propagation to parent query while actively dragging
  useEffect(() => {
    const targetPrice = filters.maxPriceVnd ?? MAX_PRICE;
    if (localPrice === targetPrice) return;

    const timer = setTimeout(() => {
      flushPriceChange(localPrice);
    }, 120);

    return () => clearTimeout(timer);
  }, [localPrice, filters.maxPriceVnd, flushPriceChange]);

  const percentage = Math.min(
    100,
    Math.max(0, ((localPrice - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100)
  );

  const handleRatingChange = (val: string | null) => {
    if (!val || val === "all") {
      onChange({ minRating: null, page: 1 });
    } else {
      onChange({ minRating: parseFloat(val), page: 1 });
    }
  };

  const handleSortChange = (val: string | null) => {
    if (!val) return;
    onChange({ sortBy: val as SortKey, page: 1 });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
      {/* Open now toggle */}
      <button
        type="button"
        onClick={() => onChange({ openNow: !filters.openNow, page: 1 })}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition-all ${
          filters.openNow
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "border-border/70 bg-card text-muted-foreground hover:bg-muted"
        }`}
      >
        <Clock className={`size-3.5 ${filters.openNow ? "text-emerald-600" : ""}`} />
        <span>Đang mở cửa</span>
      </button>

      {/* Price Slider: Horizontal drag bar with VND amount */}
      <div className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-xs shadow-2xs">
        <span className="font-medium text-muted-foreground whitespace-nowrap">Mức giá:</span>
        <input
          type="range"
          min={MIN_PRICE}
          max={MAX_PRICE}
          step={STEP_PRICE}
          value={localPrice}
          onChange={(e) => setLocalPrice(Number(e.target.value))}
          onPointerUp={() => flushPriceChange(localPrice)}
          onTouchEnd={() => flushPriceChange(localPrice)}
          onKeyUp={() => flushPriceChange(localPrice)}
          className="price-slider-input h-2 w-28 sm:w-32 cursor-pointer appearance-none rounded-full transition-all"
          style={{
            background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${percentage}%, var(--muted) ${percentage}%, var(--muted) 100%)`,
          }}
          aria-label="Kéo chọn mức giá tối đa"
          title="Kéo chọn mức giá tối đa"
        />
        <span className="font-semibold text-primary min-w-[76px] text-right whitespace-nowrap tabular-nums">
          {localPrice >= MAX_PRICE ? "Tất cả mức" : `≤ ${localPrice.toLocaleString("vi-VN")} đ`}
        </span>
      </div>

      {/* Min rating select */}
      <div className="w-[125px]">
        <Select
          value={filters.minRating !== null ? String(filters.minRating) : "all"}
          onValueChange={handleRatingChange}
        >
          <SelectTrigger aria-label="Đánh giá" className="h-8 text-xs">
            <SelectValue placeholder="Đánh giá">
              {(val) => RATING_LABELS[val] || "Tất cả đánh giá"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả đánh giá</SelectItem>
            <SelectItem value="3">⭐ Từ 3.0★ trở lên</SelectItem>
            <SelectItem value="4">⭐ Từ 4.0★ trở lên</SelectItem>
            <SelectItem value="4.5">⭐ Từ 4.5★ xuất sắc</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort select */}
      <div className="w-[130px]">
        <Select value={filters.sortBy} onValueChange={handleSortChange}>
          <SelectTrigger aria-label="Sắp xếp theo" className="h-8 text-xs">
            <SelectValue placeholder="Sắp xếp">
              {(val) => SORT_LABELS[val] || "Gần nhất"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="distance">Gần nhất</SelectItem>
            <SelectItem value="rating">Đánh giá cao nhất</SelectItem>
            <SelectItem value="reviews">Nhiều đánh giá nhất</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reset button */}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onReset}
        className="text-muted-foreground hover:text-foreground ml-auto gap-1 text-xs"
      >
        <RotateCcw className="size-3" />
        <span>Đặt lại</span>
      </Button>
    </div>
  );
}

"use client";

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

export function MapAdvancedFilters({
  filters,
  onChange,
  onReset,
}: MapAdvancedFiltersProps) {
  // Current price ceiling (defaults to 1.000.000 for "Tất cả mức")
  const currentPrice = filters.maxPriceVnd ?? 1000000;

  const handlePriceSliderChange = (newPrice: number) => {
    if (newPrice >= 1000000) {
      onChange({
        maxPriceVnd: null,
        priceLevels: [],
        page: 1,
      });
    } else {
      let levels: number[] = [1];
      if (newPrice > 100000) levels = [1, 2];
      if (newPrice > 300000) levels = [1, 2, 3];
      if (newPrice > 800000) levels = [1, 2, 3, 4];

      onChange({
        maxPriceVnd: newPrice,
        priceLevels: levels,
        page: 1,
      });
    }
  };

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
      <div className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-xs">
        <span className="font-medium text-muted-foreground whitespace-nowrap">Giá:</span>
        <input
          type="range"
          min={50000}
          max={1000000}
          step={50000}
          value={currentPrice}
          onChange={(e) => handlePriceSliderChange(Number(e.target.value))}
          className="h-1.5 w-24 sm:w-28 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
          aria-label="Kéo chọn mức giá tối đa"
          title="Kéo chọn mức giá tối đa"
        />
        <span className="font-semibold text-primary min-w-[70px] text-right whitespace-nowrap">
          {currentPrice >= 1000000 ? "Tất cả mức" : `≤ ${currentPrice.toLocaleString("vi-VN")} đ`}
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

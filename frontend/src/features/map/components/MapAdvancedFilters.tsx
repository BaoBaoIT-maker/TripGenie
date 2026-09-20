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

export function MapAdvancedFilters({
  filters,
  onChange,
  onReset,
}: MapAdvancedFiltersProps) {
  const isPriceSelected = (level: 1 | 2 | 3) => {
    if (!filters.priceLevels || filters.priceLevels.length === 0) return false;
    if (level === 1) return filters.priceLevels.includes(1);
    if (level === 2) return filters.priceLevels.includes(2);
    if (level === 3) return filters.priceLevels.includes(3) || filters.priceLevels.includes(4);
    return false;
  };

  const togglePriceLevel = (level: 1 | 2 | 3) => {
    const current = new Set<number>(filters.priceLevels || []);
    if (level === 1) {
      if (current.has(1)) current.delete(1);
      else current.add(1);
    } else if (level === 2) {
      if (current.has(2)) current.delete(2);
      else current.add(2);
    } else if (level === 3) {
      if (current.has(3) || current.has(4)) {
        current.delete(3);
        current.delete(4);
      } else {
        current.add(3);
        current.add(4);
      }
    }
    onChange({
      priceLevels: Array.from(current),
      page: 1,
    });
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

      {/* Budget bands: $, $$, $$$ */}
      <div className="inline-flex items-center rounded-lg border border-border/70 bg-card p-0.5">
        <span className="px-2 font-medium text-muted-foreground">Giá:</span>
        <button
          type="button"
          onClick={() => togglePriceLevel(1)}
          className={`rounded px-2 py-1 font-semibold transition-all ${
            isPriceSelected(1)
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Bình dân"
        >
          $
        </button>
        <button
          type="button"
          onClick={() => togglePriceLevel(2)}
          className={`rounded px-2 py-1 font-semibold transition-all ${
            isPriceSelected(2)
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Vừa phải"
        >
          $$
        </button>
        <button
          type="button"
          onClick={() => togglePriceLevel(3)}
          className={`rounded px-2 py-1 font-semibold transition-all ${
            isPriceSelected(3)
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Cao cấp"
        >
          $$$
        </button>
      </div>

      {/* Min rating select */}
      <div className="w-[115px]">
        <Select
          value={filters.minRating !== null ? String(filters.minRating) : "all"}
          onValueChange={handleRatingChange}
        >
          <SelectTrigger aria-label="Đánh giá" className="h-8 text-xs">
            <SelectValue placeholder="Đánh giá" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi đánh giá</SelectItem>
            <SelectItem value="3">⭐ 3.0+ trở lên</SelectItem>
            <SelectItem value="4">⭐ 4.0+ trở lên</SelectItem>
            <SelectItem value="4.5">⭐ 4.5+ xuất sắc</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort select */}
      <div className="w-[160px]">
        <Select value={filters.sortBy} onValueChange={handleSortChange}>
          <SelectTrigger aria-label="Sắp xếp theo" className="h-8 text-xs">
            <SelectValue placeholder="Sắp xếp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="distance">Gần vị trí nhất</SelectItem>
            <SelectItem value="rating">Đánh giá cao nhất</SelectItem>
            <SelectItem value="reviews">Nhiều nhận xét nhất</SelectItem>
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

"use client";

import { Search, LocateFixed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MapFilters as MapFiltersType, MapRadiusKm, PlaceCategory } from "./types";
import { MAP_RADIUS_OPTIONS } from "./types";
import { CITY_CENTERS } from "./map-config";

export interface MapFiltersProps {
  filters: MapFiltersType;
  onChange: (filters: MapFiltersType) => void;
  onUseCurrentLocation: () => void;
  locating: boolean;
}

const CATEGORY_OPTIONS: { value: PlaceCategory | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "cafe", label: "Cà phê" },
  { value: "restaurant", label: "Nhà hàng" },
  { value: "sightseeing", label: "Tham quan" },
  { value: "nature", label: "Thiên nhiên" },
  { value: "entertainment", label: "Giải trí" },
  { value: "culture", label: "Văn hóa" },
  { value: "nightlife", label: "Về đêm" },
  { value: "relaxation", label: "Thư giãn" },
];

export function MapFilters({
  filters,
  onChange,
  onUseCurrentLocation,
  locating,
}: MapFiltersProps) {
  const handleCityChange = (city: string | null) => {
    if (!city) return;
    if (city === "all") {
      onChange({ ...filters, city: "all" });
    } else if (city in CITY_CENTERS) {
      onChange({
        ...filters,
        ...CITY_CENTERS[city as keyof typeof CITY_CENTERS],
        city,
      });
    }
  };

  const handleRadiusChange = (radius: MapRadiusKm) => {
    onChange({ ...filters, maxDistanceKm: radius });
  };

  const handleCategoryChange = (category: PlaceCategory | "all") => {
    onChange({ ...filters, category });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      {/* Top row: search input, city select, current location */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="map-keyword-search" className="sr-only">
            Tìm địa điểm
          </label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="map-keyword-search"
            type="search"
            placeholder="Tìm theo tên, địa chỉ, loại hình..."
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={filters.city} onValueChange={handleCityChange}>
            <SelectTrigger aria-label="Thành phố" className="w-[160px]">
              <SelectValue placeholder="Chọn thành phố" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả thành phố</SelectItem>
              <SelectItem value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</SelectItem>
              <SelectItem value="Đà Lạt">Đà Lạt</SelectItem>
              <SelectItem value="Ninh Bình">Ninh Bình</SelectItem>
              <SelectItem value="Phú Quốc">Phú Quốc</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onUseCurrentLocation}
            disabled={locating}
            className="gap-1.5 shrink-0"
            aria-label="Vị trí của tôi"
            title="Sử dụng vị trí hiện tại"
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <LocateFixed className="size-4 text-primary" />
            )}
            <span className="hidden md:inline text-xs font-medium">Vị trí của tôi</span>
          </Button>
        </div>
      </div>

      {/* Middle row: Radius options */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
        <span className="text-xs font-medium text-muted-foreground mr-1">Bán kính:</span>
        <div
          role="group"
          aria-label="Bán kính"
          className="flex flex-wrap items-center gap-1.5"
        >
          {MAP_RADIUS_OPTIONS.map((radius) => {
            const isSelected = filters.maxDistanceKm === radius;
            return (
              <Button
                key={radius}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="xs"
                aria-label={`Trong bán kính ${radius} km`}
                onClick={() => handleRadiusChange(radius)}
                className={
                  isSelected
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-xs"
                    : "hover:bg-muted font-normal"
                }
              >
                {`${radius} km`}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Bottom row: Category chips */}
      <div
        role="group"
        aria-label="Danh mục"
        className="flex flex-wrap items-center gap-1.5 pt-1 border-t"
      >
        {CATEGORY_OPTIONS.map(({ value, label }) => {
          const isSelected = filters.category === value;
          return (
            <Button
              key={value}
              type="button"
              variant={isSelected ? "secondary" : "ghost"}
              size="xs"
              onClick={() => handleCategoryChange(value)}
              className={`rounded-full px-3 text-xs transition-colors ${
                isSelected
                  ? "bg-primary/15 text-primary hover:bg-primary/25 dark:bg-primary/25 dark:text-primary font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useTransition } from "react";
import { Search, LocateFixed, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DiscoveryArea,
  DiscoveryCategory,
  DiscoveryFilters,
  RadiusKm,
  SearchMode,
} from "./types";
import { MAP_RADIUS_OPTIONS, DEFAULT_MAP_CENTER } from "./map-config";
import { MapSearchTabs } from "./components/MapSearchTabs";
import { MapQuickCategories } from "./components/MapQuickCategories";
import { MapAdvancedFilters } from "./components/MapAdvancedFilters";

export interface MapFiltersProps {
  filters: DiscoveryFilters;
  areas?: DiscoveryArea[];
  categories?: DiscoveryCategory[];
  onChange: (filters: DiscoveryFilters) => void;
  onUseCurrentLocation: () => void;
  locating: boolean;
}

export function MapFilters({
  filters,
  areas = [],
  categories = [],
  onChange,
  onUseCurrentLocation,
  locating,
}: MapFiltersProps) {
  const [keywordInput, setKeywordInput] = useState(filters.keyword || "");
  const [prevKeyword, setPrevKeyword] = useState(filters.keyword || "");
  const [, startTransition] = useTransition();

  if (filters.keyword !== prevKeyword) {
    setPrevKeyword(filters.keyword || "");
    setKeywordInput(filters.keyword || "");
  }

  // Debounce keyword update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (keywordInput !== (filters.keyword || "")) {
        startTransition(() => {
          onChange({
            ...filters,
            keyword: keywordInput,
            page: 1,
          });
        });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [keywordInput, filters, onChange]);

  const handleModeChange = (mode: SearchMode) => {
    onChange({
      ...filters,
      mode,
      page: 1,
    });
  };

  const handleAreaChange = (areaSlug: string | null) => {
    if (!areaSlug) return;
    const selectedArea = areas.find((a) => a.slug === areaSlug);
    onChange({
      ...filters,
      areaSlug,
      latitude: selectedArea?.latitude ?? DEFAULT_MAP_CENTER.latitude,
      longitude: selectedArea?.longitude ?? DEFAULT_MAP_CENTER.longitude,
      page: 1,
    });
  };

  const handleRadiusChange = (radiusKm: RadiusKm) => {
    onChange({
      ...filters,
      radiusKm,
      page: 1,
    });
  };

  const handleCategoryChange = (categorySlug: string) => {
    onChange({
      ...filters,
      categorySlug,
      page: 1,
    });
  };

  const handleResetFilters = () => {
    onChange({
      mode: "keyword",
      areaSlug: "da-nang",
      keyword: "",
      categorySlug: "all",
      radiusKm: 5,
      latitude: DEFAULT_MAP_CENTER.latitude,
      longitude: DEFAULT_MAP_CENTER.longitude,
      openNow: false,
      priceLevels: [],
      maxPriceVnd: null,
      minRating: null,
      sortBy: "distance",
      page: 1,
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      {/* Dual Search Tabs (Keyword vs AI Demo) */}
      <MapSearchTabs mode={filters.mode} onModeChange={handleModeChange} />

      {/* Main Search Row: Keyword input, Area dropdown, GPS Button */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="map-keyword-search" className="sr-only">
            Tìm địa điểm
          </label>
          {filters.mode === "ai" ? (
            <Sparkles className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-amber-500 animate-pulse" />
          ) : (
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            id="map-keyword-search"
            type="search"
            placeholder={
              filters.mode === "ai"
                ? "Nhập nhu cầu tự nhiên: 'quán cafe yên tĩnh làm việc gần biển', 'quán hải sản tươi ngon rẻ'..."
                : "Tìm theo tên địa điểm, món ăn, địa chỉ..."
            }
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            className={`pl-9 h-10 ${
              filters.mode === "ai" ? "border-amber-500/40 focus-visible:ring-amber-500" : ""
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-[170px]">
            <Select value={filters.areaSlug} onValueChange={handleAreaChange}>
              <SelectTrigger aria-label="Vùng du lịch" className="h-10 text-xs">
                <SelectValue placeholder="Chọn tỉnh / TP">
                  {(val) => areas.find((a) => a.slug === val)?.name || "Chọn tỉnh / TP"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {areas.map((area) => (
                  <SelectItem key={area.slug} value={area.slug}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant={filters.areaSlug === "quanh-toi" ? "default" : "outline"}
            size="default"
            onClick={onUseCurrentLocation}
            disabled={locating}
            className="gap-1.5 shrink-0 h-10 px-3.5"
            aria-label="Tìm quanh đây"
            title="Sử dụng GPS tìm địa điểm quanh bạn"
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin text-primary-foreground" />
            ) : (
              <LocateFixed className="size-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span className="text-xs font-semibold">Tìm quanh đây</span>
          </Button>
        </div>
      </div>

      {/* Quick Category Chips Bar */}
      <MapQuickCategories
        categories={categories}
        selectedSlug={filters.categorySlug}
        onSelectCategory={handleCategoryChange}
      />

      {/* Radius options */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs">
        <span className="font-medium text-muted-foreground mr-1">Bán kính:</span>
        <div role="group" aria-label="Bán kính" className="flex flex-wrap items-center gap-1.5">
          {MAP_RADIUS_OPTIONS.map((radius) => {
            const isSelected = filters.radiusKm === radius;
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
                    : "hover:bg-muted font-normal text-muted-foreground hover:text-foreground"
                }
              >
                {`${radius} km`}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Advanced Filters: OpenNow, Budget, Rating, Sort, Reset */}
      <MapAdvancedFilters
        filters={filters}
        onChange={(updated) => onChange({ ...filters, ...updated, page: 1 })}
        onReset={handleResetFilters}
      />
    </div>
  );
}

"use client";

import {
  Coffee,
  Utensils,
  Hotel,
  Wine,
  Cookie,
  Landmark,
  Waves,
  Compass,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { DiscoveryCategory } from "../types";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  "ca-phe": Coffee,
  "nha-hang": Utensils,
  "khach-san": Hotel,
  "bar-pub": Wine,
  "an-vat": Cookie,
  "diem-tham-quan": Landmark,
  "bai-bien": Waves,
};

export interface MapQuickCategoriesProps {
  categories: DiscoveryCategory[];
  selectedSlug?: string;
  onSelectCategory: (slug: string) => void;
}

export function MapQuickCategories({
  categories,
  selectedSlug = "all",
  onSelectCategory,
}: MapQuickCategoriesProps) {
  const isAll = !selectedSlug || selectedSlug === "all";

  return (
    <div
      role="group"
      aria-label="Danh mục nhanh"
      className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-border"
    >
      <button
        type="button"
        onClick={() => onSelectCategory("all")}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
          isAll
            ? "bg-primary text-primary-foreground shadow-xs"
            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
        }`}
      >
        <Compass className="size-3.5" />
        <span>Tất cả</span>
      </button>

      {categories.map((cat) => {
        const isSelected = selectedSlug === cat.slug;
        const IconComponent = CATEGORY_ICON_MAP[cat.slug] || MapPin;

        return (
          <button
            key={cat.slug}
            type="button"
            onClick={() => onSelectCategory(isSelected ? "all" : cat.slug)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
            }`}
          >
            <IconComponent className="size-3.5" />
            <span>{cat.name}</span>
            {typeof cat.placeCount === "number" && (
              <span
                className={`ml-0.5 text-[10px] rounded-full px-1.5 py-0.2 ${
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {cat.placeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

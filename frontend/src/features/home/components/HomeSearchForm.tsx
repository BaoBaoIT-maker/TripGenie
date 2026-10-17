"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, MapPin, Sparkles, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BackendTravelAreaItem } from "@/services/place.service";
import { buildExploreHref } from "@/features/map/lib/explore-query";
import { HOME_CONFIG } from "../config/home.config";

interface HomeSearchFormProps {
  areas: BackendTravelAreaItem[];
}

export function HomeSearchForm({ areas }: HomeSearchFormProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("all");
  const selectedArea = areas.find((area) => String(area.id) === selectedAreaId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const areaIdNum = selectedAreaId === "all" ? undefined : Number(selectedAreaId);
    const href = buildExploreHref({
      keyword: keyword.trim() || undefined,
      areaId: areaIdNum && areaIdNum > 0 ? areaIdNum : undefined,
    });
    router.push(href);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Main Search Bar Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-background/95 backdrop-blur-md p-3 sm:p-4 shadow-xl border border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        {/* Destination Select Field */}
        <div className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-secondary/60 border border-primary/20 focus-within:ring-2 focus-within:ring-ring/40 transition-colors">
          <MapPin className="size-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1 flex flex-col justify-center text-left">
            <label
              htmlFor="destination-select"
              className="sr-only"
            >
              {HOME_CONFIG.hero.areaLabel}
            </label>
            <Select
              value={selectedAreaId}
              onValueChange={(value) => setSelectedAreaId(value ?? "all")}
            >
              <SelectTrigger id="destination-select" aria-label={HOME_CONFIG.hero.areaLabel} className="w-full border-0 bg-transparent px-0 text-sm font-medium text-foreground shadow-none cursor-pointer dark:bg-transparent">
                <SelectValue>
                  {selectedArea?.nameVi || selectedArea?.name || HOME_CONFIG.hero.defaultAreaLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" alignItemWithTrigger={false} sideOffset={12} className="rounded-xl border border-primary/15 p-1.5 shadow-xl">
                <SelectItem value="all" className="min-h-11 rounded-lg px-3 cursor-pointer data-highlighted:bg-secondary data-selected:bg-secondary data-selected:text-primary">{HOME_CONFIG.hero.defaultAreaLabel}</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={String(area.id)} className="min-h-11 rounded-lg px-3 cursor-pointer data-highlighted:bg-secondary data-selected:bg-secondary data-selected:text-primary">
                    {area.nameVi || area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Keyword Search Input */}
        <div className="flex-[1.5] flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/40 border border-border/60 hover:border-border transition-colors">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <div className="flex-1 flex flex-col justify-center">
            <label
              htmlFor="keyword-input"
              className="sr-only"
            >
              {HOME_CONFIG.hero.searchLabel}
            </label>
            <input
              id="keyword-input"
              type="text"
              aria-label={HOME_CONFIG.hero.searchLabel}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={HOME_CONFIG.hero.searchPlaceholder}
              className="w-full h-8 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="h-12 px-6 rounded-xl font-semibold gap-2 shadow-md shrink-0 cursor-pointer"
        >
          <Search className="size-4" />
          <span>{HOME_CONFIG.hero.ctaExplore}</span>
        </Button>
      </form>

      {/* Quick Action Links Underneath */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-medium text-white/90 drop-shadow-sm">
        <Link
          href="/planner/new?mode=ai"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md transition-colors text-white"
        >
          <Sparkles className="size-3.5 text-amber-300" />
          <span>{HOME_CONFIG.hero.ctaAiPlanner}</span>
        </Link>
        <Link
          href="/explore?view=split"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md transition-colors text-white"
        >
          <Map className="size-3.5 text-teal-300" />
          <span>{HOME_CONFIG.hero.ctaMap}</span>
        </Link>
      </div>
    </div>
  );
}

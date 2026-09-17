"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Coffee,
  Trees,
  Utensils,
  Camera,
  Users,
  Compass,
  Sparkles,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PlaceCard } from "@/components/place/PlaceCard";
import { EmptyState } from "@/components/common/EmptyState";
import { MOCK_PLACES } from "@/mocks/data/places";
import { PlaceCategory, SuitableAudience } from "@/types/place";

const CITIES = [
  { id: "all", label: "Tất cả địa điểm" },
  { id: "Đà Lạt", label: "Đà Lạt" },
  { id: "TP. Hồ Chí Minh", label: "TP. Hồ Chí Minh" },
  { id: "Ninh Bình", label: "Ninh Bình" },
  { id: "Phú Quốc", label: "Phú Quốc" },
];

const CATEGORIES: { id: PlaceCategory | "all"; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "Tất cả", icon: Compass },
  { id: "cafe", label: "Quán Cafe", icon: Coffee },
  { id: "restaurant", label: "Ẩm thực & Quán ăn", icon: Utensils },
  { id: "sightseeing", label: "Tham quan & Di tích", icon: Camera },
  { id: "nature", label: "Thiên nhiên & Núi non", icon: Trees },
  { id: "nightlife", label: "Về đêm & Beach Club", icon: Sparkles },
];

const AUDIENCES: { id: SuitableAudience | "all"; label: string }[] = [
  { id: "all", label: "Tất cả đối tượng" },
  { id: "couple", label: "Hẹn hò / Couple" },
  { id: "family", label: "Gia đình" },
  { id: "friends", label: "Nhóm bạn" },
  { id: "solo", label: "Đi một mình" },
];

export default function ExplorePage() {
  const [keyword, setKeyword] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | "all">("all");
  const [selectedAudience, setSelectedAudience] = useState<SuitableAudience | "all">("all");

  const filteredPlaces = useMemo(() => {
    return MOCK_PLACES.filter((place) => {
      // Keyword match
      if (keyword.trim()) {
        const q = keyword.toLowerCase().trim();
        const matches =
          place.name.toLowerCase().includes(q) ||
          place.address.toLowerCase().includes(q) ||
          place.city.toLowerCase().includes(q) ||
          place.tags.some((t) => t.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // City match
      if (selectedCity !== "all" && place.city !== selectedCity) {
        return false;
      }

      // Category match
      if (selectedCategory !== "all" && place.category !== selectedCategory) {
        return false;
      }

      // Audience match
      if (
        selectedAudience !== "all" &&
        !place.suitableFor.includes(selectedAudience)
      ) {
        return false;
      }

      return true;
    });
  }, [keyword, selectedCity, selectedCategory, selectedAudience]);

  const resetFilters = () => {
    setKeyword("");
    setSelectedCity("all");
    setSelectedCategory("all");
    setSelectedAudience("all");
  };

  const isFiltering =
    keyword !== "" ||
    selectedCity !== "all" ||
    selectedCategory !== "all" ||
    selectedAudience !== "all";

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8">
      {/* Header Banner */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
          Khám phá địa điểm
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Tìm kiếm quán cafe, ẩm thực và điểm du lịch nổi bật.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-4 shadow-xs">
        {/* Search Bar + City Select */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên địa điểm, món ăn, hoạt động..."
              className="h-11 pl-10 text-sm rounded-xl bg-muted/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CITIES.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => setSelectedCity(city.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  selectedCity === city.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {city.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category & Audience Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/70">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="size-3.5" /> Danh mục:
            </span>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-secondary text-primary font-bold shadow-2xs border border-primary/20"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Audience Filter Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Users className="size-3.5" /> Phù hợp:
            </span>
            <div className="flex flex-wrap gap-1">
              {AUDIENCES.map((aud) => (
                <button
                  key={aud.id}
                  type="button"
                  onClick={() => setSelectedAudience(aud.id)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    selectedAudience === aud.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {aud.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reset Filter Button if active */}
        {isFiltering && (
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>
              Tìm thấy <strong className="text-primary font-bold">{filteredPlaces.length}</strong> địa điểm phù hợp
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 font-semibold text-destructive hover:underline"
            >
              <RotateCcw className="size-3" />
              <span>Xóa bộ lọc</span>
            </button>
          </div>
        )}
      </div>

      {/* Place Results Grid */}
      {filteredPlaces.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Không tìm thấy địa điểm phù hợp"
          description="Hãy thử đổi từ khóa tìm kiếm hoặc chọn 'Tất cả địa điểm' để xem nhiều gợi ý hơn."
          actionLabel="Xóa bộ lọc tìm kiếm"
          onAction={resetFilters}
        />
      )}
    </div>
  );
}

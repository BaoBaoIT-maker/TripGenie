"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Users,
  Sparkles,
  RotateCcw,
  Loader2,
  Bot,
  MapPin,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Map as MapIcon,
  LocateFixed,
  Clock,
  Star,
  DollarSign,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlaceCard } from "@/components/place/PlaceCard";
import { EmptyState } from "@/components/common/EmptyState";
import { VietMapLoader } from "@/components/map/VietMapLoader";
import { PhotoContributeModal } from "@/components/place/PhotoContributeModal";
import {
  placeService,
  type BackendTravelAreaItem,
} from "@/services/place.service";
import { Place, SuitableAudience } from "@/types/place";
import { DiscoveryPlace, RadiusKm } from "@/features/map/types";
import { SUPER_CATEGORIES, type SuperCategory } from "@/config/categories";
import { useGeolocation } from "@/features/map/hooks/use-geolocation";

const AUDIENCES: { id: SuitableAudience | "all"; label: string }[] = [
  { id: "all", label: "Tất cả đối tượng" },
  { id: "couple", label: "Cặp đôi" },
  { id: "family", label: "Gia đình" },
  { id: "friends", label: "Nhóm bạn" },
  { id: "solo", label: "Đi một mình" },
];

const RATING_FILTER_OPTIONS: { val: number | null; label: string }[] = [
  { val: null, label: "Tất cả sao" },
  { val: 3, label: "3.0★+" },
  { val: 4, label: "4.0★+" },
  { val: 4.5, label: "4.5★+" },
];

const BUDGET_LEVEL_OPTIONS: { id: string; label: string; desc: string }[] = [
  { id: "LOW", label: "Dưới 100k", desc: "Tiết kiệm (< 100.000đ)" },
  { id: "MEDIUM", label: "100k - 300k", desc: "Phổ thông (100.000đ - 300.000đ)" },
  { id: "HIGH", label: "300k - 1 triệu", desc: "Cao cấp (300.000đ - 1.000.000đ)" },
  { id: "LUXURY", label: "Trên 1 triệu", desc: "Sang trọng (> 1.000.000đ)" },
];

const RADIUS_OPTIONS: RadiusKm[] = [1, 3, 5, 10, 20];

const AI_SUGGESTIONS = [
  "Quán cafe yên tĩnh làm việc gần biển Mỹ Khê",
  "Khách sạn view biển có hồ bơi vô cực",
  "Quán hải sản tươi sống ngon giá hợp lý",
  "Địa điểm lãng mạn ngắm hoàng hôn bán đảo Sơn Trà",
  "Chợ đêm và khu ăn vặt đặc sản Đà Nẵng",
];

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialViewParam = searchParams.get("view");
  const initialAreaParam = searchParams.get("areaId") || searchParams.get("area");
  const parsedInitialArea: number | "all" = useMemo(() => {
    if (!initialAreaParam || initialAreaParam === "all") return "all";
    const num = Number(initialAreaParam);
    return isNaN(num) ? "all" : num;
  }, [initialAreaParam]);

  // Mode: "standard" or "ai"
  const [isAiMode, setIsAiMode] = useState(false);

  // View Mode: Airbnb-style Grid vs Split Map
  const [userViewMode, setUserViewMode] = useState<"grid" | "split" | null>(null);
  const viewMode = userViewMode ?? (initialViewParam === "split" ? "split" : "grid");
  const setViewMode = (mode: "grid" | "split") => setUserViewMode(mode);

  // Selection & Interactivity for Split Map
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);

  // Card click behavior: If map is open (split view), 1st click highlights on map, 2nd click enters details
  const handlePlaceCardClick = (place: Place, e?: React.MouseEvent) => {
    if (viewMode === "split") {
      if (selectedPlaceId === place.id) {
        // Đã hiển thị/chọn trên bản đồ -> click lần nữa thì mở trang chi tiết
        router.push(`/places/${place.slug}`);
      } else {
        // Lần đầu click -> hiển thị trên bản đồ trước, ngăn chặn chuyển trang
        e?.preventDefault();
        e?.stopPropagation();
        setSelectedPlaceId(place.id);
      }
    } else {
      // Khi không bật bản đồ -> click thẳng vào chi tiết
      router.push(`/places/${place.slug}`);
    }
  };

  // Photo Contribution Modal State
  const [contributePlace, setContributePlace] = useState<Place | null>(null);

  // Filters
  const [keyword, setKeyword] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "all">(parsedInitialArea);
  const [selectedSuperCategoryId, setSelectedSuperCategoryId] = useState<string>("all");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedAudience, setSelectedAudience] = useState<SuitableAudience | "all">("all");

  // Multi-criteria GPS & Radius & Quality Filters
  const { coordinate: userLocation, locating, requestLocation } = useGeolocation();
  const [useGpsSearch, setUseGpsSearch] = useState(false);
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(5);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [selectedBudgetLevels, setSelectedBudgetLevels] = useState<string[]>([]);
  const [openNow, setOpenNow] = useState<boolean>(false);

  // Pagination & Data
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(24);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic travel areas from backend
  const [travelAreas, setTravelAreas] = useState<BackendTravelAreaItem[]>([]);

  const [, startTransition] = useTransition();

  // Filter travel areas to PROVINCE and CITY only, sorted alphabetically in Vietnamese
  const provinceAreas = useMemo(() => {
    return travelAreas
      .filter((a) => a.type === "PROVINCE" || a.type === "CITY")
      .sort((a, b) => (a.nameVi || a.name).localeCompare(b.nameVi || b.name, "vi"));
  }, [travelAreas]);

  // Find selected province name for GeoJSON boundary highlight and bounds fitting
  const selectedAreaObj = useMemo(() => {
    if (selectedAreaId === "all") return null;
    return travelAreas.find((a) => a.id === selectedAreaId) || null;
  }, [travelAreas, selectedAreaId]);

  const selectedProvinceName = selectedAreaObj?.nameVi || selectedAreaObj?.name || null;

  // Find active super category config
  const activeSuperCategory: SuperCategory =
    SUPER_CATEGORIES.find((sc) => sc.id === selectedSuperCategoryId) || SUPER_CATEGORIES[0];

  // Load Travel Areas on mount
  useEffect(() => {
    let active = true;
    async function loadMeta() {
      try {
        const areas = await placeService.getTravelAreas();
        if (active && areas && areas.length > 0) {
          setTravelAreas(areas);
        }
      } catch (err) {
        console.warn("Could not load travel areas:", err);
      }
    }
    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  // Fetch places based on standard or AI mode
  const fetchPlaces = useCallback(async () => {
    setLoading(true);
    const limit = pageSize === "all" ? 100 : pageSize;

    try {
      if (isAiMode && aiQuery.trim()) {
        const areaId = !useGpsSearch && selectedAreaId !== "all" ? selectedAreaId : undefined;
        const results = await placeService.searchSemantic(aiQuery.trim(), areaId, limit);
        results.sort((a, b) => {
          const aHas = Boolean(a.coverImage || (a.images && a.images.length > 0));
          const bHas = Boolean(b.coverImage || (b.images && b.images.length > 0));
          if (aHas && !bHas) return -1;
          if (!aHas && bHas) return 1;
          return 0;
        });
        const displayedResults = limit ? results.slice(0, limit) : results;
        setPlaces(displayedResults);
        setTotalCount(results.length);
        setTotalPages(1);
      } else {
        const areaId = !useGpsSearch && selectedAreaId !== "all" ? selectedAreaId : undefined;
        const categorySlugs =
          activeSuperCategory.slugs.length > 0 ? activeSuperCategory.slugs : undefined;

        const res = await placeService.searchPlaces({
          keyword: keyword.trim() || undefined,
          areaId,
          categorySlugs,
          amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
          minRating: minRating || undefined,
          budgetLevels: selectedBudgetLevels.length > 0 ? selectedBudgetLevels : undefined,
          openNow: openNow ? true : undefined,
          latitude: useGpsSearch && userLocation ? userLocation.latitude : undefined,
          longitude: useGpsSearch && userLocation ? userLocation.longitude : undefined,
          radiusMeters: useGpsSearch && userLocation ? radiusKm * 1000 : undefined,
          sortBy: useGpsSearch ? "distance" : "rating",
          page,
          limit,
        });

        let items = res.places;
        if (selectedAudience !== "all") {
          items = items.filter((p) => p.suitableFor.includes(selectedAudience));
        }

        // Always place places with images at the top
        items.sort((a, b) => {
          const aHas = Boolean(a.coverImage || (a.images && a.images.length > 0));
          const bHas = Boolean(b.coverImage || (b.images && b.images.length > 0));
          if (aHas && !bHas) return -1;
          if (!aHas && bHas) return 1;
          return 0;
        });

        const displayedItems = limit ? items.slice(0, limit) : items;
        setPlaces(displayedItems);
        setTotalCount(res.total);
        setTotalPages(res.totalPages || Math.ceil(res.total / (limit || 24)) || 1);
      }
    } catch (err) {
      console.error("Error fetching places:", err);
    } finally {
      setLoading(false);
    }
  }, [
    isAiMode,
    aiQuery,
    keyword,
    selectedAreaId,
    activeSuperCategory.slugs,
    selectedAmenities,
    selectedAudience,
    minRating,
    selectedBudgetLevels,
    openNow,
    useGpsSearch,
    userLocation,
    radiusKm,
    page,
    pageSize,
  ]);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        fetchPlaces();
      }
    }, 250);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [fetchPlaces]);

  // Convert Places to DiscoveryPlaces for Map Pins (matches the filtered places list exactly)
  const discoveryPlaces: DiscoveryPlace[] = useMemo(() => {
    return places.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      categoryLabel: p.categoryLabel,
      areaSlug: p.city || "vietnam",
      areaName: p.city,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      rating: p.rating > 0 ? p.rating : null,
      reviewCount: p.reviewCount,
      priceLevel: p.priceLevel ?? null,
      isOpenNow:
        p.openingHoursText === "Đang mở cửa"
          ? true
          : p.openingHoursText === "Đã đóng cửa"
            ? false
            : null,
      primaryImage: p.coverImage || null,
      images: p.images || [],
      phone: p.phone || null,
      website: p.website || null,
      openingHours: p.openingHoursText || null,
      tags: p.tags,
      demoSimilarityScore: p.matchScore,
    }));
  }, [places]);

  // Map Center: fallback to user location or Da Nang coordinates
  const mapCenter = useMemo(() => {
    if (useGpsSearch && userLocation) {
      return userLocation;
    }
    if (places.length > 0 && places[0].latitude && places[0].longitude) {
      return { latitude: places[0].latitude, longitude: places[0].longitude };
    }
    return { latitude: 16.0544, longitude: 108.2022 };
  }, [useGpsSearch, userLocation, places]);

  // Super Category Select Handler
  const handleSelectSuperCategory = (catId: string) => {
    startTransition(() => {
      setSelectedSuperCategoryId(catId);
      setSelectedAmenities([]);
      setPage(1);
    });
  };

  // Toggle Amenity Chip
  const handleToggleAmenity = (amenityId: string) => {
    setSelectedAmenities((prev) => {
      if (prev.includes(amenityId)) {
        return prev.filter((id) => id !== amenityId);
      }
      return [...prev, amenityId];
    });
    setPage(1);
  };

  // GPS Toggle Handler
  const handleToggleGps = () => {
    if (!useGpsSearch) {
      setUseGpsSearch(true);
      requestLocation();
    } else {
      setUseGpsSearch(false);
    }
    setPage(1);
  };

  // Reset all filters
  const resetFilters = () => {
    setKeyword("");
    setAiQuery("");
    setSelectedAreaId("all");
    setSelectedSuperCategoryId("all");
    setSelectedAmenities([]);
    setSelectedAudience("all");
    setUseGpsSearch(false);
    setRadiusKm(5);
    setMinRating(null);
    setSelectedBudgetLevels([]);
    setOpenNow(false);
    setPageSize(24);
    setPage(1);
  };

  const handleAiSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setPage(1);
    fetchPlaces();
  };

  const isFiltering =
    keyword !== "" ||
    aiQuery !== "" ||
    selectedAreaId !== "all" ||
    selectedSuperCategoryId !== "all" ||
    selectedAmenities.length > 0 ||
    selectedAudience !== "all" ||
    useGpsSearch ||
    minRating !== null ||
    selectedBudgetLevels.length > 0 ||
    openNow;

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-7">
      {/* Header Banner, View Toggle & AI Search Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
              Khám phá địa điểm
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {selectedAreaObj
              ? `Khám phá các điểm đến hấp dẫn tại ${selectedAreaObj.nameVi || selectedAreaObj.name} được xác thực bởi cộng đồng.`
              : "Hơn 3.100 điểm đến trên toàn quốc được xác thực bởi cộng đồng."}
          </p>
        </div>

        {/* View Toggle (Airbnb Style) & AI Toggle */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center rounded-xl border border-border/80 p-0.5 bg-muted/30 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "grid"
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden md:inline">Lưới danh sách</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "split"
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIcon className="size-3.5" />
              <span className="hidden md:inline">Bản đồ Split-View</span>
            </button>
          </div>

          {/* AI Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsAiMode(!isAiMode);
              setPage(1);
            }}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all border ${
              isAiMode
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "bg-background hover:bg-muted/70 text-foreground border-border"
            }`}
          >
            <Sparkles className="size-4" />
            <span>{isAiMode ? "Đang bật AI" : "Tìm bằng AI"}</span>
          </button>
        </div>
      </div>

      {/* Minimalist Text Tabs (Option 1 - Clean Typography, No Emojis/Icons) */}
      {!isAiMode && (
        <div className="space-y-4">
          {/* Super Categories Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border">
            {SUPER_CATEGORIES.map((cat) => {
              const isSelected = selectedSuperCategoryId === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectSuperCategory(cat.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[11px] rounded-full px-1.5 py-0.2 ${
                      isSelected
                        ? "bg-background/20 text-background font-bold"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cat.count.toLocaleString("vi-VN")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Contextual Text Amenity Chips */}
          {activeSuperCategory.amenities && activeSuperCategory.amenities.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground shrink-0 mr-1 uppercase tracking-wider">
                Tiện ích:
              </span>
              <div className="flex items-center gap-1.5 flex-nowrap">
                {activeSuperCategory.amenities.map((amenity) => {
                  const isChecked = selectedAmenities.includes(amenity.id);
                  return (
                    <button
                      key={amenity.id}
                      type="button"
                      onClick={() => handleToggleAmenity(amenity.id)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors border ${
                        isChecked
                          ? "bg-foreground text-background border-foreground font-semibold"
                          : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      }`}
                    >
                      {isChecked && <span className="text-[10px]">✓</span>}
                      <span>{amenity.label}</span>
                    </button>
                  );
                })}
              </div>

              {selectedAmenities.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAmenities([]);
                    setPage(1);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline shrink-0 ml-2"
                >
                  Xóa lọc tiện ích
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Filter / Search Toolbar */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 space-y-4 transition-colors duration-200 ${
          isAiMode ? "border-foreground/30 bg-muted/20" : "border-border/80 bg-card"
        }`}
      >
        {isAiMode ? (
          /* AI Semantic Search Box */
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Bot className="size-4 text-primary" />
              <span>Nhập câu hỏi hoặc mô tả địa điểm mong muốn (Gemini Embeddings + pgvector):</span>
            </div>

            <form onSubmit={handleAiSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ví dụ: Quán cafe yên tĩnh làm việc gần biển hoặc có máy lạnh..."
                  className="h-12 pl-10 text-sm rounded-xl bg-background border-border"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !aiQuery.trim()}
                className="rounded-xl px-5 h-12 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                <span className="hidden sm:inline">Tìm kiếm</span>
              </button>
            </form>

            {/* Quick Preset Prompts */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">Gợi ý tìm nhanh:</span>
              {AI_SUGGESTIONS.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAiQuery(sug)}
                  className="rounded-lg bg-background hover:bg-muted border border-border/80 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Standard Multi-Criteria Search Toolbar */
          <div className="space-y-3.5">
            {/* Row 1: Search Keyword, Province/City Select (34 Provinces Only), GPS Nearby Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Keyword Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm theo tên địa điểm, đường phố, món ăn..."
                  className="h-11 pl-10 text-sm rounded-xl bg-muted/30"
                />
              </div>

              {/* Province / City Dropdown (Strictly 34 Provinces & Municipalities) */}
              <div className="w-full sm:w-60 shrink-0">
                <Select
                  value={selectedAreaId === "all" ? "all" : String(selectedAreaId)}
                  onValueChange={(val) => {
                    setSelectedAreaId(val === "all" ? "all" : Number(val));
                    setUseGpsSearch(false);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-border text-xs sm:text-sm font-medium">
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="size-4 text-primary shrink-0" />
                      <SelectValue placeholder="Chọn Tỉnh / Thành" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="all">Tất cả khu vực (Toàn quốc)</SelectItem>
                    {provinceAreas.map((area) => (
                      <SelectItem key={area.id} value={String(area.id)}>
                        {area.nameVi || area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* GPS Button: Tìm quanh đây */}
              <button
                type="button"
                onClick={handleToggleGps}
                className={`h-11 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all shrink-0 ${
                  useGpsSearch
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-muted/40 hover:bg-muted/80 text-foreground border-border"
                }`}
              >
                {locating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LocateFixed className="size-4" />
                )}
                <span>{useGpsSearch ? "Đang tìm quanh đây" : "Tìm quanh đây"}</span>
              </button>
            </div>

            {/* Row 2: Secondary Filter Criteria (Radius, Rating, Price, Open Now) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/40 text-xs">
              {/* If GPS is active: Radius selector */}
              {useGpsSearch && (
                <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/25 rounded-lg px-2.5 py-1 text-primary font-medium">
                  <span className="text-[11px] font-semibold">Bán kính:</span>
                  <div className="flex items-center gap-1">
                    {RADIUS_OPTIONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setRadiusKm(r);
                          setPage(1);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                          radiusKm === r
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "hover:bg-primary/20"
                        }`}
                      >
                        {r}km
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rating Filter Pills */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-0.5">
                  <Star className="size-3 text-amber-500 fill-amber-500" />
                  <span>Đánh giá:</span>
                </span>
                {RATING_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => {
                      setMinRating(opt.val);
                      setPage(1);
                    }}
                    className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                      minRating === opt.val
                        ? "bg-foreground text-background font-semibold"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Budget Level Filter Pills */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-0.5">
                  <DollarSign className="size-3" />
                  <span>Mức giá:</span>
                </span>
                {BUDGET_LEVEL_OPTIONS.map((opt) => {
                  const isSelected = selectedBudgetLevels.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedBudgetLevels((prev) =>
                          prev.includes(opt.id)
                            ? prev.filter((x) => x !== opt.id)
                            : [...prev, opt.id]
                        );
                        setPage(1);
                      }}
                      title={opt.desc}
                      className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                        isSelected
                          ? "bg-foreground text-background font-semibold"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Open Now Toggle */}
              <button
                type="button"
                onClick={() => {
                  setOpenNow(!openNow);
                  setPage(1);
                }}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                  openNow
                    ? "bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/70"
                }`}
              >
                <Clock className="size-3" />
                <span>Đang mở cửa</span>
              </button>
            </div>

            {/* Row 3: Audience Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30 text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mr-1">
                <Users className="size-3.5" />
                <span>Phù hợp:</span>
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {AUDIENCES.map((aud) => (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => {
                      setSelectedAudience(aud.id);
                      setPage(1);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                      selectedAudience === aud.id
                        ? "bg-foreground text-background font-semibold"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {aud.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reset Filter Button if active */}
        {isFiltering && (
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-border/50">
            <span>
              Tìm thấy <strong className="text-foreground font-semibold">{totalCount}</strong> địa điểm phù hợp
              {isAiMode && " với câu hỏi thông minh"}
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

      {/* Place Results Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="size-7 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-medium">
            {isAiMode
              ? "Gemini đang đối chiếu vector embeddings và trích xuất địa điểm..."
              : "Đang tải dữ liệu địa điểm..."}
          </p>
        </div>
      ) : places.length > 0 ? (
        viewMode === "grid" ? (
          /* ================= MODE 1: FULL GRID ================= */
          <div className="space-y-4">
            {/* Top Bar above Grid: Count & Right-aligned Page Size Dropdown */}
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs text-muted-foreground font-medium">
                Tìm thấy <strong className="text-foreground font-semibold">{totalCount.toLocaleString("vi-VN")}</strong> địa điểm
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Hiển thị:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(val === "all" ? "all" : Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8.5 w-32 rounded-xl text-xs font-semibold bg-card border-border/80 shadow-2xs">
                    <SelectValue placeholder="Số lượng" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="12">12 / trang</SelectItem>
                    <SelectItem value="24">24 / trang</SelectItem>
                    <SelectItem value="48">48 / trang</SelectItem>
                    <SelectItem value="all">Tất cả</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  onCardClick={(e, p) => handlePlaceCardClick(p, e)}
                  onContributePhoto={(p) => setContributePlace(p)}
                  userLocation={userLocation}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {!isAiMode && totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 250, behavior: "smooth" });
                  }}
                  className="flex items-center gap-1 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="size-4" />
                  <span>Trang trước</span>
                </button>

                <span className="text-xs font-medium text-foreground px-2">
                  Trang {page} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 250, behavior: "smooth" });
                  }}
                  className="flex items-center gap-1 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Trang sau</span>
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ================= MODE 2: AIRBNB SPLIT-VIEW ================= */
          <div className="lg:grid lg:grid-cols-[minmax(0,48%)_minmax(0,52%)] lg:gap-6 items-start">
            {/* Left Column: Places List */}
            <div className="flex flex-col gap-4">
              {/* Top Bar above Split View Cards: Count & Right-aligned Page Size Dropdown */}
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-muted-foreground font-medium">
                  <strong className="text-foreground font-semibold">{totalCount.toLocaleString("vi-VN")}</strong> địa điểm
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">Hiển thị:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => {
                      setPageSize(val === "all" ? "all" : Number(val));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8.5 w-32 rounded-xl text-xs font-semibold bg-card border-border/80 shadow-2xs">
                      <SelectValue placeholder="Số lượng" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="12">12 / trang</SelectItem>
                      <SelectItem value="24">24 / trang</SelectItem>
                      <SelectItem value="48">48 / trang</SelectItem>
                      <SelectItem value="all">Tất cả</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {places.map((place) => (
                  <div
                    key={place.id}
                    onMouseEnter={() => setHoveredPlaceId(place.id)}
                    onMouseLeave={() => setHoveredPlaceId(null)}
                    className="transition-all rounded-2xl"
                  >
                    <PlaceCard
                      place={place}
                      isSelected={selectedPlaceId === place.id}
                      onCardClick={(e, p) => handlePlaceCardClick(p, e)}
                      onContributePhoto={(p) => setContributePlace(p)}
                      userLocation={userLocation}
                    />
                  </div>
                ))}
              </div>

              {/* Pagination Controls in Split View */}
              {!isAiMode && totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 250, behavior: "smooth" });
                    }}
                    className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>Trang trước</span>
                  </button>
                  <span className="text-xs font-medium text-foreground">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 250, behavior: "smooth" });
                    }}
                    className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span>Trang sau</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Sticky Map (VietMap with 34 Provinces GeoJSON overlay) */}
            <div className="hidden lg:block lg:sticky lg:top-24 h-[calc(100vh-140px)] min-h-[500px] rounded-2xl overflow-hidden shadow-xs border">
              <VietMapLoader
                places={discoveryPlaces}
                center={mapCenter}
                radiusKm={radiusKm}
                selectedPlaceId={selectedPlaceId}
                hoveredPlaceId={hoveredPlaceId}
                onSelectPlace={(id) => {
                  if (id === null) {
                    setSelectedPlaceId(null);
                  } else {
                    setSelectedPlaceId((prev) => (prev === id ? null : id));
                  }
                }}
                onViewportChange={() => {}}
                onRequestCurrentLocation={requestLocation}
                locating={locating}
                selectedProvinceName={selectedProvinceName}
                userLocation={userLocation || null}
              />
            </div>
          </div>
        )
      ) : (
        <EmptyState
          title={
            useGpsSearch
              ? `Không có địa điểm nào trong bán kính ${radiusKm}km quanh vị trí của bạn`
              : "Không tìm thấy địa điểm phù hợp"
          }
          description={
            useGpsSearch
              ? `Hiện dữ liệu chưa có điểm đến nào nằm trong bán kính ${radiusKm}km quanh tọa độ của bạn. Bạn hãy thử tăng bán kính lên (10km - 20km) hoặc tắt "Tìm quanh đây" để khám phá hơn 3.100 địa điểm khác trên toàn quốc.`
              : isAiMode
                ? "Hãy thử diễn đạt lại câu hỏi theo cách khác hoặc chọn một trong các gợi ý có sẵn."
                : "Hãy thử bỏ bớt một số tiện ích hoặc chọn 'Tất cả' để xem nhiều gợi ý hơn."
          }
          actionLabel={useGpsSearch ? "Tắt tìm quanh đây (Xem toàn quốc)" : "Xóa bộ lọc tìm kiếm"}
          onAction={useGpsSearch ? () => setUseGpsSearch(false) : resetFilters}
        />
      )}

      {/* Photo Contribution Modal with Admin Moderation Notice */}
      <PhotoContributeModal
        place={contributePlace}
        open={Boolean(contributePlace)}
        onOpenChange={(open) => {
          if (!open) setContributePlace(null);
        }}
      />
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Đang tải trang khám phá...</p>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}

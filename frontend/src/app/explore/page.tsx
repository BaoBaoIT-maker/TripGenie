"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useTransition, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  List,
  Map as MapIcon,
  LocateFixed,
  Clock,
  Compass,
  Navigation,
  Star,
  X,
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
import { ExploreFilterModal } from "@/components/place/ExploreFilterModal";
import { ExploreCardListSkeleton } from "@/components/place/ExploreListSkeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { VietMapLoader } from "@/components/map/VietMapLoader";
import { PhotoContributeModal } from "@/components/place/PhotoContributeModal";
import {
  placeService,
  type BackendTravelAreaItem,
  type GeocodedLocation,
} from "@/services/place.service";
import { Place, SuitableAudience } from "@/types/place";
import { DiscoveryPlace, RadiusKm, MAP_RADIUS_OPTIONS } from "@/features/map/types";
import { parseSearchIntent } from "@/features/map/lib/search-intent";
import { SUPER_CATEGORIES, type SuperCategory } from "@/config/categories";
import { DEFAULT_MAP_CENTER } from "@/features/map/map-config";
import { useGeolocation } from "@/features/map/hooks/use-geolocation";
import { parseExploreQuery, type ExploreSort } from "@/features/map/lib/explore-query";

const AI_SUGGESTIONS = [
  "Quán cafe quanh đây trong khoảng 3km",
  "Khách sạn view biển gần Mỹ Khê",
  "Quán hải sản tươi sống gần Cầu Rồng",
  "Địa điểm lãng mạn ngắm hoàng hôn bán đảo Sơn Trà",
  "Quán ăn gần Chùa Cầu Hội An",
];

const SORT_LABELS: Record<ExploreSort, string> = {
  rating: "Đánh giá cao nhất",
  reviews: "Nhiều đánh giá nhất",
  name: "Tên (A - Z)",
};

const PAGE_SIZE_LABELS: Record<string, string> = {
  "12": "12 / trang",
  "24": "24 / trang",
  "48": "48 / trang",
  all: "Tất cả",
};


interface ExploreSearchBarProps {
  keyword: string;
  onSearch: (query: string) => void;
  onClear: () => void;
}

function ExploreSearchBar({ keyword, onSearch, onClear }: ExploreSearchBarProps) {
  const [inputValue, setInputValue] = useState(keyword);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Synchronize input value if parent keyword changes externally
  useEffect(() => {
    setInputValue(keyword);
  }, [keyword]);

  // Close search suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleExecute = (q: string) => {
    setIsSearchFocused(false);
    onSearch(q);
  };

  return (
    <div ref={searchContainerRef} className="relative flex-1">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
      <Input
        value={inputValue}
        onFocus={() => setIsSearchFocused(true)}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleExecute(inputValue);
          }
        }}
        placeholder="Tìm điểm đến, món ngon, quán cafe..."
        className="h-11 pl-9 pr-12 sm:pl-10 sm:pr-20 text-sm rounded-xl bg-slate-50 border-slate-200/80 focus:bg-white focus:border-[#0194F3] font-medium"
      />
      <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue("");
              onClear();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
            title="Xóa tìm kiếm"
          >
            <X className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => handleExecute(inputValue)}
          className="size-8 sm:size-auto sm:px-2.5 sm:py-1 rounded-lg bg-[#0194F3] hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
          title="Thực hiện tìm kiếm"
          aria-label="Thực hiện tìm kiếm"
        >
          <Search className="size-3.5 sm:hidden" />
          <span className="hidden sm:inline">Tìm</span>
        </button>
      </div>

      {/* Search Suggestions Dropdown (appears only when input is focused) */}
      {isSearchFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 space-y-2 animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5">
              <Compass className="size-3.5 text-[#0194F3]" />
              <span>Gợi ý tìm kiếm phổ biến</span>
            </span>
            <button
              type="button"
              onClick={() => setIsSearchFocused(false)}
              className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              Đóng
            </button>
          </div>
          <div className="space-y-1">
            {AI_SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInputValue(sug);
                  handleExecute(sug);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-[#0194F3] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Search className="size-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{sug}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MobileMapCarouselProps {
  places: Place[];
  selectedPlaceId: string | null;
  onSelectPlace: (place: Place) => void;
  onNavigateDetail: (place: Place) => void;
  onRequestDirections?: (place: Place) => void;
}

function MobileMapCarousel({
  places,
  selectedPlaceId,
  onSelectPlace,
  onNavigateDetail,
  onRequestDirections,
}: MobileMapCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll selected card to center of carousel when selectedPlaceId changes
  useEffect(() => {
    if (!selectedPlaceId) return;
    const cardEl = document.getElementById(`mobile-carousel-card-${selectedPlaceId}`);
    if (cardEl) {
      isProgrammaticScrollRef.current = true;
      cardEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      const timer = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [selectedPlaceId]);

  // Synchronize map marker when user swipes through cards in carousel
  const handleScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      const containerCenter =
        container.getBoundingClientRect().left + container.clientWidth / 2;
      let closestPlace: Place | null = null;
      let minDistance = Infinity;

      for (const place of places) {
        const el = document.getElementById(`mobile-carousel-card-${place.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const cardCenter = rect.left + rect.width / 2;
          const dist = Math.abs(cardCenter - containerCenter);
          if (dist < minDistance) {
            minDistance = dist;
            closestPlace = place;
          }
        }
      }

      if (closestPlace && closestPlace.id !== selectedPlaceId) {
        onSelectPlace(closestPlace);
      }
    }, 120);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory px-4 py-2 scrollbar-none pointer-events-auto"
    >
      {places.map((place) => {
        const isSelected = place.id === selectedPlaceId;
        return (
          <div
            key={place.id}
            id={`mobile-carousel-card-${place.id}`}
            onClick={() => {
              if (isSelected) {
                onNavigateDetail(place);
              } else {
                onSelectPlace(place);
              }
            }}
            className={cn(
              "w-[280px] sm:w-[320px] shrink-0 snap-center rounded-2xl p-2.5 transition-all duration-200 cursor-pointer flex gap-3 items-center",
              isSelected
                ? "bg-white shadow-xl border-2 border-[#0194F3] ring-2 ring-[#0194F3]/20 scale-[1.02]"
                : "bg-white/95 backdrop-blur-md shadow-md border border-slate-200/90 hover:border-slate-300 opacity-95 hover:opacity-100"
            )}
          >
            {/* Thumbnail */}
            <div className="relative size-18 rounded-xl overflow-hidden bg-slate-100 shrink-0">
              {place.coverImage ? (
                <img
                  src={place.coverImage}
                  alt={place.name}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="size-full flex items-center justify-center text-slate-400">
                  <MapPin className="size-5 text-[#0194F3]" />
                </div>
              )}
            </div>

            {/* Information */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-[#0194F3] uppercase tracking-wider truncate">
                  {place.categoryLabel || place.category || "Địa điểm"}
                </span>
                {typeof place.rating === "number" && place.rating > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0">
                    <Star className="size-3 fill-amber-500 text-amber-500" />
                    {place.rating.toFixed(1)}
                  </span>
                )}
              </div>

              <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">
                {place.name}
              </h4>

              <div className="flex items-center justify-between gap-1 pt-0.5">
                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                  <MapPin className="size-3 shrink-0 text-slate-400" />
                  <span className="truncate">{place.address || place.city || "Việt Nam"}</span>
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onRequestDirections && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestDirections(place);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-[#0194F3] text-[10px] font-bold border border-sky-200 transition-colors cursor-pointer"
                      title="Chỉ đường đến địa điểm này"
                    >
                      <Navigation className="size-2.5" />
                      <span>Chỉ đường</span>
                    </button>
                  )}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateDetail(place);
                    }}
                    className="text-[10px] font-bold text-slate-600 hover:text-[#0194F3] hover:underline"
                  >
                    Chi tiết &rarr;
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsedQuery = useMemo(() => parseExploreQuery(searchParams), [searchParams]);

  const initialSelectedId = searchParams.get("selected") || searchParams.get("placeId");
  const initialLat = searchParams.get("lat") ? Number(searchParams.get("lat")) : null;
  const initialLng = searchParams.get("lng") ? Number(searchParams.get("lng")) : null;

  // Mobile map view toggle (Airbnb-style floating toggle for mobile devices)
  const [showMobileMap, setShowMobileMap] = useState(false);

  // Sync body class when mobile map is active to safely dock global floating widgets
  useEffect(() => {
    if (showMobileMap) {
      document.body.classList.add("mobile-map-active");
    } else {
      document.body.classList.remove("mobile-map-active");
    }
    return () => {
      document.body.classList.remove("mobile-map-active");
    };
  }, [showMobileMap]);

  // Selection & Interactivity for Split Map
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(initialSelectedId || null);
  const selectedPlaceIdRef = useRef(selectedPlaceId);
  const listContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedPlaceIdRef.current = selectedPlaceId;
  }, [selectedPlaceId]);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);

  // Photo Contribution Modal State
  const [contributePlace, setContributePlace] = useState<Place | null>(null);

  // Filters
  const [keyword, setKeyword] = useState<string>(parsedQuery.keyword || "");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "all">(parsedQuery.areaId || "all");
  const [selectedSuperCategoryId, setSelectedSuperCategoryId] = useState<string>(parsedQuery.category || "all");
  const [selectedAudience, setSelectedAudience] = useState<SuitableAudience | "all">(parsedQuery.suitableFor || "all");
  const [selectedSort, setSelectedSort] = useState<ExploreSort>(parsedQuery.sort || "rating");

  // Multi-criteria GPS & Radius & Quality Filters
  const { coordinate: userLocation, locating, requestLocation } = useGeolocation();
  const [useGpsSearch, setUseGpsSearch] = useState(false);
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(5);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [selectedBudgetLevel, setSelectedBudgetLevel] = useState<string | null>(null);
  const [openNow, setOpenNow] = useState<boolean>(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const isFirstMountRef = useRef(true);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (minRating !== null) count++;
    if (selectedBudgetLevel !== null) count++;
    if (selectedAudience !== "all") count++;
    if (useGpsSearch && radiusKm !== 5) count++;
    return count;
  }, [minRating, selectedBudgetLevel, selectedAudience, useGpsSearch, radiusKm]);

  // Pagination & Data
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(24);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  // Geocoded Pin (Coordinates / Address search) & Fallback indicator
  const [geocodedLocation, setGeocodedLocation] = useState<GeocodedLocation | null>(null);
  const [isFallbackResult, setIsFallbackResult] = useState<boolean>(false);
  const [pinNearbyCenter, setPinNearbyCenter] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);
  const [routeToPinRequest, setRouteToPinRequest] = useState<{
    latitude: number;
    longitude: number;
    name: string;
  } | null>(null);

  // Dynamic travel areas from backend
  const [travelAreas, setTravelAreas] = useState<BackendTravelAreaItem[]>([]);
  const [, startTransition] = useTransition();

  // Adjust state during render when URL params change (official React pattern avoiding effect cascades)
  const [prevSelectedParam, setPrevSelectedParam] = useState(initialSelectedId);
  if (initialSelectedId !== prevSelectedParam) {
    setPrevSelectedParam(initialSelectedId);
    if (initialSelectedId) {
      setSelectedPlaceId(initialSelectedId);
    }
  }

  const [prevParsedQuery, setPrevParsedQuery] = useState(parsedQuery);
  if (parsedQuery !== prevParsedQuery) {
    setPrevParsedQuery(parsedQuery);
    let filterChanged = false;

    const nextKeyword = parsedQuery.keyword || "";
    if (keyword !== nextKeyword) {
      setKeyword(nextKeyword);
      filterChanged = true;
    }

    const nextAreaId = parsedQuery.areaId || "all";
    if (selectedAreaId !== nextAreaId) {
      setSelectedAreaId(nextAreaId);
      filterChanged = true;
    }

    const nextCategory = parsedQuery.category || "all";
    if (selectedSuperCategoryId !== nextCategory) {
      setSelectedSuperCategoryId(nextCategory);
      filterChanged = true;
    }

    const nextAudience = parsedQuery.suitableFor || "all";
    if (selectedAudience !== nextAudience) {
      setSelectedAudience(nextAudience);
      filterChanged = true;
    }

    if (parsedQuery.sort && selectedSort !== parsedQuery.sort) {
      setSelectedSort(parsedQuery.sort);
      filterChanged = true;
    }

    if (filterChanged) {
      setPage(1);
    }
  }

  // Immediately load target place if initialSelectedId is present so map and card list have it without delay
  useEffect(() => {
    if (!initialSelectedId) return;
    const targetId = initialSelectedId;
    let active = true;

    async function loadDirectPlace() {
      try {
        const directPlace = await placeService.getPlaceById(targetId);
        if (active && directPlace) {
          setPlaces((prev) => {
            if (prev.some((p) => p.id === directPlace.id)) return prev;
            return [directPlace, ...prev];
          });
          setSelectedPlaceId(directPlace.id);
        }
      } catch (err) {
        console.warn("Could not load direct selected place:", err);
      }
    }

    loadDirectPlace();
    return () => {
      active = false;
    };
  }, [initialSelectedId]);

  // Auto scroll to selected card in split view list
  useEffect(() => {
    if (!selectedPlaceId) return;
    const cardEl = document.getElementById(`place-card-${selectedPlaceId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedPlaceId]);

  // Card click behavior: 1st click highlights on map, 2nd click enters details (direct on mobile list)
  const handlePlaceCardClick = (place: Place, e?: React.MouseEvent) => {
    const isMobileList = typeof window !== "undefined" && window.innerWidth < 1024 && !showMobileMap;
    if (isMobileList || selectedPlaceId === place.id) {
      // Đã chọn trên bản đồ hoặc đang duyệt danh sách mobile -> mở trang chi tiết
      router.push(`/places/${place.slug}`);
    } else {
      // Lần đầu click trên desktop -> hiển thị trên bản đồ trước, ngăn chặn chuyển trang
      e?.preventDefault();
      e?.stopPropagation();
      setSelectedPlaceId(place.id);
    }
  };

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

  // Fetch places using unified search (with automatic NLP fallback in backend)
  const fetchPlaces = useCallback(async () => {
    // Hold off firing premature nationwide request while browser is actively acquiring GPS fix
    if (useGpsSearch && !userLocation && locating) {
      return;
    }

    setLoading(true);
    const limit = pageSize === "all" ? 100 : pageSize;

    try {
      const areaId = !useGpsSearch && !pinNearbyCenter && selectedAreaId !== "all" ? selectedAreaId : undefined;
      const categorySlugs =
        activeSuperCategory.slugs.length > 0 ? activeSuperCategory.slugs : undefined;

      const effectiveLat = pinNearbyCenter
        ? pinNearbyCenter.latitude
        : useGpsSearch && userLocation
          ? userLocation.latitude
          : undefined;
      const effectiveLng = pinNearbyCenter
        ? pinNearbyCenter.longitude
        : useGpsSearch && userLocation
          ? userLocation.longitude
          : undefined;
      const effectiveRadius =
        pinNearbyCenter || (useGpsSearch && userLocation) ? radiusKm * 1000 : undefined;

      const res = await placeService.searchPlaces({
        keyword: keyword.trim() || undefined,
        areaId,
        categorySlugs,
        minRating: minRating || undefined,
        budgetLevels: selectedBudgetLevel ? [selectedBudgetLevel] : undefined,
        openNow: openNow ? true : undefined,
        latitude: effectiveLat,
        longitude: effectiveLng,
        radiusMeters: effectiveRadius,
        sortBy: pinNearbyCenter || useGpsSearch ? "distance" : selectedSort,
        page,
        limit,
      });

      if (res.geocoded) {
        setGeocodedLocation(res.geocoded);
      } else if (!pinNearbyCenter) {
        setGeocodedLocation(null);
      }
      setIsFallbackResult(Boolean(res.isFallback));

      let items = res.places;
      if (selectedAudience !== "all") {
        items = items.filter((p) => p.suitableFor.includes(selectedAudience));
      }

      // If initialSelectedId is present and not yet in items, fetch it directly and prepend
      if (initialSelectedId && !items.some((p) => p.id === initialSelectedId || p.slug === initialSelectedId)) {
        try {
          const directPlace = await placeService.getPlaceById(initialSelectedId);
          if (directPlace) {
            items = [directPlace, ...items.filter((p) => p.id !== directPlace.id)];
            if (selectedPlaceIdRef.current === initialSelectedId && directPlace.id !== initialSelectedId) {
              setSelectedPlaceId(directPlace.id);
            }
          }
        } catch (targetErr) {
          console.warn("Could not fetch target place by id:", targetErr);
        }
      }

      // Always place places with images at the top, and ensure the selected place stays at the very top
      items.sort((a, b) => {
        if (initialSelectedId) {
          if (a.id === initialSelectedId || a.slug === initialSelectedId) return -1;
          if (b.id === initialSelectedId || b.slug === initialSelectedId) return 1;
        }
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
    } catch (err) {
      console.error("Error fetching places:", err);
    } finally {
      setLoading(false);
    }
  }, [
    keyword,
    selectedAreaId,
    activeSuperCategory.slugs,
    selectedAudience,
    selectedSort,
    minRating,
    selectedBudgetLevel,
    openNow,
    useGpsSearch,
    userLocation,
    locating,
    pinNearbyCenter,
    radiusKm,
    page,
    pageSize,
    initialSelectedId,
  ]);

  useEffect(() => {
    let ignore = false;
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      fetchPlaces();
      return;
    }
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

  // Active Geocoded Pin for map marker (retains marker when searching nearby)
  const activeGeocodedPin = useMemo(() => {
    if (geocodedLocation) return geocodedLocation;
    if (pinNearbyCenter) {
      return {
        lat: pinNearbyCenter.latitude,
        lng: pinNearbyCenter.longitude,
        displayName: pinNearbyCenter.label,
      };
    }
    return null;
  }, [geocodedLocation, pinNearbyCenter]);

  // Map Center: prioritize query param lat/lng, geocoded pin, user location, first search place, or default
  const mapCenter = useMemo(() => {
    if (initialLat !== null && initialLng !== null && !isNaN(initialLat) && !isNaN(initialLng)) {
      return { latitude: initialLat, longitude: initialLng };
    }
    if (activeGeocodedPin) {
      return { latitude: activeGeocodedPin.lat, longitude: activeGeocodedPin.lng };
    }
    if (useGpsSearch && userLocation) {
      return userLocation;
    }
    if (places.length > 0 && places[0].latitude && places[0].longitude) {
      return { latitude: places[0].latitude, longitude: places[0].longitude };
    }
    return DEFAULT_MAP_CENTER;
  }, [initialLat, initialLng, places, activeGeocodedPin, useGpsSearch, userLocation]);

  // Super Category Select Handler
  const handleSelectSuperCategory = (catId: string) => {
    startTransition(() => {
      setSelectedSuperCategoryId(catId);
      setPage(1);
    });
  };


  // GPS Toggle Handler
  const handleToggleGps = () => {
    if (!useGpsSearch) {
      setUseGpsSearch(true);
      setPinNearbyCenter(null);
      requestLocation();
    } else {
      setUseGpsSearch(false);
    }
    setPage(1);
  };

  // Bilingual spatial intent & search execution handler
  const handleExecuteSearch = useCallback(
    (rawQuery: string) => {
      const parsed = parseSearchIntent(rawQuery);

      if (parsed.extractedRadiusKm) {
        setRadiusKm(parsed.extractedRadiusKm);
      }

      // Synchronize administrative area if recognized in query
      if (parsed.areaName) {
        const areaNorm = parsed.areaName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/gi, "d")
          .trim();
        const matched =
          provinceAreas.find((a) => {
            const nameNorm = (a.nameVi || a.name)
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/đ/gi, "d");
            const slugNorm = a.slug.replace(/-/g, " ");
            return nameNorm.includes(areaNorm) || areaNorm.includes(nameNorm) || slugNorm.includes(areaNorm);
          }) ||
          travelAreas.find((a) => {
            const nameNorm = (a.nameVi || a.name)
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/đ/gi, "d");
            const slugNorm = a.slug.replace(/-/g, " ");
            return nameNorm.includes(areaNorm) || areaNorm.includes(nameNorm) || slugNorm.includes(areaNorm);
          });

        if (matched) {
          setSelectedAreaId(matched.id);
          setUseGpsSearch(false);
          setPinNearbyCenter(null);
        }
      }

      if (parsed.isNearbyIntent) {
        setUseGpsSearch(true);
        setPinNearbyCenter(null);
        requestLocation();
        setKeyword(parsed.cleanedKeyword);
        setPage(1);
        toast.info(
          parsed.extractedRadiusKm
            ? `Đang tìm "${parsed.cleanedKeyword || "địa điểm"}" quanh bạn (bán kính ${parsed.extractedRadiusKm}km)`
            : "Đang tìm kiếm quanh vị trí hiện tại của bạn"
        );
      } else if (parsed.anchorLandmark) {
        const targetSearch = parsed.cleanedKeyword
          ? `${parsed.cleanedKeyword} gần ${parsed.anchorLandmark}`
          : parsed.anchorLandmark;
        setKeyword(targetSearch);
        setPage(1);
        toast.info(`Đang tìm kiếm "${targetSearch}"`);
      } else {
        const finalKeyword = parsed.cleanedKeyword || (parsed.areaName ? "" : rawQuery.trim());
        setKeyword(finalKeyword);
        setPage(1);
      }
    },
    [requestLocation, provinceAreas, travelAreas]
  );

  // Reset all filters
  const resetFilters = () => {
    setKeyword("");
    setGeocodedLocation(null);
    setPinNearbyCenter(null);
    setRouteToPinRequest(null);
    setIsFallbackResult(false);
    setSelectedAreaId("all");
    setSelectedSuperCategoryId("all");
    setSelectedAudience("all");
    setUseGpsSearch(false);
    setRadiusKm(5);
    setMinRating(null);
    setSelectedBudgetLevel(null);
    setOpenNow(false);
    setPageSize(24);
    setPage(1);
  };

  // Drop a pin by clicking directly on the map
  const handleMapClickDropPin = useCallback((coords: { lat: number; lng: number }) => {
    setPinNearbyCenter(null);
    setRouteToPinRequest(null);
    const coordsStr = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    setKeyword(coordsStr);
    setPage(1);
  }, [setPage]);

  // Drag a pin to a new position on the map
  const handlePinDragEnd = useCallback((coords: { lat: number; lng: number }) => {
    setPinNearbyCenter(null);
    setRouteToPinRequest(null);
    const coordsStr = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    setKeyword(coordsStr);
    setPage(1);
  }, [setPage]);

  // Search this area when user pans/zooms map
  const handleSearchThisArea = useCallback((coords: { latitude: number; longitude: number }) => {
    setPinNearbyCenter({
      latitude: coords.latitude,
      longitude: coords.longitude,
      label: `Khu vực (${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)})`,
    });
    setPage(1);
    toast.info("Đang tìm kiếm các địa điểm trong khu vực này...");
  }, [setPage]);

  // Clear current pin and reset nearby searches
  const handleClearPin = useCallback(() => {
    setGeocodedLocation(null);
    setPinNearbyCenter(null);
    setRouteToPinRequest(null);
    setKeyword("");
    setPage(1);
  }, [setPage]);

  const handleSelectPlace = useCallback((id: string | null) => {
    setSelectedPlaceId(id);
  }, []);

  const handleRequestCurrentLocation = useCallback(() => {
    setUseGpsSearch(true);
    setPinNearbyCenter(null);
    setPage(1);
    requestLocation();
  }, [requestLocation, setPage]);

  const handleViewportChange = useCallback(() => {}, []);

  const isFiltering =
    keyword !== "" ||
    pinNearbyCenter !== null ||
    geocodedLocation !== null ||
    selectedAreaId !== "all" ||
    selectedSuperCategoryId !== "all" ||
    selectedAudience !== "all" ||
    useGpsSearch ||
    minRating !== null ||
    selectedBudgetLevel !== null ||
    openNow;

  return (
    <div className="max-w-[1600px] mx-auto w-full px-4 py-4 sm:px-6 lg:px-6 xl:px-8 space-y-4 lg:space-y-2.5 lg:h-[calc(100vh-4.25rem)] lg:flex lg:flex-col lg:overflow-hidden">
      {/* Header Banner: Hidden on desktop to maximize map vertical height */}
      <div className="shrink-0 pb-1.5 border-b border-slate-200/80 hidden sm:block lg:hidden">
        <div className="space-y-0.5">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Khám phá địa điểm
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {selectedAreaObj
              ? `Khám phá các điểm đến hấp dẫn tại ${selectedAreaObj.nameVi || selectedAreaObj.name} được xác thực bởi cộng đồng.`
              : "Hơn 3.100 điểm đến trên toàn quốc được xác thực bởi cộng đồng."}
          </p>
        </div>
      </div>

      {/* Main Unified Search Toolbar */}
      <div className="shrink-0 relative rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-2.5 shadow-sm space-y-2">
        {/* Active Spatial Search & Instant Radius Selector Bar */}
        {(useGpsSearch || pinNearbyCenter || geocodedLocation) && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-sky-50/90 border border-sky-200 text-xs text-slate-800 transition-all animate-in fade-in-50">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-lg bg-[#0194F3]/10 flex items-center justify-center text-[#0194F3] shrink-0">
                <LocateFixed className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Phạm vi tìm kiếm quanh đây
                </div>
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {pinNearbyCenter ? (
                    <span>Tâm điểm: <strong className="text-[#0194F3]">{pinNearbyCenter.label}</strong></span>
                  ) : geocodedLocation ? (
                    <span>Mốc địa lý: <strong className="text-[#0194F3]">{geocodedLocation.displayName}</strong></span>
                  ) : userLocation ? (
                    <span>Vị trí GPS của bạn (Cách bạn tối đa <strong className="text-[#0194F3]">{radiusKm}km</strong>)</span>
                  ) : (
                    <span className="text-amber-600 font-medium flex items-center gap-1.5">
                      <Loader2 className="size-3 animate-spin shrink-0" />
                      Đang lấy tọa độ GPS...
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Instant 1-tap Radius Selector */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
              <span className="text-[11px] font-bold text-slate-500 mr-1 hidden sm:inline">Bán kính:</span>
              {MAP_RADIUS_OPTIONS.map((r) => {
                const isSelected = radiusKm === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRadiusKm(r);
                      setPage(1);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      isSelected
                        ? "bg-[#0194F3] text-white shadow-xs"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80"
                    )}
                  >
                    {r}km
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  if (pinNearbyCenter) setPinNearbyCenter(null);
                  if (useGpsSearch) setUseGpsSearch(false);
                  if (geocodedLocation) setGeocodedLocation(null);
                  setPage(1);
                }}
                className="ml-2 text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                title="Tắt chế độ tìm quanh đây"
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Search & Location Filter Bar: 2 tiers on mobile, 1 compact inline tier on desktop */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Keyword input with autocomplete */}
          <div className="flex-1 min-w-[200px] lg:max-w-xs xl:max-w-sm">
            <ExploreSearchBar
              keyword={keyword}
              onSearch={handleExecuteSearch}
              onClear={handleClearPin}
            />
          </div>

          {/* Location controls (Province dropdown + GPS nearby button) */}
          <div className="flex items-center gap-2 sm:shrink-0">
            {/* Province / City Select Dropdown */}
            <div className="flex-1 sm:w-48 sm:flex-none">
              <Select
                value={selectedAreaId === "all" ? "all" : String(selectedAreaId)}
                onValueChange={(val) => {
                  setSelectedAreaId(val === "all" ? "all" : Number(val));
                  setUseGpsSearch(false);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 sm:h-11 px-3 rounded-xl bg-slate-50 border-slate-200/80 text-xs sm:text-sm font-semibold text-slate-800">
                  <div className="flex items-center gap-2 truncate">
                    <MapPin className="size-4 text-[#0194F3] shrink-0" />
                    <SelectValue placeholder="Chọn Tỉnh / Thành">
                      {selectedAreaId === "all"
                        ? "Toàn quốc (Tất cả)"
                        : selectedProvinceName || "Chọn Tỉnh / Thành"}
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">Toàn quốc (Tất cả)</SelectItem>
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
              className={cn(
                "h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all shrink-0 cursor-pointer",
                useGpsSearch
                  ? "bg-[#0194F3] text-white border-[#0194F3] shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"
              )}
            >
              {locating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LocateFixed className="size-3.5" />
              )}
              <span>{useGpsSearch ? "Đang tìm quanh đây" : "Tìm quanh đây"}</span>
            </button>
          </div>

          {/* Desktop-only Inline Controls: Divider + Bộ lọc + Đang mở cửa + Sắp xếp */}
          <div className="hidden lg:flex items-center gap-2 ml-auto shrink-0">
            <div className="h-6 w-px bg-slate-200 mx-0.5" />

            {/* Button mở Filter Sheet Modal */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFilterSheetOpen(true)}
              className={cn(
                "h-10 rounded-xl font-semibold text-xs gap-1.5 transition-all cursor-pointer border shadow-2xs",
                activeFilterCount > 0
                  ? "bg-[#0194F3]/10 border-[#0194F3] text-[#0194F3] hover:bg-[#0194F3]/15 font-bold"
                  : "bg-card border-border text-foreground hover:bg-muted"
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              <span>Bộ lọc</span>
              {activeFilterCount > 0 && (
                <span className="size-4.5 rounded-full bg-[#0194F3] text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Quick Toggle: Đang mở cửa */}
            <button
              type="button"
              onClick={() => {
                setOpenNow(!openNow);
                setPage(1);
              }}
              className={cn(
                "h-10 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs",
                openNow
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                  : "bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Clock className="size-3.5 text-emerald-600" />
              <span>Đang mở cửa</span>
            </button>

            {/* Reset Filters button if any filters active */}
            {isFiltering && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-10 px-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
                title="Đặt lại tất cả bộ lọc"
              >
                <RotateCcw className="size-3" />
                <span>Đặt lại</span>
              </button>
            )}

            {/* Sắp xếp theo */}
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Sắp xếp:</span>
              <Select
                value={selectedSort}
                onValueChange={(val) => {
                  setSelectedSort(val as ExploreSort);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 w-36 rounded-xl text-xs font-semibold bg-card border-border shadow-2xs text-foreground">
                  <SelectValue placeholder="Sắp xếp">
                    {SORT_LABELS[selectedSort] || "Sắp xếp"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="rating">Đánh giá cao nhất</SelectItem>
                  <SelectItem value="reviews">Nhiều đánh giá nhất</SelectItem>
                  <SelectItem value="name">Tên (A - Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Super Categories Bar - Modern Pills */}
      <div className="shrink-0 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {SUPER_CATEGORIES.map((cat) => {
          const isSelected = selectedSuperCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelectSuperCategory(cat.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs",
                isSelected
                  ? "bg-[#0194F3] text-white shadow-md shadow-[#0194F3]/25 hover:bg-[#007FE3]"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              <span>{cat.label}</span>
              <span
                className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.2 font-extrabold",
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {cat.count.toLocaleString("vi-VN")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-Toolbar: Mobile only (hidden on desktop because controls are inline in search row) */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pt-1 pb-2 border-b border-slate-200/70 text-xs lg:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Button mở Filter Sheet Modal */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsFilterSheetOpen(true)}
            className={cn(
              "h-9 rounded-xl font-semibold text-xs gap-2 transition-all cursor-pointer border shadow-2xs",
              activeFilterCount > 0
                ? "bg-[#0194F3]/10 border-[#0194F3] text-[#0194F3] hover:bg-[#0194F3]/15 font-bold"
                : "bg-card border-border text-foreground hover:bg-muted"
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Bộ lọc</span>
            {activeFilterCount > 0 && (
              <span className="size-5 rounded-full bg-[#0194F3] text-white text-[10px] font-bold flex items-center justify-center ml-0.5">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Quick Toggle: Đang mở cửa */}
          <button
            type="button"
            onClick={() => {
              setOpenNow(!openNow);
              setPage(1);
            }}
            className={cn(
              "h-9 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs",
              openNow
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                : "bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Clock className="size-3.5 text-emerald-600" />
            <span>Đang mở cửa</span>
          </button>

          {/* Reset Filters button if any filters active */}
          {isFiltering && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 px-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Đặt lại tất cả</span>
            </button>
          )}
        </div>

        {/* Right: Sắp xếp theo */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Sắp xếp:</span>
          <Select
            value={selectedSort}
            onValueChange={(val) => {
              setSelectedSort(val as ExploreSort);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-40 rounded-xl text-xs font-semibold bg-card border-border shadow-2xs text-foreground">
              <SelectValue placeholder="Sắp xếp">
                {SORT_LABELS[selectedSort] || "Sắp xếp"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="rating">Đánh giá cao nhất</SelectItem>
              <SelectItem value="reviews">Nhiều đánh giá nhất</SelectItem>
              <SelectItem value="name">Tên (A - Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced Filter Modal (Centered Compact Dialog) */}
      <ExploreFilterModal
        open={isFilterSheetOpen}
        onOpenChange={setIsFilterSheetOpen}
        minRating={minRating}
        selectedBudgetLevel={selectedBudgetLevel}
        selectedAudience={selectedAudience}
        useGpsSearch={useGpsSearch}
        radiusKm={radiusKm}
        onApplyFilters={({ minRating: r, budgetLevel: b, audience: a, radiusKm: rad }) => {
          setMinRating(r);
          setSelectedBudgetLevel(b);
          setSelectedAudience(a);
          setRadiusKm(rad);
          setPage(1);
        }}
        onResetFilters={resetFilters}
      />

      {/* ================= UNIFIED SPLIT-VIEW (AIRBNB STYLE) ================= */}
      <div className="relative lg:flex-1 lg:min-h-0">
        <div className="h-full lg:grid lg:grid-cols-[minmax(0,48%)_minmax(0,52%)] lg:gap-5 items-stretch">
          {/* Left Column: Places List or Geocoded Pin or Empty */}
          <div
            ref={listContainerRef}
            className={cn(
              "flex flex-col gap-4 lg:h-full lg:overflow-y-auto lg:pr-3 scrollbar-thin",
              showMobileMap ? "hidden lg:flex" : "flex"
            )}
          >
            {loading ? (
              <ExploreCardListSkeleton count={pageSize === 12 ? 6 : 8} />
            ) : (
              <>
                {/* Fallback Banner if applicable */}
                {isFallbackResult && places.length > 0 && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                    <Sparkles className="size-4 shrink-0 text-amber-600" />
                    <span>
                      Không tìm thấy địa điểm chính xác cho <strong>&quot;{keyword}&quot;</strong>. Gợi ý các địa điểm tương tự:
                    </span>
                  </div>
                )}

                {places.length > 0 ? (
                  <>
                    {/* Top Bar above Split View Cards: Count & Right-aligned Page Size Dropdown */}
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
                            <SelectValue placeholder="Số lượng">
                              {PAGE_SIZE_LABELS[String(pageSize)] || "24 / trang"}
                            </SelectValue>
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
                        id={`place-card-${place.id}`}
                        onMouseEnter={() => setHoveredPlaceId(place.id)}
                        onMouseLeave={() => setHoveredPlaceId(null)}
                        className="transition-all rounded-2xl"
                      >
                        <PlaceCard
                          place={place}
                          isSelected={selectedPlaceId === place.id}
                          onCardClick={(e, p) => handlePlaceCardClick(p, e)}
                          onContributePhoto={(p) => setContributePlace(p)}
                          userLocation={
                            userLocation ||
                            (pinNearbyCenter
                              ? { latitude: pinNearbyCenter.latitude, longitude: pinNearbyCenter.longitude }
                              : null)
                          }
                        />
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls in Split View */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => {
                          setPage((p) => Math.max(1, p - 1));
                          listContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                          if (typeof window !== "undefined" && window.innerWidth < 1024) {
                            window.scrollTo({ top: 250, behavior: "smooth" });
                          }
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
                          listContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                          if (typeof window !== "undefined" && window.innerWidth < 1024) {
                            window.scrollTo({ top: 250, behavior: "smooth" });
                          }
                        }}
                        className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <span>Trang sau</span>
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Desktop List Bottom Mini-Notice */}
                  <div className="hidden lg:block pt-6 pb-4 border-t border-slate-200/70 text-center">
                    <p className="text-[11px] text-slate-400">
                      © {new Date().getFullYear()} TripGenie · Nền tảng khám phá du lịch thông minh Việt Nam
                    </p>
                  </div>
                </>
              ) : (
                <EmptyState
                  title={
                    pinNearbyCenter
                      ? `Không có địa điểm nào quanh "${pinNearbyCenter.label}" trong bán kính ${radiusKm}km`
                      : geocodedLocation
                        ? `Không có địa điểm nào quanh "${geocodedLocation.displayName}" trong bán kính ${radiusKm}km`
                        : useGpsSearch
                          ? `Không có địa điểm nào trong bán kính ${radiusKm}km quanh vị trí của bạn`
                          : "Không tìm thấy địa điểm phù hợp"
                  }
                  description={
                    pinNearbyCenter || geocodedLocation
                      ? `Khu vực này hiện chưa có dữ liệu địa điểm trong bán kính ${radiusKm}km. Bạn hãy thử tăng bán kính lên (10km - 20km) hoặc xóa từ khóa tìm kiếm để khám phá thêm địa điểm.`
                      : useGpsSearch
                        ? `Hiện dữ liệu chưa có điểm đến nào nằm trong bán kính ${radiusKm}km quanh tọa độ của bạn. Bạn hãy thử tăng bán kính lên (10km - 20km) hoặc tắt "Tìm quanh đây" để khám phá hơn 3.100 địa điểm khác trên toàn quốc.`
                        : keyword
                          ? `Không tìm thấy địa điểm nào khớp với "${keyword}". Hãy thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc.`
                          : "Hãy thử bỏ bớt một số tiện ích hoặc chọn 'Tất cả' để xem nhiều gợi ý hơn."
                  }
                  actionLabel={
                    pinNearbyCenter || geocodedLocation
                      ? radiusKm < 20
                        ? "Tăng bán kính lên 10km"
                        : "Bỏ ghim vị trí"
                      : useGpsSearch
                        ? "Tắt tìm quanh đây (Xem toàn quốc)"
                        : "Xóa bộ lọc tìm kiếm"
                  }
                  onAction={
                    pinNearbyCenter || geocodedLocation
                      ? radiusKm < 20
                        ? () => {
                            setRadiusKm(10);
                            setPage(1);
                          }
                        : handleClearPin
                      : useGpsSearch
                        ? () => setUseGpsSearch(false)
                        : resetFilters
                  }
                />
              )}
            </>
          )}
        </div>

            {/* Right Column: Map (VietMap) - Fully Stretched in Split View */}
            <div
              className={cn(
                "h-[calc(100vh-140px)] min-h-[500px] lg:h-full lg:min-h-0 rounded-2xl overflow-hidden shadow-xs border relative",
                showMobileMap ? "block" : "hidden lg:block"
              )}
            >
              <VietMapLoader
                places={discoveryPlaces}
                center={mapCenter}
                radiusKm={radiusKm}
                selectedPlaceId={selectedPlaceId}
                hoveredPlaceId={hoveredPlaceId}
                onSelectPlace={handleSelectPlace}
                onViewportChange={handleViewportChange}
                onRequestCurrentLocation={handleRequestCurrentLocation}
                locating={locating}
                selectedProvinceName={selectedProvinceName}
                userLocation={userLocation || null}
                geocodedPin={activeGeocodedPin}
                onMapClickDropPin={handleMapClickDropPin}
                routeToPinRequest={routeToPinRequest}
                onPinDragEnd={handlePinDragEnd}
                onSearchThisArea={handleSearchThisArea}
                travelAreas={travelAreas}
              />

              {/* Mobile Top-Right AI Advisor Button (Docked safely at top-right, away from carousel) */}
              {showMobileMap && (
                <div className="absolute top-3.5 right-3.5 z-20 lg:hidden">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("tripgenie:open-advisor"))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-primary font-bold text-xs shadow-md border border-primary/20 hover:bg-white active:scale-95 transition-all cursor-pointer"
                    title="Hỏi trợ lý AI về khu vực này"
                  >
                    <Sparkles className="size-3.5 text-amber-500 fill-amber-500" />
                    <span>Hỏi AI</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Carousel Overlay (Only active in mobile map view when places exist) */}
          {showMobileMap && places.length > 0 && (
            <div className="fixed bottom-20 inset-x-0 z-40 lg:hidden pointer-events-none">
              <MobileMapCarousel
                places={places}
                selectedPlaceId={selectedPlaceId}
                onSelectPlace={(p) => setSelectedPlaceId(p.id)}
                onNavigateDetail={(p) => router.push(`/places/${p.slug}`)}
                onRequestDirections={(p) => {
                  setSelectedPlaceId(p.id);
                  setRouteToPinRequest({
                    latitude: p.latitude,
                    longitude: p.longitude,
                    name: p.name,
                  });
                }}
              />
            </div>
          )}

          {/* Mobile Floating View Switcher (Airbnb style) */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 lg:hidden">
            <button
              type="button"
              onClick={() => setShowMobileMap((prev) => !prev)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-xs shadow-lg hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              {showMobileMap ? (
                <>
                  <List className="size-4 text-white" />
                  <span>Xem danh sách</span>
                </>
              ) : (
                <>
                  <MapIcon className="size-4 text-white" />
                  <span>Xem bản đồ</span>
                </>
              )}
            </button>
          </div>
        </div>

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

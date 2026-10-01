"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Users,
  Sparkles,
  RotateCcw,
  Loader2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Map as MapIcon,
  LocateFixed,
  Clock,
  Star,
  DollarSign,
  Compass,
  Navigation,
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
import { EmptyState } from "@/components/common/EmptyState";
import { VietMapLoader } from "@/components/map/VietMapLoader";
import { PhotoContributeModal } from "@/components/place/PhotoContributeModal";
import {
  placeService,
  type BackendTravelAreaItem,
  type GeocodedLocation,
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
        amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
        minRating: minRating || undefined,
        budgetLevels: selectedBudgetLevels.length > 0 ? selectedBudgetLevels : undefined,
        openNow: openNow ? true : undefined,
        latitude: effectiveLat,
        longitude: effectiveLng,
        radiusMeters: effectiveRadius,
        sortBy: pinNearbyCenter || useGpsSearch ? "distance" : "rating",
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
    } catch (err) {
      console.error("Error fetching places:", err);
    } finally {
      setLoading(false);
    }
  }, [
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
    pinNearbyCenter,
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

  // Map Center: fallback to geocoded pin, user location, or Da Nang
  const mapCenter = useMemo(() => {
    if (activeGeocodedPin) {
      return { latitude: activeGeocodedPin.lat, longitude: activeGeocodedPin.lng };
    }
    if (useGpsSearch && userLocation) {
      return userLocation;
    }
    if (places.length > 0 && places[0].latitude && places[0].longitude) {
      return { latitude: places[0].latitude, longitude: places[0].longitude };
    }
    return { latitude: 16.0544, longitude: 108.2022 };
  }, [activeGeocodedPin, useGpsSearch, userLocation, places]);

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
      setPinNearbyCenter(null);
      requestLocation();
    } else {
      setUseGpsSearch(false);
    }
    setPage(1);
  };

  // Reset all filters
  const resetFilters = () => {
    setKeyword("");
    setGeocodedLocation(null);
    setPinNearbyCenter(null);
    setRouteToPinRequest(null);
    setIsFallbackResult(false);
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

  // Drop a pin by clicking directly on the map
  const handleMapClickDropPin = useCallback((coords: { lat: number; lng: number }) => {
    setPinNearbyCenter(null);
    setRouteToPinRequest(null);
    setKeyword(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    setPage(1);
  }, []);

  // Drag a pin to a new position on the map
  const handlePinDragEnd = useCallback((coords: { lat: number; lng: number }) => {
    setPinNearbyCenter(null);
    setRouteToPinRequest(null);
    setKeyword(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    setPage(1);
  }, []);

  // Search this area when user pans/zooms map
  const handleSearchThisArea = useCallback((coords: { latitude: number; longitude: number }) => {
    setPinNearbyCenter({
      latitude: coords.latitude,
      longitude: coords.longitude,
      label: `Khu vực (${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)})`,
    });
    setPage(1);
    toast.info("Đang tìm kiếm các địa điểm trong khu vực này...");
  }, []);

  // Clear current pin and reset nearby searches
  const handleClearPin = useCallback(() => {
    setGeocodedLocation(null);
    setPinNearbyCenter(null);
    setRouteToPinRequest(null);
    setKeyword("");
    setPage(1);
  }, []);

  const isFiltering =
    keyword !== "" ||
    pinNearbyCenter !== null ||
    geocodedLocation !== null ||
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
        </div>
      </div>

      {/* Minimalist Text Tabs */}
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

      {/* Main Filter / Search Toolbar */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-3.5 shadow-2xs">
        {/* Active Pinned Center indicator if user clicked 'Tìm quanh đây' on a geocoded pin */}
        {pinNearbyCenter && (
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-primary/10 border border-primary/25 text-xs text-primary font-medium">
            <div className="flex items-center gap-2 truncate">
              <LocateFixed className="size-4 shrink-0 text-primary animate-pulse" />
              <span className="truncate">
                Đang khám phá quanh: <strong>{pinNearbyCenter.label}</strong> (Bán kính {radiusKm}km)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPinNearbyCenter(null);
                setPage(1);
              }}
              className="text-xs hover:underline font-bold ml-2 shrink-0 cursor-pointer"
            >
              Hủy bỏ
            </button>
          </div>
        )}

        {/* Row 1: Search Keyword, Province/City Select (34 Provinces Only), GPS Nearby Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Keyword Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                if (pinNearbyCenter) setPinNearbyCenter(null);
                setPage(1);
              }}
              placeholder="Tìm theo tên địa điểm, món ăn, không gian (tự động hiểu ngữ nghĩa NLP)..."
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

            {/* Quick Search Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">Gợi ý tìm kiếm:</span>
              {AI_SUGGESTIONS.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setKeyword(sug);
                    setPage(1);
                  }}
                  className="rounded-lg bg-muted/40 hover:bg-muted border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {sug}
                </button>
              ))}
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

        {/* Reset Filter Button if active */}
        {isFiltering && (
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-border/50">
            <span>
              Tìm thấy <strong className="text-foreground font-semibold">{totalCount}</strong> địa điểm phù hợp
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
            Đang tải dữ liệu địa điểm...
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* ================= MODE 1: FULL GRID ================= */
        <div className="space-y-4">
          {/* Pinned Geocoded Location Banner if query was an address or coordinate */}
          {geocodedLocation && (
            <div className="rounded-2xl border-2 border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/20 p-4 sm:p-5 space-y-3.5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <MapPin className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-100 dark:bg-rose-900/60 dark:text-rose-300 px-2 py-0.5 rounded-md">
                      Vị trí ghim trên bản đồ
                    </span>
                    <button
                      type="button"
                      onClick={handleClearPin}
                      className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 font-medium transition-colors cursor-pointer"
                    >
                      <X className="size-3.5" />
                      <span>Bỏ ghim</span>
                    </button>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground mt-1 leading-snug">
                    {geocodedLocation.displayName}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    Tọa độ: {geocodedLocation.lat.toFixed(5)}, {geocodedLocation.lng.toFixed(5)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-rose-200 dark:border-rose-900/50">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                    <Compass className="size-3.5 text-rose-600" />
                    <span>Quét quanh đây:</span>
                  </span>
                  {[1, 3, 5, 10].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setPinNearbyCenter({
                          latitude: geocodedLocation.lat,
                          longitude: geocodedLocation.lng,
                          label: geocodedLocation.displayName,
                        });
                        setKeyword("");
                        setRadiusKm(r as RadiusKm);
                        setPage(1);
                      }}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs cursor-pointer"
                    >
                      {r}km
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("split");
                      setRouteToPinRequest({
                        latitude: geocodedLocation.lat,
                        longitude: geocodedLocation.lng,
                        name: geocodedLocation.displayName,
                      });
                    }}
                    className="rounded-xl px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Navigation className="size-3.5" />
                    <span>Chỉ đường tới đây</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("split")}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold bg-background hover:bg-muted border border-border text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <MapIcon className="size-3.5" />
                    <span>Xem bản đồ</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fallback Banner if applicable */}
          {isFallbackResult && places.length > 0 && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
              <Sparkles className="size-4 shrink-0 text-amber-600" />
              <span>
                Không tìm thấy địa điểm chính xác cho <strong>&quot;{keyword}&quot;</strong>. Hệ thống AI gợi ý các địa điểm ngữ nghĩa tương tự:
              </span>
            </div>
          )}

          {places.length > 0 ? (
            <>
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
              {totalPages > 1 && (
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
            </>
          ) : !geocodedLocation ? (
            <EmptyState
              title={
                useGpsSearch
                  ? `Không có địa điểm nào trong bán kính ${radiusKm}km quanh vị trí của bạn`
                  : "Không tìm thấy địa điểm phù hợp"
              }
              description={
                useGpsSearch
                  ? `Hiện dữ liệu chưa có điểm đến nào nằm trong bán kính ${radiusKm}km quanh tọa độ của bạn. Bạn hãy thử tăng bán kính lên (10km - 20km) hoặc tắt "Tìm quanh đây" để khám phá hơn 3.100 địa điểm khác trên toàn quốc.`
                  : "Hãy thử bỏ bớt một số tiện ích hoặc chọn 'Tất cả' để xem nhiều gợi ý hơn."
              }
              actionLabel={useGpsSearch ? "Tắt tìm quanh đây (Xem toàn quốc)" : "Xóa bộ lọc tìm kiếm"}
              onAction={useGpsSearch ? () => setUseGpsSearch(false) : resetFilters}
            />
          ) : null}
        </div>
      ) : (
        /* ================= MODE 2: AIRBNB SPLIT-VIEW ================= */
        /* In Split View: ALWAYS KEEP 2 COLUMNS WITH MAP MOUNTED! */
        <div className="lg:grid lg:grid-cols-[minmax(0,48%)_minmax(0,52%)] lg:gap-6 items-start">
          {/* Left Column: Places List or Geocoded Pin or Empty */}
          <div className="flex flex-col gap-4">
            {/* Pinned Geocoded Location Banner if query was an address or coordinate */}
            {geocodedLocation && (
              <div className="rounded-2xl border-2 border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/20 p-4 sm:p-5 space-y-3.5 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <MapPin className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-100 dark:bg-rose-900/60 dark:text-rose-300 px-2 py-0.5 rounded-md">
                        Vị trí ghim trên bản đồ
                      </span>
                      <button
                        type="button"
                        onClick={handleClearPin}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 font-medium transition-colors cursor-pointer"
                      >
                        <X className="size-3.5" />
                        <span>Bỏ ghim</span>
                      </button>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground mt-1 leading-snug">
                      {geocodedLocation.displayName}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      Tọa độ: {geocodedLocation.lat.toFixed(5)}, {geocodedLocation.lng.toFixed(5)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-rose-200 dark:border-rose-900/50">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                      <Compass className="size-3.5 text-rose-600" />
                      <span>Quét quanh đây:</span>
                    </span>
                    {[1, 3, 5, 10].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setPinNearbyCenter({
                            latitude: geocodedLocation.lat,
                            longitude: geocodedLocation.lng,
                            label: geocodedLocation.displayName,
                          });
                          setKeyword("");
                          setRadiusKm(r as RadiusKm);
                          setPage(1);
                        }}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs cursor-pointer"
                      >
                        {r}km
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRouteToPinRequest({
                        latitude: geocodedLocation.lat,
                        longitude: geocodedLocation.lng,
                        name: geocodedLocation.displayName,
                      });
                    }}
                    className="rounded-xl px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Navigation className="size-3.5" />
                    <span>Chỉ đường tới đây</span>
                  </button>
                </div>
              </div>
            )}

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
                {totalPages > 1 && (
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
              </>
            ) : !geocodedLocation ? (
              <EmptyState
                title={
                  useGpsSearch
                    ? `Không có địa điểm nào trong bán kính ${radiusKm}km quanh vị trí của bạn`
                    : "Không tìm thấy địa điểm phù hợp"
                }
                description={
                  useGpsSearch
                    ? `Hiện dữ liệu chưa có điểm đến nào nằm trong bán kính ${radiusKm}km quanh tọa độ của bạn. Bạn hãy thử tăng bán kính lên (10km - 20km) hoặc tắt "Tìm quanh đây" để khám phá hơn 3.100 địa điểm khác trên toàn quốc.`
                    : "Hãy thử bỏ bớt một số tiện ích hoặc chọn 'Tất cả' để xem nhiều gợi ý hơn."
                }
                actionLabel={useGpsSearch ? "Tắt tìm quanh đây (Xem toàn quốc)" : "Xóa bộ lọc tìm kiếm"}
                onAction={useGpsSearch ? () => setUseGpsSearch(false) : resetFilters}
              />
            ) : null}
          </div>

          {/* Right Column: Sticky Map (VietMap) - ALWAYS MOUNTED AND ACTIVE! */}
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
              onRequestCurrentLocation={() => {
                setUseGpsSearch(true);
                setPinNearbyCenter(null);
                setPage(1);
                requestLocation();
              }}
              locating={locating}
              selectedProvinceName={selectedProvinceName}
              userLocation={userLocation || null}
              geocodedPin={activeGeocodedPin}
              onMapClickDropPin={handleMapClickDropPin}
              routeToPinRequest={routeToPinRequest}
              onPinDragEnd={handlePinDragEnd}
              onSearchThisArea={handleSearchThisArea}
            />
          </div>
        </div>
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

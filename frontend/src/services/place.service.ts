import { apiClient } from "@/lib/api-client";
import { Place, PlaceCategory, SuitableAudience, TravelStyle } from "@/types/place";
import { MOCK_PLACES } from "@/mocks/data/places";

export interface BackendCategoryItem {
  id: number;
  name: string;
  nameVi: string | null;
  slug: string;
  iconUrl: string | null;
  sortOrder: number;
  placeCount?: number;
}

export interface BackendTravelAreaItem {
  id: number;
  name: string;
  nameVi: string | null;
  slug: string;
  type: string;
  bbox: {
    minLat: number | null;
    maxLat: number | null;
    minLng: number | null;
    maxLng: number | null;
  };
  latitude?: number | null;
  longitude?: number | null;
  hubBadge?: string | null;
}

export interface PlaceFilterParams {
  keyword?: string;
  category?: PlaceCategory | "all" | string;
  categorySlugs?: string[] | string;
  amenities?: string[] | string;
  city?: string;
  areaId?: number;
  suitableFor?: SuitableAudience;
  minRating?: number;
  budgetLevels?: string[] | string;
  openNow?: boolean;
  featuredOnly?: boolean;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  page?: number;
  limit?: number;
  sortBy?: "rating" | "reviews" | "name" | "distance";
}

export interface GeocodedLocation {
  lat: number;
  lng: number;
  displayName: string;
}

export interface PaginatedPlacesResult {
  places: Place[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  geocoded?: GeocodedLocation;
  isFallback?: boolean;
}



function mapBudgetLevel(level?: string | null): {
  priceLevel?: 1 | 2 | 3 | 4;
  priceRangeText?: string;
} {
  switch (level) {
    case "LOW":
      return { priceLevel: 1, priceRangeText: "Dưới 50.000đ" };
    case "MEDIUM":
      return { priceLevel: 2, priceRangeText: "50.000đ - 150.000đ" };
    case "HIGH":
      return { priceLevel: 3, priceRangeText: "150.000đ - 500.000đ" };
    case "LUXURY":
      return { priceLevel: 4, priceRangeText: "Trên 500.000đ" };
    default:
      return { priceLevel: undefined, priceRangeText: undefined };
  }
}

function mapCategorySlug(slug?: string | null): {
  category: PlaceCategory;
  label: string;
} {
  if (!slug) return { category: "sightseeing", label: "Điểm tham quan" };

  switch (slug) {
    case "ca-phe":
    case "cafe":
      return { category: "cafe", label: "Quán Cafe" };
    case "nha-hang":
    case "restaurant":
      return { category: "restaurant", label: "Nhà hàng ẩm thực" };
    case "an-vat-via-he":
      return { category: "restaurant", label: "Ẩm thực đường phố" };
    case "thien-nhien":
    case "nature":
      return { category: "nature", label: "Thiên nhiên & Biển" };
    case "diem-tham-quan":
    case "sightseeing":
      return { category: "sightseeing", label: "Điểm tham quan" };
    case "di-tich-lich-su":
    case "culture":
      return { category: "culture", label: "Di tích lịch sử" };
    case "vui-choi":
    case "entertainment":
      return { category: "entertainment", label: "Vui chơi giải trí" };
    case "cho-sieu-thi":
    case "shopping":
      return { category: "entertainment", label: "Chợ & Mua sắm" };
    case "khach-san":
    case "hotel":
      return { category: "relaxation", label: "Khách sạn & Resort" };
    case "homestay":
      return { category: "relaxation", label: "Homestay nghỉ dưỡng" };
    case "bar-pub":
    case "nightlife":
      return { category: "nightlife", label: "Bar & Về đêm" };
    case "spa":
    case "relaxation":
      return { category: "relaxation", label: "Spa & Nghỉ dưỡng" };
    default:
      return { category: "sightseeing", label: "Điểm đến" };
  }
}

export interface BackendPlaceItem {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  latitude?: number;
  longitude?: number;
  ratingAvg?: number | null;
  reviewCount?: number | null;
  imageCount?: number;
  priceLevel?: string | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: Record<string, unknown> | null;
  isOpenNow?: boolean | null;
  primaryImage?: string | null;
  images?: Array<string | { imageUrl: string }>;
  tags?: string[];
  category?: {
    id?: number;
    name?: string;
    nameVi?: string | null;
    slug?: string;
    iconUrl?: string | null;
  } | null;
  area?: {
    id?: number;
    name?: string;
    nameVi?: string | null;
    slug?: string;
  } | null;
  similarityScore?: number | null;
}

export function optimizeImageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  // If already proxied or from unsplash, return directly
  if (trimmed.includes("wsrv.nl") || trimmed.includes("unsplash.com")) {
    return trimmed;
  }

  // If from wikimedia / wikipedia, strip tracking query parameters but keep direct image URL
  if (trimmed.includes("wikimedia.org") || trimmed.includes("wikipedia.org")) {
    return trimmed.split("?")[0];
  }

  return trimmed;
}

export function mapBackendPlaceToPlace(dto: BackendPlaceItem): Place {
  const { priceLevel, priceRangeText } = mapBudgetLevel(dto.priceLevel);
  const catMapping = mapCategorySlug(dto.category?.slug);
  const rawPrimary = dto.primaryImage || (dto.images?.[0] ? (typeof dto.images[0] === "string" ? dto.images[0] : dto.images[0].imageUrl) : "");
  const coverImage = optimizeImageUrl(rawPrimary);

  const imagesList = Array.isArray(dto.images) && dto.images.length > 0
    ? dto.images.map((img) => optimizeImageUrl(typeof img === "string" ? img : img.imageUrl)).filter(Boolean)
    : (coverImage ? [coverImage] : []);

  const city = dto.city || dto.area?.nameVi || dto.area?.name || "Đà Nẵng";
  const tags: string[] = Array.isArray(dto.tags) && dto.tags.length > 0
    ? dto.tags
    : [dto.category?.nameVi || catMapping.label, city].filter(Boolean);

  const suitableFor: SuitableAudience[] = ["friends", "couple", "solo", "family"];
  const styles: TravelStyle[] = ["chill", "checkin", "foodie"];

  const matchScore = dto.similarityScore
    ? Math.min(99, Math.max(50, Math.round(dto.similarityScore * 100)))
    : undefined;

  let openingHoursText: string | undefined = undefined;
  if (dto.isOpenNow !== null && dto.isOpenNow !== undefined) {
    openingHoursText = dto.isOpenNow ? "Đang mở cửa" : "Đã đóng cửa";
  }

  const realRating = dto.ratingAvg ? Number(dto.ratingAvg) : 0;
  const realReviews = dto.reviewCount ? Number(dto.reviewCount) : 0;

  const whyGo: string[] = [];
  if (dto.address) whyGo.push(`Tọa lạc tại vị trí: ${dto.address}`);
  if (realRating > 0) whyGo.push(`Được đánh giá ${realRating.toFixed(1)}/5 sao từ ${realReviews} lượt nhận xét`);
  if (dto.category?.nameVi) whyGo.push(`Điểm đến thuộc nhóm ${dto.category.nameVi}`);

  return {
    id: dto.id,
    slug: dto.id, // Primary routing key: UUID
    name: dto.name,
    tagline: dto.description
      ? dto.description.slice(0, 110) + (dto.description.length > 110 ? "..." : "")
      : undefined,
    description: dto.description || `Địa điểm ${dto.name} tọa lạc tại ${dto.address || city}.`,
    whyGo: whyGo.length > 0 ? whyGo : undefined,
    tips: undefined,
    suggestedDuration: "1 - 2 giờ",
    category: catMapping.category,
    categoryLabel: dto.category?.nameVi || dto.category?.name || catMapping.label,
    address: dto.address || city,
    city,
    latitude: Number(dto.latitude) || 16.0544,
    longitude: Number(dto.longitude) || 108.2022,
    rating: realRating,
    reviewCount: realReviews,
    priceLevel,
    priceRangeText,
    images: imagesList,
    coverImage,
    phone: dto.phone || undefined,
    website: dto.website || undefined,
    tags,
    suitableFor,
    styles,
    matchScore,
    matchReason: matchScore
      ? `Độ tương đồng ngữ nghĩa AI ${matchScore}% với tìm kiếm của bạn`
      : undefined,
    openingHoursText,
    featured: realRating >= 4.5 || Boolean(dto.imageCount && dto.imageCount > 0),
  };
}

export const placeService = {
  /**
   * Search places with pagination and multi-criteria filters.
   * Connects to backend GET /places/search with fallback to mock data.
   */
  async searchPlaces(
    params?: PlaceFilterParams,
    options: { allowMockFallback?: boolean } = { allowMockFallback: true }
  ): Promise<PaginatedPlacesResult> {
    try {
      const searchParams = new URLSearchParams();

      if (params?.keyword?.trim()) searchParams.set("keyword", params.keyword.trim());
      if (params?.areaId) searchParams.set("areaId", String(params.areaId));
      if (params?.suitableFor) searchParams.set("suitableFor", params.suitableFor);

      if (params?.categorySlugs) {
        const val = Array.isArray(params.categorySlugs)
          ? params.categorySlugs.join(",")
          : params.categorySlugs;
        if (val && val !== "all") searchParams.set("categorySlugs", val);
      } else if (params?.category && params.category !== "all") {
        searchParams.set("categorySlugs", params.category);
      }

      if (params?.amenities) {
        const val = Array.isArray(params.amenities) ? params.amenities.join(",") : params.amenities;
        if (val) searchParams.set("amenities", val);
      }
      if (params?.minRating) searchParams.set("minRating", String(params.minRating));
      if (params?.sortBy) {
        const sortMap: Record<string, string> = {
          rating: "RATING", distance: "DISTANCE", reviews: "POPULARITY", name: "NAME",
        };
        searchParams.set("sortBy", sortMap[params.sortBy] ?? "RATING");
      }
      if (typeof params?.latitude === "number" && typeof params?.longitude === "number") {
        searchParams.set("lat", String(params.latitude));
        searchParams.set("lng", String(params.longitude));
      }
      if (params?.radiusMeters) searchParams.set("radiusMeters", String(params.radiusMeters));
      if (params?.budgetLevels) {
        const valid = ["LOW", "MEDIUM", "HIGH", "LUXURY"];
        const filtered = (Array.isArray(params.budgetLevels) ? params.budgetLevels : [params.budgetLevels])
          .filter((l) => valid.includes(l));
        if (filtered.length > 0) searchParams.set("budgetLevels", filtered.join(","));
      }
      if (typeof params?.openNow === "boolean") searchParams.set("openNow", String(params.openNow));

      const requestedLimit = params?.limit || 24;
      searchParams.set("page", String(params?.page || 1));
      searchParams.set("limit", String(requestedLimit));

      const payload = await apiClient<{
        items: BackendPlaceItem[];
        meta: { totalItems: number; page: number; limit: number; totalPages: number };
        geocoded?: GeocodedLocation;
        isFallback?: boolean;
      }>(`/places/search?${searchParams.toString()}`);

      const rawItems = Array.isArray(payload.items) ? payload.items : [];
      const items = rawItems.slice(0, requestedLimit);
      const meta = payload.meta ?? { totalItems: rawItems.length, page: params?.page || 1, limit: requestedLimit, totalPages: 1 };

      const mappedPlaces: Place[] = items.map(mapBackendPlaceToPlace);
      // Prioritize places with real images first
      mappedPlaces.sort((a, b) => {
        const aHas = Boolean(a.coverImage || a.images?.length);
        const bHas = Boolean(b.coverImage || b.images?.length);
        return aHas === bHas ? 0 : aHas ? -1 : 1;
      });

      return {
        places: mappedPlaces,
        total: meta.totalItems,
        page: meta.page,
        limit: meta.limit,
        totalPages: meta.totalPages,
        geocoded: payload.geocoded,
        isFallback: payload.isFallback,
      };
    } catch (err) {
      if (options?.allowMockFallback === false) {
        throw err;
      }
      console.warn("Backend search places unavailable, falling back to mock data:", err);
      let places = [...MOCK_PLACES];
      if (params?.keyword) {
        const q = params.keyword.toLowerCase().trim();
        places = places.filter(
          (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) ||
            p.city.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      if (params?.category && params.category !== "all") {
        places = places.filter((p) => p.category === params.category);
      }
      const fallbackLimit = params?.limit || 20;
      return {
        places: places.slice(0, fallbackLimit),
        total: places.length,
        page: 1,
        limit: fallbackLimit,
        totalPages: Math.ceil(places.length / fallbackLimit) || 1,
      };
    }
  },

  /**
   * Simple list endpoint used by usePlacesQuery and PlaceSearchDialog.
   */
  async getPlaces(params?: PlaceFilterParams): Promise<Place[]> {
    const res = await this.searchPlaces(params);
    return res.places;
  },

  /**
   * Natural language AI Semantic Search using Gemini Vector Embeddings & pgvector.
   * Connects to GET /places/semantic-search
   */
  async searchSemantic(query: string, areaId?: number, limit = 12): Promise<Place[]> {
    try {
      const searchParams = new URLSearchParams({ query: query.trim(), limit: String(limit) });
      if (areaId) searchParams.set("areaId", String(areaId));

      const json = await apiClient<BackendPlaceItem[] | { data: BackendPlaceItem[] }>(
        `/places/semantic-search?${searchParams.toString()}`
      );
      const items = Array.isArray(json) ? json : (Array.isArray((json as any).data) ? (json as any).data : []);
      return items.map(mapBackendPlaceToPlace);
    } catch (err) {
      console.warn("Semantic search failed or offline, fallback to keyword search:", err);
      return this.getPlaces({ keyword: query });
    }
  },

  /**
   * Fetch standard tourism categories from backend.
   */
  async getCategories(): Promise<BackendCategoryItem[]> {
    try {
      const data = await apiClient<BackendCategoryItem[]>("/places/categories");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn("Failed to fetch categories, using default categories:", err);
      return [
        { id: 1, name: "Attraction", nameVi: "Điểm tham quan", slug: "diem-tham-quan", iconUrl: "landmark", sortOrder: 1 },
        { id: 2, name: "Historical", nameVi: "Di tích lịch sử", slug: "di-tich-lich-su", iconUrl: "monument", sortOrder: 2 },
        { id: 3, name: "Nature & Beach", nameVi: "Thiên nhiên & Biển", slug: "thien-nhien", iconUrl: "mountain-sun", sortOrder: 3 },
        { id: 4, name: "Restaurant", nameVi: "Nhà hàng ẩm thực", slug: "nha-hang", iconUrl: "utensils", sortOrder: 4 },
        { id: 5, name: "Cafe & Dessert", nameVi: "Cà phê & Tráng miệng", slug: "ca-phe", iconUrl: "coffee", sortOrder: 5 },
        { id: 6, name: "Street Food", nameVi: "Ẩm thực đường phố", slug: "an-vat-via-he", iconUrl: "bowl-food", sortOrder: 6 },
        { id: 7, name: "Entertainment", nameVi: "Vui chơi giải trí", slug: "vui-choi", iconUrl: "ticket", sortOrder: 7 },
        { id: 8, name: "Shopping & Market", nameVi: "Chợ & Mua sắm", slug: "cho-sieu-thi", iconUrl: "bag-shopping", sortOrder: 8 },
        { id: 9, name: "Hotel & Resort", nameVi: "Khách sạn & Resort", slug: "khach-san", iconUrl: "hotel", sortOrder: 9 },
        { id: 10, name: "Homestay", nameVi: "Homestay nghỉ dưỡng", slug: "homestay", iconUrl: "house", sortOrder: 10 },
        { id: 11, name: "Bar & Nightlife", nameVi: "Bar & Cuộc sống đêm", slug: "bar-pub", iconUrl: "martini-glass", sortOrder: 11 },
        { id: 12, name: "Spa & Wellness", nameVi: "Spa & Chăm sóc sức khỏe", slug: "spa", iconUrl: "spa", sortOrder: 12 },
      ];
    }
  },

  /**
   * Fetch active travel areas (Vietnam provinces & Da Nang districts).
   */
  async getTravelAreas(): Promise<BackendTravelAreaItem[]> {
    try {
      const data = await apiClient<BackendTravelAreaItem[]>("/places/travel-areas");
      return Array.isArray(data) && data.length > 0 ? data : [];
    } catch (err) {
      console.warn("Failed to fetch travel areas from backend, using defaults", err);
      return [
        { id: 5, name: "Da Nang City", nameVi: "Thành phố Đà Nẵng", slug: "da-nang", type: "CITY", bbox: { minLat: 15.9, maxLat: 16.2, minLng: 107.9, maxLng: 108.4 } },
        { id: 1, name: "Hanoi City", nameVi: "Thành phố Hà Nội", slug: "ha-noi", type: "CITY", bbox: { minLat: 20.8, maxLat: 21.4, minLng: 105.5, maxLng: 106.1 } },
        { id: 3, name: "Ho Chi Minh City", nameVi: "TP. Hồ Chí Minh", slug: "ho-chi-minh", type: "CITY", bbox: { minLat: 10.3, maxLat: 11.2, minLng: 106.3, maxLng: 107.1 } },
      ];
    }
  },

  /**
   * Get single place by UUID or slug.
   */
  async getPlaceBySlug(slug: string): Promise<Place | null> {
    try {
      const decoded = decodeURIComponent(slug);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded);
      if (isUuid) {
        try {
          const data = await apiClient<BackendPlaceItem>(`/places/${decoded}`);
          return mapBackendPlaceToPlace(data);
        } catch {
          // fall through to mock/search fallback
        }
      }

      const found = MOCK_PLACES.find((p) => p.slug === slug || p.slug === decoded || p.id === slug);
      if (found) return found;

      const cleanKeyword = decoded.replace(/-/g, " ").trim();
      let searchRes = await this.searchPlaces({ keyword: cleanKeyword, limit: 1 });
      if (searchRes.places.length > 0) {
        return searchRes.places[0];
      }
      const words = cleanKeyword.split(/\s+/);
      if (words.length > 2) {
        searchRes = await this.searchPlaces({ keyword: words.slice(0, 2).join(" "), limit: 1 });
        if (searchRes.places.length > 0) {
          return searchRes.places[0];
        }
      }

      return null;
    } catch (err) {
      console.warn("Failed to get place by slug:", err);
      const found = MOCK_PLACES.find((p) => p.slug === slug);
      return found || null;
    }
  },

  async getPlaceById(id: string): Promise<Place | null> {
    return this.getPlaceBySlug(id);
  },

  /**
   * Get related places near a place.
   */
  async getRelatedPlaces(currentPlaceId: string, limit = 3): Promise<Place[]> {
    try {
      const searchRes = await this.searchPlaces({ limit: limit + 1 });
      const filtered = searchRes.places.filter((p) => p.id !== currentPlaceId);
      return filtered.slice(0, limit);
    } catch {
      const current = MOCK_PLACES.find((p) => p.id === currentPlaceId);
      if (!current) return MOCK_PLACES.slice(0, limit);
      return MOCK_PLACES.filter((p) => p.id !== currentPlaceId).slice(0, limit);
    }
  },
};

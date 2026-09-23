import { Place, PlaceCategory, SuitableAudience, TravelStyle } from "@/types/place";
import { MOCK_PLACES } from "@/mocks/data/places";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

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

export interface PaginatedPlacesResult {
  places: Place[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  address?: string;
  district?: string | null;
  city?: string | null;
  latitude?: number;
  longitude?: number;
  ratingAvg?: number;
  reviewCount?: number;
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

  // If from wikimedia / wikipedia, route through wsrv.nl Cloudflare image proxy
  // Stripping cache-busting / tracking query parameters that trigger upstream 429
  if (trimmed.includes("wikimedia.org") || trimmed.includes("wikipedia.org")) {
    const cleanUrl = trimmed.split("?")[0].replace(/^https?:\/\//, "");
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=800&output=webp`;
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
  async searchPlaces(params?: PlaceFilterParams): Promise<PaginatedPlacesResult> {
    try {
      const url = new URL(`${API_BASE_URL}/places/search`);

      if (params?.keyword?.trim()) {
        url.searchParams.set("keyword", params.keyword.trim());
      }
      if (params?.areaId) {
        url.searchParams.set("areaId", String(params.areaId));
      }
      if (params?.categorySlugs) {
        const val = Array.isArray(params.categorySlugs)
          ? params.categorySlugs.join(",")
          : params.categorySlugs;
        if (val && val !== "all") {
          url.searchParams.set("categorySlugs", val);
        }
      } else if (params?.category && params.category !== "all") {
        url.searchParams.set("categorySlugs", params.category);
      }

      if (params?.amenities) {
        const val = Array.isArray(params.amenities)
          ? params.amenities.join(",")
          : params.amenities;
        if (val) {
          url.searchParams.set("amenities", val);
        }
      }
      if (params?.minRating) {
        url.searchParams.set("minRating", String(params.minRating));
      }
      if (params?.sortBy) {
        const sortMap: Record<string, string> = {
          rating: "RATING",
          distance: "DISTANCE",
          reviews: "POPULARITY",
          name: "NAME",
          RATING: "RATING",
          DISTANCE: "DISTANCE",
          POPULARITY: "POPULARITY",
          NAME: "NAME",
        };
        url.searchParams.set("sortBy", sortMap[params.sortBy] || "RATING");
      }
      if (typeof params?.latitude === "number" && typeof params?.longitude === "number") {
        url.searchParams.set("lat", String(params.latitude));
        url.searchParams.set("lng", String(params.longitude));
        url.searchParams.set("latitude", String(params.latitude));
        url.searchParams.set("longitude", String(params.longitude));
      }
      if (params?.radiusMeters) {
        url.searchParams.set("radiusMeters", String(params.radiusMeters));
      }
      if (params?.budgetLevels) {
        const raw = Array.isArray(params.budgetLevels)
          ? params.budgetLevels
          : [params.budgetLevels];
        const validLevels = ["LOW", "MEDIUM", "HIGH", "LUXURY"];
        const filtered = raw.filter((l) => validLevels.includes(l));
        if (filtered.length > 0) {
          url.searchParams.set("budgetLevels", filtered.join(","));
        }
      }
      if (typeof params?.openNow === "boolean") {
        url.searchParams.set("openNow", String(params.openNow));
      }
      const requestedLimit = params?.limit || 24;
      url.searchParams.set("page", String(params?.page || 1));
      url.searchParams.set("limit", String(requestedLimit));

      let res: Response;
      const isServer = typeof window === "undefined";
      const fetchOptions: RequestInit = {
        headers: { "Content-Type": "application/json" },
        ...(isServer ? { next: { revalidate: 60 } } : { cache: "no-store" }),
      };
      try {
        res = await fetch(url.toString(), fetchOptions);
      } catch (fetchErr) {
        if (API_BASE_URL.includes("localhost")) {
          const fallbackUrlStr = url.toString().replace("localhost", "127.0.0.1");
          res = await fetch(fallbackUrlStr, fetchOptions);
        } else {
          throw fetchErr;
        }
      }

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const json = await res.json();
      const payload = json.data || json;
      const rawItems = Array.isArray(payload.items) ? payload.items : [];
      const items = rawItems.slice(0, requestedLimit);
      const meta = payload.meta || {
        totalItems: rawItems.length,
        page: params?.page || 1,
        limit: requestedLimit,
        totalPages: 1,
      };

      const mappedPlaces: Place[] = items.map(mapBackendPlaceToPlace);
      // Always prioritize places with real images at the top
      mappedPlaces.sort((a: Place, b: Place) => {
        const aHas = Boolean(a.coverImage || (a.images && a.images.length > 0));
        const bHas = Boolean(b.coverImage || (b.images && b.images.length > 0));
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return 0;
      });

      return {
        places: mappedPlaces,
        total: meta.totalItems,
        page: meta.page,
        limit: meta.limit,
        totalPages: meta.totalPages,
      };
    } catch (err) {
      console.warn("Backend search places unavailable, falling back to mock data:", err);
      let places = [...MOCK_PLACES];
      if (params?.keyword) {
        const q = params.keyword.toLowerCase().trim();
        places = places.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.address.toLowerCase().includes(q) ||
            p.city.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      if (params?.category && params.category !== "all") {
        places = places.filter((p) => p.category === params.category);
      }
      const fallbackLimit = params?.limit || 20;
      const paginated = places.slice(0, fallbackLimit);
      return {
        places: paginated,
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
  async searchSemantic(
    query: string,
    areaId?: number,
    limit = 12
  ): Promise<Place[]> {
    try {
      const url = new URL(`${API_BASE_URL}/places/semantic-search`);
      url.searchParams.set("query", query.trim());
      if (areaId) {
        url.searchParams.set("areaId", String(areaId));
      }
      url.searchParams.set("limit", String(limit));

      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Semantic search returned ${res.status}`);
      }

      const json = await res.json();
      const items = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
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
      const res = await fetch(`${API_BASE_URL}/places/categories`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Categories API returned ${res.status}`);
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
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
    const urlsToTry = [
      `${API_BASE_URL}/places/travel-areas`,
      API_BASE_URL.includes("localhost")
        ? `${API_BASE_URL.replace("localhost", "127.0.0.1")}/places/travel-areas`
        : null,
    ].filter(Boolean) as string[];

    for (const url of urlsToTry) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
          if (items.length > 0) return items;
        }
      } catch {
        // try next URL
      }
    }

    console.warn("Failed to fetch travel areas from backend, using defaults");
    return [
      { id: 5, name: "Da Nang City", nameVi: "Thành phố Đà Nẵng", slug: "da-nang", type: "CITY", bbox: { minLat: 15.9, maxLat: 16.2, minLng: 107.9, maxLng: 108.4 } },
      { id: 1, name: "Hanoi City", nameVi: "Thành phố Hà Nội", slug: "ha-noi", type: "CITY", bbox: { minLat: 20.8, maxLat: 21.4, minLng: 105.5, maxLng: 106.1 } },
      { id: 3, name: "Ho Chi Minh City", nameVi: "TP. Hồ Chí Minh", slug: "ho-chi-minh", type: "CITY", bbox: { minLat: 10.3, maxLat: 11.2, minLng: 106.3, maxLng: 107.1 } },
    ];
  },

  /**
   * Get single place by UUID or slug.
   */
  async getPlaceBySlug(slug: string): Promise<Place | null> {
    try {
      const decoded = decodeURIComponent(slug);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded);
      if (isUuid) {
        const res = await fetch(`${API_BASE_URL}/places/${decoded}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          return mapBackendPlaceToPlace(json.data || json);
        }
      }

      const found = MOCK_PLACES.find((p) => p.slug === slug || p.slug === decoded || p.id === slug);
      if (found) return found;

      const searchRes = await this.searchPlaces({ keyword: decoded, limit: 1 });
      if (searchRes.places.length > 0) {
        return searchRes.places[0];
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

import type { Place, PlaceCategory } from "@/types/place";

export type { Place, PlaceCategory };

export const MAP_RADIUS_OPTIONS = [1, 3, 5, 10, 20] as const;
export type RadiusKm = (typeof MAP_RADIUS_OPTIONS)[number];
export type MapRadiusKm = RadiusKm;

export type SearchMode = "keyword" | "ai";
export type SortKey = "rating" | "reviews" | "distance";

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface DiscoveryFilters extends MapCoordinate {
  mode: SearchMode;
  areaSlug: string;
  keyword: string;
  categorySlug: string; // "all" means all categories
  radiusKm: RadiusKm;
  openNow: boolean;
  priceLevels: number[]; // 1, 2, 3, 4
  maxPriceVnd?: number | null;
  minRating: number | null;
  sortBy: SortKey;
  page: number;

  // Backward compatibility fields
  maxDistanceKm?: RadiusKm;
  city?: string;
  category?: PlaceCategory | "all";
}

export type MapFilters = DiscoveryFilters;

export interface DiscoveryPlace {
  id: string;
  slug: string;
  name: string;
  category: string; // "ca-phe", "nha-hang", "khach-san", "bar-pub", "an-vat", "diem-tham-quan", "bai-bien"
  categoryLabel: string;
  areaSlug: string;
  areaName: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  reviewCount: number;
  priceLevel: number | null; // 1, 2, 3, 4
  isOpenNow: boolean | null;
  primaryImage: string | null;
  images: string[];
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  tags: string[];
  sources?: { provider: string; url?: string }[];
  demoSimilarityScore?: number;
  distanceKm?: number;
}

export interface DiscoveryCategory {
  slug: string;
  name: string;
  icon?: string;
  placeCount: number;
}

export interface DiscoveryArea {
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: RadiusKm;
}

export interface DiscoveryPage {
  items: DiscoveryPlace[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ParsedMapQuery {
  filters: DiscoveryFilters;
  hasExplicitCenter: boolean;
}

export interface NearbyPlace {
  place: Place | DiscoveryPlace;
  distanceKm: number;
}

export interface MapViewport extends MapCoordinate {
  zoom: number;
}

export interface VietMapProps {
  places: (NearbyPlace | DiscoveryPlace)[];
  center: MapCoordinate;
  radiusKm: RadiusKm;
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
  onViewportChange: (viewport: MapViewport) => void;
  onRequestCurrentLocation: () => void;
  locating: boolean;
  selectedProvinceName?: string | null;
  userLocation?: MapCoordinate | null;
}

import { z } from "zod";
import type { PlaceCategory } from "@/types/place";
import type {
  DiscoveryFilters,
  ParsedMapQuery,
  RadiusKm,
  SearchMode,
  SortKey,
} from "../types";
import { DEFAULT_MAP_CENTER } from "../map-config";

const radiusSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(10), z.literal(20)]));

const sortBySchema = z.enum(["rating", "reviews", "distance"]);
const modeSchema = z.enum(["keyword", "ai"]);

function parseCoordinate(raw: string | null, min: number, max: number): number | null {
  if (!raw?.trim()) return null;
  const val = Number(raw);
  if (Number.isNaN(val) || val < min || val > max) return null;
  return val;
}

function parsePriceLevels(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 4);
}

export function parseMapSearchParams(params: URLSearchParams): ParsedMapQuery {
  const rawLat = params.get("latitude") ?? params.get("lat");
  const rawLng = params.get("longitude") ?? params.get("lng");
  const latitude = parseCoordinate(rawLat, -90, 90);
  const longitude = parseCoordinate(rawLng, -180, 180);
  const hasExplicitCenter = latitude !== null && longitude !== null;

  const modeParsed = modeSchema.safeParse(params.get("mode"));
  const mode: SearchMode = modeParsed.success ? modeParsed.data : "keyword";

  const areaSlug = params.get("areaSlug") || params.get("area") || "da-nang";
  const categorySlug = params.get("categorySlug") || params.get("category") || "all";
  const keyword = params.get("keyword") ?? "";

  const rawRadius = params.get("radiusKm") ?? params.get("maxDistanceKm");
  const radiusParsed = radiusSchema.safeParse(rawRadius);
  const radiusKm: RadiusKm = radiusParsed.success ? radiusParsed.data : 5;

  const rawOpenNow = params.get("openNow");
  const openNow = rawOpenNow === "true";

  const priceLevels = parsePriceLevels(params.get("priceLevels"));

  const rawMinRating = params.get("minRating");
  const parsedMinRating = rawMinRating ? parseFloat(rawMinRating) : null;
  const minRating =
    parsedMinRating !== null && !Number.isNaN(parsedMinRating) && parsedMinRating >= 0 && parsedMinRating <= 5
      ? parsedMinRating
      : null;

  const sortByParsed = sortBySchema.safeParse(params.get("sortBy")?.toLowerCase());
  const sortBy: SortKey = sortByParsed.success ? sortByParsed.data : "distance";

  const rawPage = params.get("page");
  const parsedPage = rawPage ? parseInt(rawPage, 10) : 1;
  const page = !Number.isNaN(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  return {
    hasExplicitCenter,
    filters: {
      mode,
      areaSlug,
      keyword,
      categorySlug,
      radiusKm,
      latitude: latitude ?? DEFAULT_MAP_CENTER.latitude,
      longitude: longitude ?? DEFAULT_MAP_CENTER.longitude,
      openNow,
      priceLevels,
      minRating,
      sortBy,
      page,
      // Compatibility
      maxDistanceKm: radiusKm,
      city: areaSlug,
      category: categorySlug as PlaceCategory | "all",
    },
  };
}

function formatCoordinate(val: number): string {
  return Number(val.toFixed(6)).toString();
}

export function mergeMapSearchParams(
  current: URLSearchParams,
  filters: DiscoveryFilters
): string {
  const params = new URLSearchParams(current.toString());

  params.set("mode", filters.mode);
  params.set("areaSlug", filters.areaSlug);
  params.set("latitude", formatCoordinate(filters.latitude));
  params.set("longitude", formatCoordinate(filters.longitude));
  params.set("radiusKm", filters.radiusKm.toString());
  params.set("page", (filters.page || 1).toString());

  if (filters.keyword?.trim()) {
    params.set("keyword", filters.keyword.trim());
  } else {
    params.delete("keyword");
  }

  if (filters.categorySlug && filters.categorySlug !== "all") {
    params.set("categorySlug", filters.categorySlug);
  } else {
    params.delete("categorySlug");
  }

  if (filters.openNow) {
    params.set("openNow", "true");
  } else {
    params.delete("openNow");
  }

  if (filters.priceLevels && filters.priceLevels.length > 0) {
    params.set("priceLevels", filters.priceLevels.join(","));
  } else {
    params.delete("priceLevels");
  }

  if (filters.minRating !== null && filters.minRating !== undefined) {
    params.set("minRating", filters.minRating.toString());
  } else {
    params.delete("minRating");
  }

  params.set("sortBy", filters.sortBy);

  return params.toString();
}

import { z } from "zod";
import type { MapFilters, ParsedMapQuery } from "../types";
import { DEFAULT_MAP_CENTER } from "../map-config";

const categorySchema = z.enum([
  "all",
  "cafe",
  "restaurant",
  "sightseeing",
  "nature",
  "entertainment",
  "culture",
  "nightlife",
  "relaxation",
]);

const citySchema = z.enum(["all", "TP. Hồ Chí Minh", "Đà Lạt", "Ninh Bình", "Phú Quốc"]);

const radiusSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(10), z.literal(20)]));

function parseCoordinate(raw: string | null, schema: z.ZodType<number>): number | null {
  if (!raw?.trim()) return null;
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseMapSearchParams(params: URLSearchParams): ParsedMapQuery {
  const latitude = parseCoordinate(params.get("latitude"), z.coerce.number().min(-90).max(90));
  const longitude = parseCoordinate(params.get("longitude"), z.coerce.number().min(-180).max(180));
  const hasExplicitCenter = latitude !== null && longitude !== null;

  const cityParsed = citySchema.safeParse(params.get("city"));
  const categoryParsed = categorySchema.safeParse(params.get("category"));
  const radiusParsed = radiusSchema.safeParse(params.get("maxDistanceKm"));
  const keyword = params.get("keyword") ?? "";

  return {
    hasExplicitCenter,
    filters: {
      latitude: latitude ?? DEFAULT_MAP_CENTER.latitude,
      longitude: longitude ?? DEFAULT_MAP_CENTER.longitude,
      maxDistanceKm: radiusParsed.success ? radiusParsed.data : 5,
      city: cityParsed.success ? cityParsed.data : "all",
      category: categoryParsed.success ? categoryParsed.data : "all",
      keyword,
    },
  };
}

function formatCoordinate(val: number): string {
  return Number(val.toFixed(6)).toString();
}

export function mergeMapSearchParams(current: URLSearchParams, filters: MapFilters): string {
  const params = new URLSearchParams(current.toString());
  params.set("latitude", formatCoordinate(filters.latitude));
  params.set("longitude", formatCoordinate(filters.longitude));
  params.set("maxDistanceKm", filters.maxDistanceKm.toString());
  params.set("city", filters.city);
  params.set("category", filters.category);
  params.set("keyword", filters.keyword);
  return params.toString();
}

import { SUPER_CATEGORIES } from "@/config/categories";
import type { SuitableAudience } from "@/types/place";

export type ExploreSort = "rating" | "reviews" | "name";
export type ExploreView = "grid" | "split";

export interface ExploreQuery {
  keyword?: string;
  areaId?: number;
  areaSlug?: string;
  category?: string;
  suitableFor?: SuitableAudience;
  sort?: ExploreSort;
  view?: ExploreView;
}

const CATEGORY_ALIASES: Record<string, string> = {
  cafe: "ca-phe",
  restaurant: "am-thuc",
  sightseeing: "tham-quan",
  nature: "tham-quan",
  culture: "tham-quan",
  entertainment: "giai-tri",
  nightlife: "giai-tri",
  relaxation: "luu-tru",
  shopping: "mua-sam",
};

const VALID_AUDIENCES: readonly SuitableAudience[] = [
  "couple",
  "family",
  "friends",
  "solo",
  "kids",
];

const VALID_SORTS: readonly ExploreSort[] = ["rating", "reviews", "name"];

/**
 * Valid super category IDs (excluding "all")
 */
const VALID_CATEGORY_IDS = new Set(
  SUPER_CATEGORIES.map((c) => c.id).filter((id) => id !== "all")
);

const SUB_SLUG_TO_SUPER_CATEGORY = new Map<string, string>(
  SUPER_CATEGORIES.flatMap((sc) => sc.slugs.map((slug) => [slug, sc.id]))
);

/**
 * Normalizes a SuperCategory id, backend sub-category slug (e.g. "diem-tham-quan", "khach-san"),
 * or frontend PlaceCategory alias (e.g. "cafe", "sightseeing") into a valid /explore SuperCategory id.
 */
export function resolveExploreCategoryId(
  raw?: string | null
): string | undefined {
  const cleaned = raw?.trim().toLowerCase();
  if (!cleaned || cleaned === "all") return undefined;
  const candidate =
    CATEGORY_ALIASES[cleaned] ||
    SUB_SLUG_TO_SUPER_CATEGORY.get(cleaned) ||
    cleaned;
  return VALID_CATEGORY_IDS.has(candidate) ? candidate : undefined;
}

/**
 * Normalize and parse raw URLSearchParams into a sanitized ExploreQuery object.
 */
export function parseExploreQuery(params: URLSearchParams): ExploreQuery {
  const query: ExploreQuery = {};

  // 1. Keyword (supports ?keyword= or ?q=)
  const rawKeyword = (params.get("keyword") || params.get("q"))?.trim();
  if (rawKeyword) {
    query.keyword = rawKeyword;
  }

  // 2. Area ID or Slug (supports areaId or fallback area: positive integer or slug string)
  const rawArea = (params.get("areaId") || params.get("area"))?.trim();
  if (rawArea) {
    const parsedNum = Number(rawArea);
    if (Number.isInteger(parsedNum) && parsedNum > 0) {
      query.areaId = parsedNum;
    } else {
      query.areaSlug = rawArea.toLowerCase();
    }
  }

  // 3. Category (validates against SUPER_CATEGORIES, supports sub-slugs and legacy aliases)
  const resolvedCat = resolveExploreCategoryId(params.get("category"));
  if (resolvedCat) {
    query.category = resolvedCat;
  }

  // 4. Suitable Audience (supports suitableFor or fallback audience)
  const rawAudience = (params.get("suitableFor") || params.get("audience"))?.trim().toLowerCase();
  if (rawAudience && VALID_AUDIENCES.includes(rawAudience as SuitableAudience)) {
    query.suitableFor = rawAudience as SuitableAudience;
  }

  // 5. Sort (supports sort or fallback sortBy)
  const rawSort = (params.get("sort") || params.get("sortBy"))?.trim().toLowerCase();
  if (rawSort && VALID_SORTS.includes(rawSort as ExploreSort)) {
    query.sort = rawSort as ExploreSort;
  }

  // 6. View mode (defaults to grid)
  const rawView = params.get("view")?.trim().toLowerCase();
  if (rawView === "split") {
    query.view = "split";
  } else {
    query.view = "grid";
  }

  return query;
}

/**
 * Build a canonical /explore URL href from filter parameters.
 */
export function buildExploreHref(filters: Partial<ExploreQuery>): string {
  const params = new URLSearchParams();

  if (filters.keyword?.trim()) {
    params.set("keyword", filters.keyword.trim());
  }

  if (filters.areaId && Number.isInteger(filters.areaId) && filters.areaId > 0) {
    params.set("areaId", String(filters.areaId));
  } else if (filters.areaSlug) {
    params.set("area", filters.areaSlug);
  }

  const resolvedCategory = resolveExploreCategoryId(filters.category);
  if (resolvedCategory) {
    params.set("category", resolvedCategory);
  }

  if (filters.suitableFor && VALID_AUDIENCES.includes(filters.suitableFor)) {
    params.set("suitableFor", filters.suitableFor);
  }

  if (filters.sort && VALID_SORTS.includes(filters.sort)) {
    params.set("sort", filters.sort);
  }

  if (filters.view === "split") {
    params.set("view", "split");
  }

  const queryString = params.toString();
  return queryString ? `/explore?${queryString}` : "/explore";
}

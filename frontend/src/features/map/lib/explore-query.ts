import { SUPER_CATEGORIES } from "@/config/categories";
import type { SuitableAudience } from "@/types/place";

export type ExploreSort = "rating" | "reviews" | "name";
export type ExploreView = "grid" | "split";

export interface ExploreQuery {
  keyword?: string;
  areaId?: number;
  category?: string;
  suitableFor?: SuitableAudience;
  sort?: ExploreSort;
  view?: ExploreView;
}

const CATEGORY_ALIASES: Record<string, string> = {
  cafe: "ca-phe",
  restaurant: "am-thuc",
  nature: "tham-quan",
  culture: "tham-quan",
  entertainment: "giai-tri",
  nightlife: "giai-tri",
  relaxation: "luu-tru",
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

/**
 * Normalize and parse raw URLSearchParams into a sanitized ExploreQuery object.
 */
export function parseExploreQuery(params: URLSearchParams): ExploreQuery {
  const query: ExploreQuery = {};

  // 1. Keyword
  const rawKeyword = params.get("keyword")?.trim();
  if (rawKeyword) {
    query.keyword = rawKeyword;
  }

  // 2. Area ID (supports areaId or fallback area, must be positive integer)
  const rawArea = params.get("areaId") || params.get("area");
  if (rawArea) {
    const parsedNum = Number(rawArea);
    if (Number.isInteger(parsedNum) && parsedNum > 0) {
      query.areaId = parsedNum;
    }
  }

  // 3. Category (validates against SUPER_CATEGORIES, supports legacy aliases)
  const rawCategory = params.get("category")?.trim().toLowerCase();
  if (rawCategory && rawCategory !== "all") {
    const resolvedCat = CATEGORY_ALIASES[rawCategory] || rawCategory;
    if (VALID_CATEGORY_IDS.has(resolvedCat)) {
      query.category = resolvedCat;
    }
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
  }

  if (filters.category && filters.category !== "all" && VALID_CATEGORY_IDS.has(filters.category)) {
    params.set("category", filters.category);
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

import { normalizeVietnamese } from './string.util';
import {
  ActivityRole,
  ITINERARY_PLANNING_CONFIG,
} from '../../config/itinerary-planning.config';

export interface BrandDedupCandidate {
  id?: string;
  name: string;
  nameNormalized?: string | null;
  ratingAvg?: unknown;
  reviewCount?: number | null;
  category?: {
    name?: string | null;
    nameVi?: string | null;
    slug?: string | null;
  } | null;
}

const GENERIC_CATEGORY_PREFIX_REGEX =
  /^(nha hang|quan an|quan|tiem ca phe|tiem|ca phe|cafe|coffee)\s+/i;

function toAsciiNormalized(input: string): string {
  return normalizeVietnamese(input)
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a canonical brand key from a place name or normalized name.
 * 1. Splits before common branch separators (' - ', ' | ', '(', ',').
 * 2. Strips locale-configured branch markers and regional suffixes from the tail.
 */
export function extractBrandKey(
  rawName: string | null | undefined,
  locale: keyof typeof ITINERARY_PLANNING_CONFIG.BRAND_DEDUP.LOCALE_SUFFIXES = 'vi',
): string {
  if (!rawName) return '';

  const normalized = normalizeVietnamese(rawName).replace(/đ/g, 'd');

  // 1. Cut before the earliest branch separator
  let head = normalized;
  for (const sep of ITINERARY_PLANNING_CONFIG.BRAND_DEDUP.SEPARATORS) {
    const idx = head.indexOf(sep);
    if (idx > 0) {
      head = head.slice(0, idx);
    }
  }

  let cleaned = head
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const dict =
    ITINERARY_PLANNING_CONFIG.BRAND_DEDUP.LOCALE_SUFFIXES[locale] ??
    ITINERARY_PLANNING_CONFIG.BRAND_DEDUP.LOCALE_SUFFIXES.default;

  // 2. Repeatedly strip trailing branch markers (e.g. "chi nhanh 2", "cn1", "co so 3") and region suffixes
  let changed = true;
  while (changed) {
    changed = false;

    for (const marker of dict.branchMarkers) {
      const pattern = new RegExp(`\\s+${marker}(?:\\s*[0-9a-z]+)?$`, 'i');
      if (pattern.test(cleaned)) {
        const next = cleaned.replace(pattern, '').trim();
        if (
          next.length >=
          ITINERARY_PLANNING_CONFIG.BRAND_DEDUP.MIN_PREFIX_MATCH_LEN
        ) {
          cleaned = next;
          changed = true;
        }
      }
    }

    for (const region of dict.regionSuffixes) {
      const pattern = new RegExp(`\\s+${region}$`, 'i');
      if (pattern.test(cleaned)) {
        const next = cleaned.replace(pattern, '').trim();
        if (
          next.length >=
          ITINERARY_PLANNING_CONFIG.BRAND_DEDUP.MIN_PREFIX_MATCH_LEN
        ) {
          cleaned = next;
          changed = true;
        }
      }
    }
  }

  return cleaned;
}

/**
 * Checks whether two extracted brand keys represent the same brand chain,
 * using exact match or word-boundary prefix containment on non-trivial brand roots.
 */
export function isSameBrandKey(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  const shorter = keyA.length <= keyB.length ? keyA : keyB;
  const longer = keyA.length <= keyB.length ? keyB : keyA;

  const coreShorter = shorter.replace(GENERIC_CATEGORY_PREFIX_REGEX, '').trim();
  const minLen = ITINERARY_PLANNING_CONFIG.BRAND_DEDUP.MIN_PREFIX_MATCH_LEN;

  if (
    coreShorter.length >= minLen &&
    shorter.split(' ').length >=
      ITINERARY_PLANNING_CONFIG.BRAND_DEDUP.MIN_BRAND_WORDS_FOR_PREFIX_DEDUP &&
    longer.startsWith(`${shorter} `)
  ) {
    return true;
  }

  return false;
}

/**
 * Determines whether a place belongs to a commercial dining/cafe/shopping category
 * that should be deduplicated by brand key. Attractions/nature pass through untouched.
 */
export function shouldDeduplicateByBrand(
  category?: BrandDedupCandidate['category'],
): boolean {
  if (!category) return false;
  const slug = (category.slug || '').toLowerCase();
  const nameNorm = toAsciiNormalized(category.nameVi || category.name || '');

  const cfg = ITINERARY_PLANNING_CONFIG.BRAND_DEDUP;
  if (cfg.DEDUP_CATEGORY_SLUGS.some((s) => slug.includes(s))) {
    return true;
  }
  if (cfg.DEDUP_CATEGORY_KEYWORDS.some((kw) => nameNorm.includes(kw))) {
    return true;
  }
  return false;
}

/**
 * Determines whether a place is an accommodation/lodging record (excluding spas).
 * Used to filter hotels out of the daily activity candidate pool and to select lodging anchors.
 */
export function isLodgingCategory(
  category?: BrandDedupCandidate['category'],
  placeName?: string | null,
): boolean {
  const slug = (category?.slug || '').toLowerCase();
  const cfg = ITINERARY_PLANNING_CONFIG.LODGING;

  if (
    cfg.EXCLUDED_CATEGORY_SLUGS.some((ex) => slug === ex || slug.includes(ex))
  ) {
    return false;
  }
  if (cfg.CATEGORY_SLUGS.some((s) => slug === s || slug.includes(s))) {
    return true;
  }

  const nameNorm = toAsciiNormalized(
    `${category?.nameVi || ''} ${category?.name || ''} ${placeName || ''}`,
  );
  if (nameNorm.includes('spa')) return false;

  return cfg.CATEGORY_KEYWORDS.some((kw) => nameNorm.includes(kw));
}

/**
 * Input trust-boundary guard: rejects non-touristic commercial agencies/rentals
 * (car rentals, camera rentals, travel offices, baby/household supermarkets) that may be
 * mis-tagged as attractions in crawled datasets.
 */
export function isNonTouristicNoise(placeName?: string | null): boolean {
  if (!placeName) return false;
  const nameNorm = ` ${toAsciiNormalized(placeName)} `;
  return ITINERARY_PLANNING_CONFIG.CANDIDATE_POOL.EXCLUDED_NOISE_NAME_KEYWORDS.some(
    (kw) => nameNorm.includes(kw),
  );
}

/**
 * Classifies a place into its temporal scheduling role (`MAIN_MEAL`, `CAFE`, `ATTRACTION`,
 * `SHOPPING`, or `NIGHTLIFE`), decoupled from cost-accounting F&B buckets (SRP).
 */
export function classifyActivityRole(place: {
  name?: string | null;
  category?: BrandDedupCandidate['category'];
}): ActivityRole {
  const cfg = ITINERARY_PLANNING_CONFIG.ACTIVITY_ROLES;
  const slug = (place.category?.slug || '').toLowerCase();
  const catNorm = toAsciiNormalized(
    `${place.category?.nameVi || ''} ${place.category?.name || ''}`,
  );
  const nameNorm = ` ${toAsciiNormalized(place.name || '')} `;

  // 1. Nightlife (bars, pubs, lounges, clubs) — strictly guarded to late evening
  if (
    cfg.NIGHTLIFE_SLUGS.some((s) => slug === s || slug.includes(s)) ||
    cfg.NIGHTLIFE_KEYWORDS.some(
      (kw) => nameNorm.includes(kw) || catNorm.includes(kw),
    )
  ) {
    return 'NIGHTLIFE';
  }

  const hasDishKeywordInName = cfg.MAIN_MEAL_KEYWORDS.some(
    (kw) =>
      kw !== 'nha hang' &&
      kw !== 'quan an' &&
      kw !== 'am thuc' &&
      nameNorm.includes(kw),
  );
  const hasCafeKeywordInName = cfg.CAFE_KEYWORDS.some((kw) =>
    nameNorm.includes(kw),
  );

  // 2. Cafe / Milk tea / Bakery (including milk-tea shops mis-tagged under nha-hang)
  if (
    cfg.CAFE_SLUGS.some((s) => slug.includes(s)) ||
    (hasCafeKeywordInName && !hasDishKeywordInName)
  ) {
    return 'CAFE';
  }

  // 3. Main meal (restaurants, local specialty eateries, street food)
  if (
    cfg.MAIN_MEAL_SLUGS.some((s) => slug.includes(s)) ||
    cfg.MAIN_MEAL_KEYWORDS.some(
      (kw) => nameNorm.includes(kw) || catNorm.includes(kw),
    )
  ) {
    return 'MAIN_MEAL';
  }

  // 4. Shopping / Souvenirs / Markets
  if (
    cfg.SHOPPING_SLUGS.some((s) => slug.includes(s)) ||
    cfg.SHOPPING_KEYWORDS.some(
      (kw) => nameNorm.includes(kw) || catNorm.includes(kw),
    )
  ) {
    return 'SHOPPING';
  }

  // 5. Sightseeing / Landmarks / Nature / Culture
  return 'ATTRACTION';
}

/**
 * Shared Bayesian rating estimator: (v * R + m * C) / (v + m).
 * Reused across both Lodging scoring and Activity Candidate popularity ranking.
 */
export function computeBayesianRating(
  ratingAvg: unknown,
  reviewCount: number | null | undefined,
): number {
  const cfg = ITINERARY_PLANNING_CONFIG.LODGING;
  const r = Number(ratingAvg);
  const validRating =
    Number.isFinite(r) && r > 0 ? r : cfg.BAYESIAN_PRIOR_RATING;
  const v = Math.max(0, Number(reviewCount || 0));
  const m = cfg.BAYESIAN_PRIOR_COUNT;
  const c = cfg.BAYESIAN_PRIOR_RATING;
  return (v * validRating + m * c) / (v + m);
}

/**
 * Popularity-weighted Bayesian score (TripAdvisor / IMDb style):
 * BayesianRating * (1 + POPULARITY_LOG_WEIGHT * log10(reviewCount + 1)).
 * Ensures iconic landmarks with 10k-99k reviews rank above 10-review 5.0-star shops.
 */
export function computeCandidatePopularityScore(place: {
  ratingAvg?: unknown;
  reviewCount?: number | null;
}): number {
  const bayesian = computeBayesianRating(place.ratingAvg, place.reviewCount);
  const reviews = Math.max(0, Number(place.reviewCount || 0));
  const popWeight = ITINERARY_PLANNING_CONFIG.CANDIDATE_POOL.POPULARITY_LOG_WEIGHT;
  return bayesian * (1 + popWeight * Math.log10(reviews + 1));
}

/**
 * Single-pass brand deduplication over pre-sorted candidates.
 * Keeps the first (highest-scoring) branch of each brand chain.
 */
export function deduplicatePlacesByBrand<T extends BrandDedupCandidate>(
  places: readonly T[],
  locale: keyof typeof ITINERARY_PLANNING_CONFIG.BRAND_DEDUP.LOCALE_SUFFIXES = 'vi',
): T[] {
  const result: T[] = [];
  const exactKeys = new Set<string>();
  const acceptedKeys: string[] = [];

  for (const place of places) {
    if (!shouldDeduplicateByBrand(place.category)) {
      result.push(place);
      continue;
    }

    const key = extractBrandKey(place.nameNormalized || place.name, locale);
    if (!key) {
      result.push(place);
      continue;
    }

    if (exactKeys.has(key)) {
      continue;
    }

    const matchesExisting = acceptedKeys.some((existing) =>
      isSameBrandKey(existing, key),
    );
    if (matchesExisting) {
      continue;
    }

    exactKeys.add(key);
    acceptedKeys.push(key);
    result.push(place);
  }

  return result;
}

/**
 * Stratified candidate pool builder:
 * 1. Filters out lodging & non-touristic commercial noise.
 * 2. Ranks by Popularity-Weighted Bayesian Score so major landmarks lead.
 * 3. Deduplicates commercial chains by brand key.
 * 4. Slices into balanced role quotas (Sightseeing, Main Meals, Cafe/Nightlife) up to candidateLimit.
 */
export function selectBalancedCandidatePool<T extends BrandDedupCandidate>(
  rawPlaces: readonly T[],
  candidateLimit: number,
): T[] {
  const clean = rawPlaces.filter(
    (p) =>
      !isLodgingCategory(p.category, p.name) && !isNonTouristicNoise(p.name),
  );

  const ranked = [...clean].sort(
    (a, b) =>
      computeCandidatePopularityScore(b) - computeCandidatePopularityScore(a),
  );

  const deduped = deduplicatePlacesByBrand(ranked);
  if (deduped.length <= candidateLimit) {
    return deduped;
  }

  const Q = ITINERARY_PLANNING_CONFIG.CANDIDATE_POOL.ROLE_QUOTAS;
  const targetSightseeing = Math.round(candidateLimit * Q.SIGHTSEEING_SHARE);
  const targetMainMeal = Math.round(candidateLimit * Q.MAIN_MEAL_SHARE);
  const targetCafeNightlife = Math.max(
    1,
    candidateLimit - targetSightseeing - targetMainMeal,
  );
  const maxNightlife = Math.max(
    1,
    Math.floor(candidateLimit * Q.MAX_NIGHTLIFE_SHARE),
  );

  const sightseeingBucket: T[] = [];
  const shoppingBucket: T[] = [];
  const mainMealBucket: T[] = [];
  const cafeNightlifeBucket: T[] = [];
  let nightlifeCount = 0;

  for (const item of deduped) {
    const role = classifyActivityRole(item);
    if (role === 'ATTRACTION') {
      sightseeingBucket.push(item);
    } else if (role === 'SHOPPING') {
      shoppingBucket.push(item);
    } else if (role === 'MAIN_MEAL') {
      mainMealBucket.push(item);
    } else if (role === 'NIGHTLIFE') {
      if (nightlifeCount < maxNightlife) {
        cafeNightlifeBucket.push(item);
        nightlifeCount++;
      }
    } else {
      cafeNightlifeBucket.push(item);
    }
  }

  const combinedSightseeing = [...sightseeingBucket, ...shoppingBucket];
  const selected = new Set<T>();

  for (const p of combinedSightseeing.slice(0, targetSightseeing)) {
    selected.add(p);
  }
  for (const p of mainMealBucket.slice(0, targetMainMeal)) {
    selected.add(p);
  }
  for (const p of cafeNightlifeBucket.slice(0, targetCafeNightlife)) {
    selected.add(p);
  }

  // Backfill any unfilled quota from highest-ranked remaining non-nightlife candidates
  if (selected.size < candidateLimit) {
    for (const item of deduped) {
      if (selected.size >= candidateLimit) break;
      if (selected.has(item)) continue;
      if (classifyActivityRole(item) === 'NIGHTLIFE') continue;
      selected.add(item);
    }
  }

  return Array.from(selected);
}

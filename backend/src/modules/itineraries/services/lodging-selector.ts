import { ITINERARY_PLANNING_CONFIG } from '../../../config/itinerary-planning.config';
import {
  GeoCoord,
  computeHaversineDistance,
} from '../../../common/utils/geo.util';
import {
  isLodgingCategory,
  computeBayesianRating,
} from '../../../common/utils/brand-key.util';

export { computeBayesianRating };

export interface LodgingCandidate {
  id: string;
  name: string;
  address?: string | null;
  latitude: unknown;
  longitude: unknown;
  ratingAvg?: unknown;
  reviewCount?: number | null;
  priceLevel?: string | null;
  priceRange?: unknown;
  images?: unknown;
  category?: {
    name?: string | null;
    nameVi?: string | null;
    slug?: string | null;
  } | null;
}

export interface ScoredLodgingCandidate<
  T extends LodgingCandidate = LodgingCandidate,
> {
  place: T;
  score: number;
  bayesianRating: number;
  priceFitScore: number;
  proximityScore: number;
  distanceKm: number;
}

export interface LodgingSuggestionsResult<
  T extends LodgingCandidate = LodgingCandidate,
> {
  nearest: ScoredLodgingCandidate<T>[];
  bestValue: ScoredLodgingCandidate<T>[];
  topRated: ScoredLodgingCandidate<T>[];
}

export function computePriceFitScore(
  placePriceLevel: string | null | undefined,
  targetBudgetLevel: string | null | undefined,
): number {
  const order = ITINERARY_PLANNING_CONFIG.LODGING.BUDGET_LEVEL_ORDER;
  const targetIdx = order.indexOf(
    (targetBudgetLevel || 'MEDIUM').toUpperCase() as (typeof order)[number],
  );
  const placeIdx = order.indexOf(
    (placePriceLevel || '').toUpperCase() as (typeof order)[number],
  );

  if (placeIdx === -1 || targetIdx === -1) return 0.7;
  const diff = Math.abs(placeIdx - targetIdx);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.65;
  if (diff === 2) return 0.3;
  return 0.1;
}

export function scoreLodgingCandidate<T extends LodgingCandidate>(
  place: T,
  params: {
    budgetLevel?: string | null;
    referenceCoord: GeoCoord;
  },
): ScoredLodgingCandidate<T> {
  const cfg = ITINERARY_PLANNING_CONFIG.LODGING;
  const lat = Number(place.latitude);
  const lng = Number(place.longitude);
  const distanceKm =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? computeHaversineDistance(
          lat,
          lng,
          params.referenceCoord.lat,
          params.referenceCoord.lng,
        )
      : cfg.MAX_REFERENCE_DISTANCE_KM;

  const bayesianRating = computeBayesianRating(
    place.ratingAvg,
    place.reviewCount,
  );
  const ratingScore = Math.min(
    1,
    Math.max(0, bayesianRating / cfg.MAX_RATING),
  );
  const priceFitScore = computePriceFitScore(
    place.priceLevel,
    params.budgetLevel,
  );
  const proximityScore = Math.max(
    0,
    1 - distanceKm / cfg.MAX_REFERENCE_DISTANCE_KM,
  );

  const w = cfg.SCORING_WEIGHTS;
  const score =
    w.RATING * ratingScore +
    w.PRICE_FIT * priceFitScore +
    w.PROXIMITY * proximityScore;

  return {
    place,
    score,
    bayesianRating: Math.round(bayesianRating * 100) / 100,
    priceFitScore,
    proximityScore,
    distanceKm: Math.round(distanceKm * 100) / 100,
  };
}

/**
 * Selects a single default lodging place for the entire trip (all nights)
 * by scoring valid lodging candidates on Bayesian rating, budget fit, and proximity to trip centroid.
 */
export function selectDefaultLodging<T extends LodgingCandidate>(
  candidates: readonly T[],
  params: {
    budgetLevel?: string | null;
    referenceCoord: GeoCoord;
  },
): ScoredLodgingCandidate<T> | null {
  const valid = candidates.filter((c) => isLodgingCategory(c.category, c.name));
  if (valid.length === 0) return null;

  let best: ScoredLodgingCandidate<T> | null = null;
  for (const c of valid) {
    const scored = scoreLodgingCandidate(c, params);
    if (!best || scored.score > best.score) {
      best = scored;
    }
  }
  return best;
}

/**
 * Builds 3 curated suggestion groups (Nearest to itinerary, Best value for budget, Top rated)
 * excluding the currently selected lodging place.
 */
export function buildLodgingSuggestions<T extends LodgingCandidate>(
  candidates: readonly T[],
  params: {
    budgetLevel?: string | null;
    dayCentroid: GeoCoord;
    currentPlaceId?: string | null;
    limit?: number;
  },
): LodgingSuggestionsResult<T> {
  const groupLimit =
    params.limit ?? ITINERARY_PLANNING_CONFIG.LODGING.SUGGESTION_GROUP_LIMIT;

  const scoredList = candidates
    .filter(
      (c) =>
        isLodgingCategory(c.category, c.name) &&
        (!params.currentPlaceId || c.id !== params.currentPlaceId),
    )
    .map((c) =>
      scoreLodgingCandidate(c, {
        budgetLevel: params.budgetLevel,
        referenceCoord: params.dayCentroid,
      }),
    );

  const nearest = [...scoredList]
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm || b.bayesianRating - a.bayesianRating,
    )
    .slice(0, groupLimit);

  const bestValue = [...scoredList]
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm)
    .slice(0, groupLimit);

  const topRated = [...scoredList]
    .sort(
      (a, b) =>
        b.bayesianRating - a.bayesianRating ||
        (Number(b.place.reviewCount) || 0) - (Number(a.place.reviewCount) || 0),
    )
    .slice(0, groupLimit);

  return { nearest, bestValue, topRated };
}

import type { RadiusKm } from "../types";

export interface ParsedSearchIntent {
  rawQuery: string;
  cleanedKeyword: string;
  isNearbyIntent: boolean;
  extractedRadiusKm?: RadiusKm;
  anchorLandmark?: string;
  areaName?: string;
}

/**
 * Snaps any numeric distance (in km) to the closest supported system RadiusKm.
 */
export function snapToRadiusKm(val: number): RadiusKm {
  if (val <= 1.5) return 1;
  if (val <= 3.5) return 3;
  if (val <= 7) return 5;
  if (val <= 15) return 10;
  return 20;
}

// Distance pattern matching Vietnamese & English
const DISTANCE_PATTERN =
  /(?:trong\s+(?:khoảng|vòng)|bán\s+kính|cách(?:\s+đây)?|khoảng|dưới|within(?:\s+a\s+radius\s+of)?|around|under|less\s+than)\s+(\d+(?:\.\d+)?)\s*(km|cây|m|miles?)\b/i;

// Relative nearby intent (current user geolocation)
const NEARBY_INTENT_PATTERN =
  /\b(quanh\s+đây|gần\s+tôi|gần\s+đây|ở\s+đây|xung\s+quanh\s+đây|quanh\s+mình|near\s+me|nearby|around\s+here|around\s+me|close\s+by)\b/i;

// Landmark anchor pattern ("quán ăn gần chùa Cầu", "hotels near beach")
const LANDMARK_ANCHOR_PATTERN =
  /^(.*?)\s+(?:gần|quanh|sát|cạnh|kế\s+bên|near|around|close\s+to|by|next\s+to)\s+([^,]+)$/i;

// Administrative area pattern ("quán cafe ở Đà Nẵng", "khách sạn tại Hà Nội")
const AREA_PATTERN = /^(?:(.*?)\s+)?(?:ở|tại|in|at)\s+([^,]+)$/i;

/**
 * Parses user search query for spatial intent, distance/radius, and anchor landmark.
 * Pure function: Fast, zero-dependency, 0ms execution time, completely testable.
 */
export function parseSearchIntent(rawQuery: string): ParsedSearchIntent {
  let workingQuery = (rawQuery || "").trim();
  let extractedRadiusKm: RadiusKm | undefined = undefined;
  let isNearbyIntent = false;
  let anchorLandmark: string | undefined = undefined;
  let areaName: string | undefined = undefined;

  // 1. Extract Distance / Radius if present
  const distMatch = workingQuery.match(DISTANCE_PATTERN);
  if (distMatch) {
    const rawVal = parseFloat(distMatch[1]);
    const unit = (distMatch[2] || "km").toLowerCase();

    let kmVal = rawVal;
    if (unit === "m") {
      kmVal = rawVal / 1000;
    } else if (unit.startsWith("mile")) {
      kmVal = rawVal * 1.60934;
    }

    if (!isNaN(kmVal) && kmVal > 0) {
      extractedRadiusKm = snapToRadiusKm(kmVal);
    }

    // Strip the distance substring
    workingQuery = workingQuery.replace(distMatch[0], " ").trim();
  }

  // 2. Detect Nearby (current device location) intent
  if (NEARBY_INTENT_PATTERN.test(workingQuery)) {
    isNearbyIntent = true;
    workingQuery = workingQuery.replace(NEARBY_INTENT_PATTERN, " ").trim();
  }

  // 3. Extract Landmark Anchor if query has format: [target] near [landmark]
  // Only extract if there is an actual target prefix before the separator
  const anchorMatch = workingQuery.match(LANDMARK_ANCHOR_PATTERN);
  if (anchorMatch && anchorMatch[1].trim() && anchorMatch[2].trim()) {
    const potentialTarget = anchorMatch[1].trim();
    const potentialLandmark = anchorMatch[2].trim();

    // Ensure landmark is not just another nearby phrase
    if (!NEARBY_INTENT_PATTERN.test(potentialLandmark)) {
      anchorLandmark = potentialLandmark;
      workingQuery = potentialTarget;
    }
  }

  // 4. Extract Administrative Area if query matches: [target] ở/tại [area]
  const areaMatch = workingQuery.match(AREA_PATTERN);
  if (areaMatch && areaMatch[2]?.trim()) {
    const potentialArea = areaMatch[2].trim();
    if (!NEARBY_INTENT_PATTERN.test(potentialArea)) {
      areaName = potentialArea;
      workingQuery = (areaMatch[1] || "").trim();
    }
  }

  // Normalize spaces
  const cleanedKeyword = workingQuery.replace(/\s+/g, " ").trim();

  return {
    rawQuery,
    cleanedKeyword,
    isNearbyIntent,
    extractedRadiusKm,
    anchorLandmark,
    areaName,
  };
}

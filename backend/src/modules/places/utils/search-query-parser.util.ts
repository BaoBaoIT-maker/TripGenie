/**
 * Pure function utility for parsing user search queries in travel exploration.
 * Extracts category intent, spatial landmark anchors, radius distance, and descriptive keywords.
 * Zero external dependencies, deterministic, sub-millisecond execution.
 */

export interface ParsedPlaceSearchQuery {
  rawQuery: string;
  cleanedKeyword: string;
  categorySlug?: string;
  landmarkAnchor?: string;
  areaName?: string;
  extractedRadiusMeters?: number;
  isNearbyIntent: boolean;
}

// Category synonym dictionary (Domain-specific aliases)
const CATEGORY_SYNONYMS: { slug: string; patterns: RegExp[] }[] = [
  {
    slug: 'khach-san',
    patterns: [
      /\b(khách\s+sạn|khach\s+san|hotels?|resorts?|homestays?|nhà\s+nghỉ|nha\s+nghi|motels?|villa|villas)\b/i,
    ],
  },
  {
    slug: 'ca-phe',
    patterns: [
      /\b(quán\s+cà\s+phê|quán\s+cafe|cà\s+phê|cafe|café|coffee\s+shops?|coffees?|tiệm\s+cà\s+phê)\b/i,
    ],
  },
  {
    slug: 'nha-hang',
    patterns: [
      /\b(nhà\s+hàng|nha\s+hang|quán\s+ăn|quan\s+an|quán\s+cơm|restaurants?|tiệm\s+ăn)\b/i,
    ],
  },
  {
    slug: 'an-vat-via-he',
    patterns: [
      /\b(ăn\s+vặt|an\s+vat|vỉa\s+hè|via\s+he|đồ\s+ăn\s+nhanh|fast\s*food|trà\s+sữa)\b/i,
    ],
  },
  {
    slug: 'bar-pub',
    patterns: [
      /\b(quán\s+bar|bars?|pubs?|lounges?|clubs?|hộp\s+đêm|quán\s+nhậu)\b/i,
    ],
  },
  {
    slug: 'diem-tham-quan',
    patterns: [
      /\b(điểm\s+tham\s+quan|diem\s+tham\s+quan|attractions?|di\s+tích|bảo\s+tàng|museums?|chùa|nhà\s+thờ|temples?|pagodas?)\b/i,
    ],
  },
  {
    slug: 'thien-nhien',
    patterns: [
      /\b(bãi\s+biển|bờ\s+biển|beach|beaches|công\s+viên|parks?|bán\s+đảo|núi|mountains?|thác|đèo)\b/i,
    ],
  },
  {
    slug: 'cho-sieu-thi',
    patterns: [
      /\b(chợ|siêu\s+thị|supermarkets?|malls?|trung\s+tâm\s+thương\s+mại|markets?)\b/i,
    ],
  },
  {
    slug: 'spa',
    patterns: [
      /\b(spa|spas|massage|xông\s+hơi)\b/i,
    ],
  },
  {
    slug: 'vui-choi',
    patterns: [
      /\b(khu\s+vui\s+chơi|công\s+viên\s+nước|theme\s*parks?|water\s*parks?)\b/i,
    ],
  },
];

// Distance patterns: "trong khoảng 20km", "bán kính 5km", "within 3km", etc.
const DISTANCE_PATTERN =
  /(?:trong\s+(?:khoảng|vòng)|bán\s+kính|cách(?:\s+đây)?|khoảng|dưới|within(?:\s+a\s+radius\s+of)?|around|under|less\s+than)\s+(\d+(?:\.\d+)?)\s*(km|cây|m|miles?)\b/i;

// Relative nearby intent (device geolocation)
const NEARBY_INTENT_PATTERN =
  /\b(quanh\s+đây|gần\s+tôi|gần\s+đây|ở\s+đây|xung\s+quanh\s+đây|quanh\s+mình|near\s+me|nearby|around\s+here|around\s+me|close\s+by)\b/i;

// Landmark anchor pattern ("khách sạn view biển gần Mỹ Khê", "hotels near beach")
const LANDMARK_ANCHOR_PATTERN =
  /^(.*?)\s+(?:gần|quanh|sát|cạnh|kế\s+bên|near|around|close\s+to|by|next\s+to)\s+([^,]+)$/i;

// Administrative area pattern ("quán cafe ở Đà Nẵng", "khách sạn tại Hải Châu", "hotels in Da Nang")
const AREA_PATTERN =
  /^(?:(.*?)\s+)?(?:ở|tại|in|at)\s+([^,]+)$/i;

export function parseSearchQuery(rawQuery: string): ParsedPlaceSearchQuery {
  let workingQuery = (rawQuery || '').trim();
  let extractedRadiusMeters: number | undefined = undefined;
  let isNearbyIntent = false;
  let categorySlug: string | undefined = undefined;
  let landmarkAnchor: string | undefined = undefined;
  let areaName: string | undefined = undefined;

  // 1. Extract Distance / Radius
  const distMatch = workingQuery.match(DISTANCE_PATTERN);
  if (distMatch) {
    const rawVal = parseFloat(distMatch[1]);
    const unit = (distMatch[2] || 'km').toLowerCase();

    let meters = rawVal * 1000;
    if (unit === 'm') {
      meters = rawVal;
    } else if (unit.startsWith('mile')) {
      meters = rawVal * 1609.34;
    }

    if (!isNaN(meters) && meters > 0) {
      extractedRadiusMeters = Math.min(Math.max(Math.round(meters), 500), 50000);
    }
    workingQuery = workingQuery.replace(distMatch[0], ' ').trim();
  }

  // 2. Detect Device Nearby Intent
  if (NEARBY_INTENT_PATTERN.test(workingQuery)) {
    isNearbyIntent = true;
    workingQuery = workingQuery.replace(NEARBY_INTENT_PATTERN, ' ').trim();
  }

  // 3. Extract Administrative Area if query matches: [target] ở/tại/in/at [area]
  const areaMatch = workingQuery.match(AREA_PATTERN);
  if (areaMatch && areaMatch[2]?.trim()) {
    const potentialTarget = (areaMatch[1] || '').trim();
    const potentialArea = areaMatch[2].trim();

    if (!NEARBY_INTENT_PATTERN.test(potentialArea)) {
      areaName = potentialArea;
      workingQuery = potentialTarget;
    }
  }

  // 4. Extract Landmark Anchor if query has format: [target] near [landmark]
  const anchorMatch = workingQuery.match(LANDMARK_ANCHOR_PATTERN);
  if (anchorMatch && anchorMatch[1]?.trim() && anchorMatch[2]?.trim()) {
    const potentialTarget = anchorMatch[1].trim();
    const potentialLandmark = anchorMatch[2].trim();

    // Ensure landmark is not just another nearby phrase
    if (!NEARBY_INTENT_PATTERN.test(potentialLandmark)) {
      landmarkAnchor = potentialLandmark;
      workingQuery = potentialTarget;
    }
  }

  // 4. Extract Category Slug
  for (const item of CATEGORY_SYNONYMS) {
    let matched = false;
    for (const pat of item.patterns) {
      if (pat.test(workingQuery)) {
        categorySlug = item.slug;
        workingQuery = workingQuery.replace(pat, ' ').trim();
        matched = true;
        break;
      }
    }
    if (matched) break;
  }

  // Normalize leftover keywords
  const cleanedKeyword = workingQuery.replace(/\s+/g, ' ').trim();

  return {
    rawQuery,
    cleanedKeyword,
    categorySlug,
    landmarkAnchor,
    areaName,
    extractedRadiusMeters,
    isNearbyIntent,
  };
}

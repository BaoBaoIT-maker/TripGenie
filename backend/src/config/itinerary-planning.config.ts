/**
  * Centralized configuration for Itinerary Planning, Brand Deduplication,
  * Candidate Pool Ranking, Activity Role Classification, Geographic Day Clustering,
  * Route Optimization, and Lodging Selection.
  * Strictly adheres to AGENTS.md: zero hard-coded magic numbers or strings in business logic.
  */

export type ActivityRole =
  | 'MAIN_MEAL'
  | 'CAFE'
  | 'ATTRACTION'
  | 'SHOPPING'
  | 'NIGHTLIFE';

export type DayTimeWindowName =
  | 'BREAKFAST'
  | 'MORNING_ACTIVITY'
  | 'LUNCH'
  | 'AFTERNOON_ACTIVITY'
  | 'DINNER'
  | 'NIGHT';

export const ITINERARY_PLANNING_CONFIG = {
  LIMITS: {
    AI_MAX_TRIP_DAYS: 7,
    MANUAL_MAX_TRIP_DAYS: 14,
    CANDIDATE_MIN: 30,
    CANDIDATE_MAX: 100,
    CANDIDATE_BUFFER_RATIO: 2,
    CANDIDATE_OVERSAMPLE_RATIO: 0.3,
    BBOX_EXPAND_THRESHOLD: 10,
    LIST_ITINERARIES_MAX: 30,
  },

  GEO: {
    /** Approximate km per degree of latitude (WGS-84). */
    KM_PER_DEG_LAT: 111,
    /** Fallback bbox radius when no area bbox is available. */
    FALLBACK_BBOX_RADIUS_KM: 45,
    /** Max lat span (degrees) to treat an area bbox as "local city" (not country-level). */
    LOCAL_AREA_MAX_LAT_SPAN_DEG: 2.0,
    /** Fallback ± degrees around centroid when no area bbox and no TravelArea exists. */
    SUGGESTION_BBOX_EXPAND_DEG: 0.4,
  },

  CANDIDATE_POOL: {
    /** Wide DB scan limit before in-memory Bayesian popularity ranking & stratified quota slicing. */
    DB_SCAN_LIMIT: 250,
    /** Weight applied to log10(reviewCount + 1) when ranking popular landmarks & dining. */
    POPULARITY_LOG_WEIGHT: 0.25,
    /** Stratified target shares when slicing the candidate pool to candidateLimit. */
    ROLE_QUOTAS: {
      SIGHTSEEING_SHARE: 0.45,
      MAIN_MEAL_SHARE: 0.38,
      CAFE_AND_NIGHTLIFE_SHARE: 0.17,
      MAX_NIGHTLIFE_SHARE: 0.08,
    },
    /** Non-touristic commercial services/rentals that may be mis-tagged in crawled data. */
    EXCLUDED_NOISE_NAME_KEYWORDS: [
      'cho thue xe',
      'thue xe ',
      'private car',
      'car rental',
      'camera rental',
      'cho thue may anh',
      'cong ty tnhh',
      'cong ty du lich',
      'travel agency',
      'bookinghotel',
      'dat phong khach san',
      'sieu thi me va be',
      'supercenter',
      'homemart',
      'home mart',
      'fm style',
    ] as const,
  },

  ACTIVITY_ROLES: {
    NIGHTLIFE_SLUGS: ['bar-pub', 'bar'] as const,
    NIGHTLIFE_KEYWORDS: [
      'bar ',
      ' bar',
      'pub',
      'lounge',
      'club',
      'cocktail',
      'nightlife',
      'cuoc song dem',
    ] as const,
    CAFE_SLUGS: ['ca-phe'] as const,
    CAFE_KEYWORDS: [
      'ca phe',
      'cafe',
      'coffee',
      'tra sua',
      'milk tea',
      'tiem banh',
      'bakery',
      'trang mieng',
      'kem ',
    ] as const,
    MAIN_MEAL_SLUGS: ['nha-hang', 'an-vat', 'quan-an'] as const,
    MAIN_MEAL_KEYWORDS: [
      'nha hang',
      'quan an',
      'am thuc',
      'an vat',
      'hai san',
      'seafood',
      'lau ',
      'nuong ',
      'bbq',
      'buffet',
      'com ',
      'pho ',
      'bun ',
      'mi quang',
      'my quang',
      'banh xeo',
      'banh trang',
      'banh canh',
    ] as const,
    SHOPPING_SLUGS: ['cho-sieu-thi', 'mua-sam'] as const,
    SHOPPING_KEYWORDS: [
      'sieu thi',
      'mart',
      'mall',
      'vincom',
      'lotte',
      'souvenir',
      'qua luu niem',
      'dac san lam qua',
      'cua hang',
    ] as const,
  },

  BRAND_DEDUP: {
    SEPARATORS: [' - ', ' – ', ' — ', ' | ', '(', ','] as const,
    /** Minimum word count in brand key to allow prefix-containment dedup (avoids false positives on 1–2 word keys). */
    MIN_BRAND_WORDS_FOR_PREFIX_DEDUP: 3,
    DEDUP_CATEGORY_SLUGS: [
      'nha-hang',
      'ca-phe',
      'an-vat',
      'cho-sieu-thi',
      'mua-sam',
      'bar',
    ] as const,
    DEDUP_CATEGORY_KEYWORDS: [
      'nha hang',
      'ca phe',
      'an vat',
      'quan an',
      'am thuc',
      'cho',
      'mua sam',
      'bar',
    ] as const,
    MIN_PREFIX_MATCH_LEN: 6,
    LOCALE_SUFFIXES: {
      vi: {
        branchMarkers: [
          'chi nhanh',
          'co so',
          'cn',
          'cs',
          'branch',
          'flagship',
          'express',
        ] as const,
        regionSuffixes: [
          'phu yen',
          'da lat',
          'lam dong',
          'ha noi',
          'sai gon',
          'ho chi minh',
          'tphcm',
          'da nang',
          'nha trang',
          'khanh hoa',
          'hoi an',
          'quang nam',
          'hue',
          'phan thiet',
          'mui ne',
          'vung tau',
          'can tho',
          'quy nhon',
          'binh dinh',
          'phu quoc',
          'sa pa',
          'sapa',
          'ninh binh',
          'ha long',
          'hai phong',
          'buon ma thuot',
          'dak lak',
          'gia lai',
          'pleiku',
          'mang den',
          'kon tum',
        ] as const,
      },
      default: {
        branchMarkers: ['branch', 'outlet', 'store', 'flagship'] as const,
        regionSuffixes: [] as const,
      },
    },
  },

  CLUSTERING: {
    MAX_ITERATIONS: 20,
    MIN_CLUSTER_BUFFER_RATIO: 1.2,
    MIN_DINING_PER_DAY: 2,
    MIN_ATTRACTION_PER_DAY: 2,
    DEG_TO_RAD: Math.PI / 180,
  },

  ROUTE_OPTIMIZER: {
    MAX_EXHAUSTIVE_STOPS: 9,
    DETOUR_FACTOR: 1.25,
    PENALTIES: {
      MEAL_MISMATCH_METERS: 35_000,
      CLOSED_AT_SLOT_METERS: 25_000,
      CLOSING_SOON_METERS: 5_000,
      FORBIDDEN_ROLE_METERS: 500_000,
    },
    MEAL_TIME_WINDOWS: [
      { name: 'BREAKFAST', startMin: 5 * 60 + 30, endMin: 8 * 60 + 15 },
      { name: 'LUNCH', startMin: 11 * 60 + 15, endMin: 13 * 60 + 30 },
      { name: 'DINNER', startMin: 17 * 60 + 30, endMin: 20 * 60 },
    ] as const,
    TIME_WINDOWS: [
      {
        name: 'BREAKFAST' as DayTimeWindowName,
        startMin: 5 * 60 + 30,
        endMin: 8 * 60 + 15,
      },
      {
        name: 'MORNING_ACTIVITY' as DayTimeWindowName,
        startMin: 8 * 60 + 16,
        endMin: 11 * 60 + 14,
      },
      {
        name: 'LUNCH' as DayTimeWindowName,
        startMin: 11 * 60 + 15,
        endMin: 13 * 60 + 30,
      },
      {
        name: 'AFTERNOON_ACTIVITY' as DayTimeWindowName,
        startMin: 13 * 60 + 31,
        endMin: 17 * 60 + 29,
      },
      {
        name: 'DINNER' as DayTimeWindowName,
        startMin: 17 * 60 + 30,
        endMin: 20 * 60,
      },
      {
        name: 'NIGHT' as DayTimeWindowName,
        startMin: 20 * 60 + 1,
        endMin: 23 * 60 + 59,
      },
    ] as const,
    /**
     * Open/Closed Principle (OCP) 2D compatibility penalty matrix (in meters).
     * Controls which ActivityRole can occupy which DayTimeWindowName without if/else chains.
     */
    SLOT_ROLE_PENALTIES: {
      BREAKFAST: {
        MAIN_MEAL: 0,
        CAFE: 1_500,
        ATTRACTION: 35_000,
        SHOPPING: 35_000,
        NIGHTLIFE: 500_000,
      },
      MORNING_ACTIVITY: {
        ATTRACTION: 0,
        SHOPPING: 2_500,
        CAFE: 3_500,
        MAIN_MEAL: 35_000,
        NIGHTLIFE: 500_000,
      },
      LUNCH: {
        MAIN_MEAL: 0,
        CAFE: 25_000,
        ATTRACTION: 35_000,
        SHOPPING: 35_000,
        NIGHTLIFE: 500_000,
      },
      AFTERNOON_ACTIVITY: {
        ATTRACTION: 0,
        CAFE: 1_500,
        SHOPPING: 2_000,
        MAIN_MEAL: 35_000,
        NIGHTLIFE: 500_000,
      },
      DINNER: {
        MAIN_MEAL: 0,
        CAFE: 30_000,
        ATTRACTION: 35_000,
        SHOPPING: 35_000,
        NIGHTLIFE: 100_000,
      },
      NIGHT: {
        ATTRACTION: 0,
        CAFE: 0,
        NIGHTLIFE: 0,
        SHOPPING: 1_000,
        MAIN_MEAL: 15_000,
      },
    } satisfies Record<DayTimeWindowName, Record<ActivityRole, number>>,
  },

  LODGING: {
    CATEGORY_SLUGS: ['khach-san', 'homestay'] as const,
    CATEGORY_KEYWORDS: [
      'khach san',
      'homestay',
      'resort',
      'luu tru',
      'nha nghi',
      'villa',
      'hostel',
    ] as const,
    EXCLUDED_CATEGORY_SLUGS: ['spa'] as const,
    BAYESIAN_PRIOR_COUNT: 20,
    BAYESIAN_PRIOR_RATING: 4.2,
    MAX_RATING: 5.0,
    MAX_REFERENCE_DISTANCE_KM: 10,
    SUGGESTION_GROUP_LIMIT: 5,
    CANDIDATE_CACHE_TTL_MS: 5 * 60 * 1000,
    CANDIDATE_CACHE_MAX_ENTRIES: 50,
    SCORING_WEIGHTS: {
      RATING: 0.5,
      PRICE_FIT: 0.3,
      PROXIMITY: 0.2,
    },
    BUDGET_LEVEL_ORDER: ['LOW', 'MEDIUM', 'HIGH', 'LUXURY'] as const,
  },
} as const;

/**
  * Computes dynamic candidate limit based on trip duration and pace maxStopsPerDay:
  * clamp(totalDays * maxStopsPerDay * BUFFER_RATIO, CANDIDATE_MIN, CANDIDATE_MAX).
  */
export function computeCandidateLimit(
  totalDays: number,
  maxStopsPerDay: number,
): { candidateLimit: number; queryLimit: number } {
  const L = ITINERARY_PLANNING_CONFIG.LIMITS;
  const raw = totalDays * maxStopsPerDay * L.CANDIDATE_BUFFER_RATIO;
  const candidateLimit = Math.min(
    L.CANDIDATE_MAX,
    Math.max(L.CANDIDATE_MIN, raw),
  );
  const queryLimit = Math.max(
    ITINERARY_PLANNING_CONFIG.CANDIDATE_POOL.DB_SCAN_LIMIT,
    Math.ceil(candidateLimit * (1 + L.CANDIDATE_OVERSAMPLE_RATIO)),
  );
  return { candidateLimit, queryLimit };
}

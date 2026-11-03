/**
 * Pricing & Transit Configuration for TripGenie
 * Consolidates all travel cost benchmarks, fuel rates, transit tariffs, and safety thresholds in one place.
 * Follows AGENTS.md rule: Zero hardcoded magic numbers in business logic.
 */

export const PRICING_CONFIG = {
  // 1. Fuel & Highway Tolls
  FUEL: {
    GAS_PRICE_PER_LITER: 23_000,          // Current gasoline RON95/E5 benchmark (VNĐ)
    MOTORBIKE_CONSUMPTION_PER_100KM: 2.2, // Motorbike consumption: 2.2 liters / 100km
    CAR_CONSUMPTION_PER_100KM: 7.5,       // Sedan/SUV consumption: 7.5 liters / 100km
    HIGHWAY_TOLL_PER_KM: 1_100,           // Average highway BOT toll in Vietnam: ~1,100 VNĐ / km
  },

  // 2. Intercity Transit Rates (Road)
  INTERCITY: {
    SLEEPER_BUS_PER_KM: 950,              // Standard sleeper bus tariff: ~950 VNĐ / km
    LIMOUSINE_BUS_PER_KM: 1_400,          // VIP Limousine bus tariff: ~1,400 VNĐ / km
    TRAIN_PER_KM: 850,                    // Train soft-seat/sleeper average: ~850 VNĐ / km
    ROAD_DETOUR_FACTOR: 1.35,             // Crow-fly -> road distance multiplier for VN highways
    HIGHWAY_SHARE: 0.6,                   // Share of a car trip on tolled expressway
    AUTO_FLIGHT_MIN_KM: 450,              // No mode chosen: farther than this defaults to FLIGHT
    FLIGHT: {
      BASE_AIRPORT_FEE: 650_000,          // Fixed airport handling, passenger security, takeoff/landing overhead (VNĐ)
      RATE_PER_KM: 950,                   // Variable cruising flight tariff per air distance km (VNĐ / km)
      CRUISE_SPEED_KMH: 750,              // Airbus A320/A321 average commercial cruise speed (km/h)
      TAXI_TAKEOFF_MINUTES: 30,           // Runway taxiing, climb & descent buffer time (minutes)
      MIN_FLIGHT_MINUTES: 45,             // Minimum commercial flight schedule duration (minutes)
      LONG_HAUL_KM: 800,                  // Above this road distance: long-haul fare/duration
      ONE_WAY_SHORT: 1_400_000,           // Benchmark baseline for short route (<800km)
      ONE_WAY_LONG: 1_700_000,            // Benchmark baseline for long route (>=800km)
      MINUTES_SHORT: 80,
      MINUTES_LONG: 120,
      BUDGET_MULTIPLIERS: {
        LOW: 0.8,                         // Budget eco / promo / carry-on only (~80% base)
        MEDIUM: 1.0,                      // Standard economy with checked luggage (100% base)
        HIGH: 1.7,                        // Flexible premium economy / early booking VNA (~170% base)
        LUXURY: 2.8,                      // Business class / peak flexibility (~280% base)
      },
      PEAK_MULTIPLIERS: {
        TET_PEAK: 1.6,                    // Lunar New Year peak window (+60%)
        SUMMER_PEAK: 1.25,                // Summer peak vacation (June - July, +25%)
        WEEKEND_PEAK: 1.15,               // Friday evening & Sunday peak (+15%)
        LAST_MINUTE_SURCHARGE: 1.3,       // Booking within 3 days of departure (+30%)
        EARLY_BIRD_DISCOUNT: 0.9,         // Booking > 30 days in advance (-10%)
      },
    },
    AVG_SPEED_KMH: {
      SLEEPER_BUS: 50,
      PERSONAL_MOTORBIKE: 40,
      PERSONAL_CAR: 65,
      TRAIN: 55,
    },
    TRANSFER: {
      BUS_PER_KM: 1_200,                    // Connecting shuttle/bus fare: ~1,200 VNĐ / km
      FERRY_ONE_WAY_PASSENGER: 320_000,     // Superdong / Phu Quoc Express speedboat one-way ticket (VNĐ)
      FERRY_ONE_WAY_MOTORBIKE: 280_000,     // Thanh Thoi ferry passenger + motorbike ticket (VNĐ)
      FERRY_MINUTES: 140,                   // Speedboat crossing time: ~2h20m
      MOTORBIKE_FERRY_MINUTES: 180,         // Ferry crossing with motorbike: ~3h
      ISLAND_PORT_DISTANCE_KM: 45,          // Typical mainland port to island sea crossing distance (km)
      ISLAND_MAINLAND_BUS_FARE: 180_000,    // Connecting coach fare from railway/airport hub to ferry port (VNĐ)
      ISLAND_MAINLAND_BUS_MINUTES: 240,     // Connecting coach duration to mainland ferry port (minutes)
      LOCAL_HUB_MAX_DISTANCE_KM: 45,        // Satellite hub radius considered local transfer (e.g., DAD -> Hoi An ~28km)
      ISLAND_DIRECT_HUB_MAX_KM: 25,         // Max distance for an airport located on the island itself (PQC, VCS)
      MIN_FLIGHT_DISTANCE_KM: 150,          // Minimum road distance for commercial flights before road fallback
      DEFAULT_AIRPORT_TRANSFER_KM: 12,      // Fallback distance from airport to city center (km)
      DEFAULT_RAIL_TRANSFER_KM: 80,         // Fallback distance from regional train station to mountain/coastal town (km)
      MIN_TRAIN_DISTANCE_KM: 100,           // Minimum mainline railway distance (km)
      TRAIN_ISLAND_LAND_RATIO: 0.65,        // Share of total island route covered by mainline rail before port transfer
      OVERNIGHT_BUS_MIN_MINUTES: 360,       // Duration threshold (>6h) to recommend overnight sleeper bus
      MIN_LOCAL_TRANSFER_KM: 4,             // Minimum distance from urban airport/station to downtown hotel (km)
      LOCAL_TRANSFER_MINS_PER_KM: 1.3,      // Minutes per km for local airport/station shuttle into center
      MIN_LOCAL_TRANSFER_MINUTES: 15,       // Minimum local transfer time including pickup (minutes)
      REGIONAL_TRANSFER_MINS_PER_KM: 1.35,  // Minutes per km for inter-provincial connecting limousine/bus
    },
    CARRIERS: {
      FLIGHT_DIRECT: 'Vietnam Airlines, Vietjet Air, Bamboo Airways',
      FLIGHT_LIMOUSINE: 'Vietnam Airlines, Vietjet Air + Limousine nối chặng',
      FLIGHT_FERRY: 'Vietnam Airlines, Vietjet Air + Tàu cao tốc biển đảo',
      LIMOUSINE_DIRECT: 'Xe Limousine VIP / Taxi hợp đồng trọn gói',
      TRAIN: 'Đường sắt Việt Nam (Tàu SE / Thống Nhất)',
      SLEEPER_BUS: 'Phương Trang (FUTA), Thành Bưởi, Limousine liên tỉnh',
    },
  },

  // 3. Intracity Transit Rates (Inside Destination City)
  INTRACITY: {
    AVG_DAILY_KM: 35,                       // Typical sightseeing mileage per day (GrabBike/Taxi billing)
    TICKETS_PER_DAY: 120_000,               // Attraction tickets estimate per day (VNĐ)
    MOTORBIKE_RENTAL_PER_DAY: 130_000,      // Motorbike daily rental fee: 130,000 VNĐ / day
    DAILY_MOTORBIKE_GAS_ALLOWANCE: 40_000,  // Daily city touring fuel allowance: ~40,000 VNĐ / day
    GRAB_BIKE_PER_KM: 6_500,                // Tech motorbike taxi (GrabBike/Be): ~6,500 VNĐ / km
    TAXI_CAR_PER_KM: 14_000,                // 4-seat taxi / GrabCar: ~14,000 VNĐ / km
    WALK_THRESHOLD_KM: 0.8,                 // Max distance for walking between stops (km)
    WALK_SPEED_KMH: 4.5,                    // Average walking speed (km/h)
    BIKE_SPEED_KMH: 25,                     // Average urban motorbike speed (km/h)
    CAR_SPEED_KMH: 22,                      // Average urban car/taxi speed (km/h)
    ROAD_DETOUR_FACTOR: 1.25,               // Urban street detour multiplier over straight-line distance
    MIN_WALK_MINUTES: 2,                    // Minimum walking duration between adjacent stops
    MIN_BIKE_MINUTES: 3,                    // Minimum motorbike duration between stops
    MIN_CAR_MINUTES: 4,                     // Minimum car/taxi duration between stops
    BIKE_TRAFFIC_BUFFER_MINUTES: 2,         // Urban intersection buffer for motorbike
    CAR_TRAFFIC_BUFFER_MINUTES: 3,          // Urban intersection & pickup buffer for car/taxi
  },

  // 4. Default Daily Living Expenses by Budget Level
  LIVING_EXPENSES: {
    FOOD_PER_DAY: {
      LOW: 120_000,    // 3 budget meals (street food, pho, banh mi)
      MEDIUM: 280_000, // Good local specialties & comfortable dining
      HIGH: 700_000,   // Seafood feasts, fine dining, upscale cafes
      LUXURY: 1_500_000,
    },
    HOTEL_PER_NIGHT: {
      LOW: 250_000,    // Hostels, budget homestays, dorms
      MEDIUM: 650_000, // 3-star boutique hotels, cozy homestays
      HIGH: 1_800_000, // 4-5 star resorts & luxury hotels
      LUXURY: 4_500_000,
    },
  },

  // 5. Road Transit Safety Thresholds
  SAFETY_THRESHOLDS: {
    MOTORBIKE_MAX_DISTANCE_KM: 350,       // Distance > 350km triggers safety warning for motorbikes
    CAR_MAX_CONTINUOUS_KM: 600,           // Distance > 600km triggers fatigue/driver-swap notice
  },

  // 6. Regional Destination Tiers & Cost Multipliers
  DESTINATION_TIERS: {
    TIER_1_CITIES: ['hồ chí minh', 'ho chi minh', 'sài gòn', 'sai gon', 'hà nội', 'ha noi', 'phú quốc', 'phu quoc', 'côn đảo', 'con dao'],
    TIER_1_MULTIPLIER: 1.25,
    TIER_2_MULTIPLIER: 1.0,
    TIER_3_CITIES: [
      'cần thơ', 'can tho', 'quy nhơn', 'quy nhon', 'bình định', 'phú yên', 'tuy hòa',
      'ninh bình', 'hà giang', 'măng đen', 'đồng tháp', 'bến tre', 'an giang', 'châu đốc',
      'sóc trăng', 'bạc liêu', 'cà mau', 'trà vinh', 'tây ninh', 'kon tum', 'gia lai',
      'đắk lắk', 'dak lak', 'buôn ma thuột'
    ],
    TIER_3_MULTIPLIER: 0.8,
  },

  // 7. System Fallbacks, Island Identifiers & External Deep-Link Templates
  DEFAULTS: {
    FALLBACK_COORDS: { lat: 10.765, lng: 106.695 },
    ORIGIN_CITY: 'TP. Hồ Chí Minh',
    DEST_CITY: 'Đà Nẵng',
    ORIGIN_AIRPORT_CODE: 'SGN',
    MAINLAND_AIRPORT_CODE: 'DAD',
    ISLAND_AIRPORT_CODE: 'PQC',
    FERRY_PORT_NAME: 'Bến cảng tàu cao tốc đất liền',
  },
  ISLAND_KEYWORDS: [
    'phu quoc',
    'con dao',
    'cat ba',
    'ly son',
    'phu quy',
    'cu lao cham',
    'co to',
    'nam du',
    'binh ba',
    'binh hung',
  ],
  DEEP_LINKS: {
    GOOGLE_FLIGHTS_BASE: process.env.GOOGLE_FLIGHTS_BASE_URL || 'https://www.google.com/travel/flights',
    GOOGLE_MAPS_DIR_BASE: process.env.GOOGLE_MAPS_DIR_BASE_URL || 'https://www.google.com/maps/dir/?api=1',
    VEXERE_BUS_BASE: process.env.VEXERE_BUS_BASE_URL || 'https://vexere.com/vi-VN/ve-xe-khach',
    VEXERE_TRAIN_URL: process.env.VEXERE_TRAIN_URL || 'https://vexere.com/vi-VN/ve-tau-hoa',
    DSVN_URL: process.env.DSVN_URL || 'https://dsvn.vn',
  },
};

export function buildGoogleFlightsUrl(params: {
  originCode: string;
  destCode: string;
  departDate: string;
  returnDate?: string;
}): string {
  const { originCode, destCode, departDate, returnDate } = params;
  const query = `Flights to ${destCode} from ${originCode} on ${departDate}${returnDate ? ` through ${returnDate}` : ''}`;
  return `${PRICING_CONFIG.DEEP_LINKS.GOOGLE_FLIGHTS_BASE}?q=${encodeURIComponent(query)}`;
}

export function buildGoogleMapsDirUrl(params: {
  origin: string;
  destination: string;
  travelMode: 'driving' | 'two-wheeler' | 'transit' | 'walking';
}): string {
  const { origin, destination, travelMode } = params;
  return `${PRICING_CONFIG.DEEP_LINKS.GOOGLE_MAPS_DIR_BASE}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${travelMode}`;
}

export function buildVexereBusUrl(params?: {
  fromSlug?: string;
  toSlug?: string;
  fromExternalId?: string;
  toExternalId?: string;
  departDateVn?: string;
}): string {
  const base = PRICING_CONFIG.DEEP_LINKS.VEXERE_BUS_BASE;
  if (params?.fromSlug && params?.toSlug && params?.fromExternalId && params?.toExternalId) {
    return `${base}-tu-${params.fromSlug}-di-${params.toSlug}-${params.fromExternalId}t${params.toExternalId}1.html?date=${params.departDateVn || ''}`;
  }
  return base;
}

/**
 * Resolves destination cost multiplier based on city tier.
 * Tier 1 (Metros/Islands): 1.25x
 * Tier 2 (Standard Tourism Hubs: Da Nang, Da Lat, Nha Trang, etc.): 1.0x
 * Tier 3 (Budget / Rural / Eco): 0.8x
 */
export function getDestinationTierMultiplier(cityName?: string | null): number {
  if (!cityName) return PRICING_CONFIG.DESTINATION_TIERS.TIER_2_MULTIPLIER;
  const normalized = cityName.toLowerCase().replace(/^(tp\.|thành phố|tỉnh|huyện|quận)\s*/i, '').trim();

  for (const city of PRICING_CONFIG.DESTINATION_TIERS.TIER_1_CITIES) {
    if (normalized.includes(city)) return PRICING_CONFIG.DESTINATION_TIERS.TIER_1_MULTIPLIER;
  }
  for (const city of PRICING_CONFIG.DESTINATION_TIERS.TIER_3_CITIES) {
    if (normalized.includes(city)) return PRICING_CONFIG.DESTINATION_TIERS.TIER_3_MULTIPLIER;
  }
  return PRICING_CONFIG.DESTINATION_TIERS.TIER_2_MULTIPLIER;
}

export interface PlaceCostEstimate {
  cost: number;
  isFree: boolean;
  isDining: boolean;
}

/**
 * Computes realistic estimated cost for a stop bottom-up from database scraped data.
 * - Attractions: if min === 0 -> 0 (Free admission). If min > 0 -> min (adult base ticket).
 * - Dining/Cafe: median of scraped menu range (min + max) / 2.
 */
export function calculatePlaceEstimatedCost(params: {
  category?: { name?: string | null; nameVi?: string | null; slug?: string | null } | null;
  priceRange?: any;
  priceLevel?: string | null;
  placeName?: string | null;
}): PlaceCostEstimate {
  const catSlug = params.category?.slug?.toLowerCase() || '';
  const catName = (params.category?.nameVi || params.category?.name || '').toLowerCase();
  const placeName = (params.placeName || '').toLowerCase();

  const isDining =
    catSlug.includes('nha-hang') ||
    catSlug.includes('ca-phe') ||
    catSlug.includes('an-vat') ||
    catSlug.includes('bar') ||
    catName.includes('ẩm thực') ||
    catName.includes('nhà hàng') ||
    catName.includes('cà phê') ||
    catName.includes('quán ăn') ||
    placeName.includes('quán') ||
    placeName.includes('phở') ||
    placeName.includes('bún') ||
    placeName.includes('cơm');

  const min = params.priceRange?.min != null ? Number(params.priceRange.min) : null;
  const max = params.priceRange?.max != null ? Number(params.priceRange.max) : null;

  if (isDining) {
    let cost = 0;
    if (min != null && max != null && min > 0 && max > 0) {
      cost = Math.round((min + max) / 2);
    } else if (min != null && min > 0) {
      cost = min;
    } else if (max != null && max > 0) {
      cost = max;
    } else {
      // Fallback by price level for dining
      const level = params.priceLevel || 'MEDIUM';
      if (level === 'LOW') cost = 45_000;
      else if (level === 'HIGH') cost = 250_000;
      else if (level === 'LUXURY') cost = 600_000;
      else cost = 85_000;
    }
    return { cost, isFree: false, isDining: true };
  }

  // Attractions & Sightseeing
  const isNaturalOrPublic =
    catSlug.includes('thien-nhien') ||
    catSlug.includes('cho-sieu-thi') ||
    catName.includes('thiên nhiên') ||
    catName.includes('biển') ||
    catName.includes('chợ') ||
    placeName.includes('công viên') ||
    placeName.includes('hồ ') ||
    placeName.includes('bãi biển') ||
    placeName.includes('cầu ') ||
    placeName.includes('phố đi bộ');

  if (min === 0 || (min == null && isNaturalOrPublic)) {
    return { cost: 0, isFree: true, isDining: false };
  }

  if (min != null && min > 0) {
    return { cost: min, isFree: false, isDining: false };
  }

  // Fallback for ticketed attraction by price level
  const level = params.priceLevel || 'MEDIUM';
  let ticketCost = 0;
  if (level === 'LOW') ticketCost = 30_000;
  else if (level === 'HIGH') ticketCost = 180_000;
  else if (level === 'LUXURY') ticketCost = 450_000;
  else ticketCost = 60_000;

  return { cost: ticketCost, isFree: false, isDining: false };
}

/**
 * Deterministic Safety Guard for long-distance travel.
 * Rule-based check: 0 tokens, 0ms, 100% reliable.
 */
export interface SafetyAdvisory {
  level: 'WARNING' | 'INFO';
  title: string;
  message: string;
}

export function checkTransitSafety(
  transitMode: string,
  distanceKm: number,
): SafetyAdvisory | null {
  if (
    (transitMode === 'PERSONAL_MOTORBIKE' || transitMode === 'MOTORBIKE') &&
    distanceKm > PRICING_CONFIG.SAFETY_THRESHOLDS.MOTORBIKE_MAX_DISTANCE_KM
  ) {
    return {
      level: 'WARNING',
      title: 'Chặng đường quá xa cho xe máy',
      message: `Quãng đường ${Math.round(distanceKm)}km đi xe máy liên tục (>7 tiếng) rất nguy hiểm và dễ kiệt sức. Bạn nên chia đôi chặng để nghỉ đêm hoặc chọn Xe khách/Máy bay.`,
    };
  }

  if (
    (transitMode === 'PERSONAL_CAR' || transitMode === 'CAR') &&
    distanceKm > PRICING_CONFIG.SAFETY_THRESHOLDS.CAR_MAX_CONTINUOUS_KM
  ) {
    return {
      level: 'INFO',
      title: 'Lưu ý lái xe đường dài',
      message: `Hành trình ${Math.round(distanceKm)}km mất khoảng 9-10 tiếng lái xe. Hãy đổi tài xế hoặc dừng nghỉ chân sau mỗi 3 tiếng để đảm bảo an toàn.`,
    };
  }

  return null;
}

export interface FlightPricingParams {
  airDistanceKm: number;
  budgetLevel?: string;
  departDate?: string;
}

export interface FlightPricingResult {
  baseFare: number;
  finalFare: number;
  flightDurationMinutes: number;
  multipliers: {
    budget: number;
    season: number;
    dayOfWeek: number;
    advance: number;
  };
}

/**
 * Computes flight duration in minutes based on great-circle air distance:
 * 30 mins (taxiing + climb + descent) + (airDistanceKm / 750 km/h * 60).
 */
export function calculateFlightDuration(airDistanceKm: number): number {
  const F = PRICING_CONFIG.INTERCITY.FLIGHT;
  const cruiseMinutes = Math.round((airDistanceKm / F.CRUISE_SPEED_KMH) * 60);
  return Math.max(F.MIN_FLIGHT_MINUTES, F.TAXI_TAKEOFF_MINUTES + cruiseMinutes);
}

/**
 * Computes flight fare based on continuous air distance affine function:
 * Base = Fixed airport overhead + (airDistanceKm * Rate per km).
 * Then applies contextual multipliers: Budget Tier, Seasonality (Tet/Summer), Day of week, and Advance Purchase.
 */
export function calculateFlightFare(params: FlightPricingParams): FlightPricingResult {
  const F = PRICING_CONFIG.INTERCITY.FLIGHT;
  const airDist = Math.max(1, params.airDistanceKm);
  const baseFare = Math.round(F.BASE_AIRPORT_FEE + airDist * F.RATE_PER_KM);
  const flightDurationMinutes = calculateFlightDuration(airDist);

  // 1. Budget Level Multiplier
  const levelKey = (params.budgetLevel || 'MEDIUM').toUpperCase();
  const budgetMultiplier =
    F.BUDGET_MULTIPLIERS[levelKey as keyof typeof F.BUDGET_MULTIPLIERS] ?? 1.0;

  // 2. Date-based Contextual Multipliers
  let seasonMultiplier = 1.0;
  let dayOfWeekMultiplier = 1.0;
  let advanceMultiplier = 1.0;

  if (params.departDate) {
    const d = new Date(params.departDate);
    if (!isNaN(d.getTime())) {
      const month = d.getMonth() + 1; // 1-12
      const day = d.getDate();
      const dayOfWeek = d.getDay(); // 0 is Sunday, 5 is Friday

      // Tet Lunar New Year window (mid-Jan to late-Feb)
      if ((month === 1 && day >= 15) || (month === 2 && day <= 20)) {
        seasonMultiplier = F.PEAK_MULTIPLIERS.TET_PEAK;
      } else if (month === 6 || month === 7) {
        // Summer high-season (June - July)
        seasonMultiplier = F.PEAK_MULTIPLIERS.SUMMER_PEAK;
      }

      // Weekend peak: Friday (5) or Sunday (0)
      if (dayOfWeek === 0 || dayOfWeek === 5) {
        dayOfWeekMultiplier = F.PEAK_MULTIPLIERS.WEEKEND_PEAK;
      }

      // Advance purchase lead time (days until departure)
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const leadTimeDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (leadTimeDays >= 0 && leadTimeDays <= 3) {
        advanceMultiplier = F.PEAK_MULTIPLIERS.LAST_MINUTE_SURCHARGE;
      } else if (leadTimeDays > 30) {
        advanceMultiplier = F.PEAK_MULTIPLIERS.EARLY_BIRD_DISCOUNT;
      }
    }
  }

  const rawTotal =
    baseFare * budgetMultiplier * seasonMultiplier * dayOfWeekMultiplier * advanceMultiplier;
  // Round to nearest 10,000 VNĐ for realistic airline pricing representation
  const finalFare = Math.round(rawTotal / 10_000) * 10_000;

  return {
    baseFare,
    finalFare,
    flightDurationMinutes,
    multipliers: {
      budget: budgetMultiplier,
      season: seasonMultiplier,
      dayOfWeek: dayOfWeekMultiplier,
      advance: advanceMultiplier,
    },
  };
}


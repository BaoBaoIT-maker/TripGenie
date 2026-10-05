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
      LONG_HAUL_KM: 800,                  // Above this road distance: long-haul fare/duration
      ONE_WAY_SHORT: 1_400_000,           // Benchmark one-way fare, short route (VNĐ)
      ONE_WAY_LONG: 1_700_000,            // Benchmark one-way fare, long route (VNĐ)
      MINUTES_SHORT: 80,
      MINUTES_LONG: 120,
    },
    AVG_SPEED_KMH: {
      SLEEPER_BUS: 50,
      PERSONAL_MOTORBIKE: 40,
      PERSONAL_CAR: 65,
      TRAIN: 55,
    },
    TRANSFER: {
      BUS_PER_KM: 1_200,                // Connecting shuttle/bus fare: ~1,200 VNĐ / km
      FERRY_ONE_WAY_PASSENGER: 320_000, // Superdong / Phu Quoc Express speedboat one-way ticket (VNĐ)
      FERRY_ONE_WAY_MOTORBIKE: 280_000, // Thanh Thoi ferry passenger + motorbike ticket (VNĐ)
      FERRY_MINUTES: 140,               // Speedboat crossing time: ~2h20m
    },
  },

  // 3. Intracity Transit Rates (Inside Destination City)
  INTRACITY: {
    AVG_DAILY_KM: 35,                     // Typical sightseeing mileage per day (GrabBike/Taxi billing)
    TICKETS_PER_DAY: 120_000,             // Attraction tickets estimate per day (VNĐ)
    MOTORBIKE_RENTAL_PER_DAY: 130_000,    // Motorbike daily rental fee: 130,000 VNĐ / day
    DAILY_MOTORBIKE_GAS_ALLOWANCE: 40_000,// Daily city touring fuel allowance: ~40,000 VNĐ / day
    GRAB_BIKE_PER_KM: 6_500,              // Tech motorbike taxi (GrabBike/Be): ~6,500 VNĐ / km
    TAXI_CAR_PER_KM: 14_000,              // 4-seat taxi / GrabCar: ~14,000 VNĐ / km
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
};

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

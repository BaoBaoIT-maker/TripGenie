/** Shared domain constants and format helpers used by wizard, transit card, and detail timeline. */

const VND = new Intl.NumberFormat('vi-VN');
const MINUTES_PER_DAY = 1440;

export const TRANSIT_UI_CONFIG = {
  MOTORBIKE_SAFETY_LIMIT_KM: 350,
  DEFAULT_GAS_PRICE_VND: 23_000,
  DEFAULT_AIRPORT_TRANSFER_KM: 12,
  DEFAULT_AIRPORT_TRANSFER_MINUTES: 20,
  LOCAL_TRANSFER_MINS_PER_KM: 1.3,
  FLIGHT_MIN_DURATION_MINUTES: 45,
  FLIGHT_DEFAULT_DURATION_MINUTES: 80,
  FLIGHT_DEPART_MINUTES: 9 * 60, // 09:00
  TRAIN_DEPART_TIME: '19:00',
  TRAIN_ARRIVE_TIME: '07:30 hôm sau',
  BUS_DEPART_TIME: '22:00',
  BUS_ARRIVE_TIME: '06:00 sáng',
  MOTORBIKE_DEPART_TIME: '05:30',
  INTRACITY: {
    WALK_THRESHOLD_KM: 0.8,
    WALK_SPEED_KMH: 4.5,
    BIKE_SPEED_KMH: 25,
    ROAD_DETOUR_FACTOR: 1.25,
    MIN_WALK_MINUTES: 2,
    MIN_BIKE_MINUTES: 3,
    BIKE_BUFFER_MINUTES: 2,
  },
  DINING_KEYWORDS: [
    'ẩm thực',
    'nhà hàng',
    'cà phê',
    'quán ăn',
    'tráng miệng',
    'ăn vặt',
    'bar',
    'quán',
    'phở',
    'bún',
    'cơm',
  ],
} as const;

export function formatVnd(amount: number): string {
  return VND.format(amount) + '₫';
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

export function formatClockMinutes(totalMins: number): string {
  const normalized = ((totalMins % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function cleanHubName(name?: string | null): string {
  if (!name) return '';
  return name.includes('?') ? name.replace(/\?+/g, '').trim() : name;
}

export function isDiningActivity(categoryName?: string | null, placeName?: string | null): boolean {
  const catLower = (categoryName || '').toLowerCase();
  const placeLower = (placeName || '').toLowerCase();
  return TRANSIT_UI_CONFIG.DINING_KEYWORDS.some(
    (kw) => catLower.includes(kw) || placeLower.includes(kw),
  );
}


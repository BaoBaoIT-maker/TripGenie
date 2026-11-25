/** Shared domain constants and format helpers used by wizard, transit card, and detail timeline. */

import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type { AppLocale } from '@/i18n';

const VND = new Intl.NumberFormat('vi-VN');
const MINUTES_PER_DAY = 1440;
const ISO_DATE_FORMAT = 'yyyy-MM-dd';
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VI_WEEKDAYS_SHORT = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'] as const;

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

export function formatDuration(minutes: number, locale: AppLocale = 'vi'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === 'en') {
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr`;
    return `${h}h ${m}m`;
  }
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

/**
 * Formats a date string (ISO 8601, YYYY-MM-DD, or DD/MM/YYYY) into Vietnamese DD/MM/YYYY format.
 * Strips any ISO timestamp suffix (e.g. 2026-10-28T00:00:00.000Z -> 28/10/2026).
 */
export function formatDateVi(dateStr?: string | null): string {
  if (!dateStr) return '';
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
  const parts = cleanDate.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    if (parts[2].length === 4) {
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
  }
  return cleanDate;
}

/**
 * Formats start and end dates into a readable range
 * (e.g. "28/10/2026 – 30/10/2026" in vi or "Oct 28, 2026 – Oct 30, 2026" in en).
 */
export function formatTripDates(
  start?: string | null,
  end?: string | null,
  locale: AppLocale = 'vi',
): string {
  if (!start) return locale === 'en' ? 'Dates TBD' : 'Chưa định ngày';
  if (locale === 'en') {
    const formatEnDate = (value?: string | null): string => {
      if (!value) return '';
      const cleanDate = value.includes('T') ? value.split('T')[0] : value.trim();
      const parts = cleanDate.split(/[-/]/);
      let dateObj: Date | null = null;
      if (parts.length === 3 && parts[0].length === 4) {
        dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else if (parts.length === 3 && parts[2].length === 4) {
        dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      } else {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
      }
      if (!dateObj || Number.isNaN(dateObj.getTime())) return cleanDate;
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };
    const startEn = formatEnDate(start);
    const endEn = formatEnDate(end);
    if (!endEn || startEn === endEn) return startEn;
    return `${startEn} – ${endEn}`;
  }
  const startVi = formatDateVi(start);
  const endVi = formatDateVi(end);
  if (!endVi || startVi === endVi) return startVi;
  return `${startVi} – ${endVi}`;
}

/** Parses YYYY-MM-DD (or ISO timestamp) into a local midnight Date to avoid UTC day-shift bugs. */
export function parseLocalDate(value?: string | null): Date | null {
  if (!value) return null;
  const dateOnly = value.includes('T') ? value.split('T')[0] : value.trim();
  if (!ISO_DATE_ONLY_PATTERN.test(dateOnly)) return null;
  const parsed = parseISO(`${dateOnly}T00:00:00`);
  return isValid(parsed) ? parsed : null;
}

/** Formats a Date as local YYYY-MM-DD for HTML date inputs and API payloads. */
export function toLocalDateString(date: Date): string {
  return format(date, ISO_DATE_FORMAT);
}

/** Inclusive calendar day count between start and end; returns null if invalid or end < start. */
export function calculateTripDays(start?: string | null, end?: string | null): number | null {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  if (!startDate || !endDate) return null;
  const diff = differenceInCalendarDays(endDate, startDate);
  return diff < 0 ? null : diff + 1;
}

/** Returns inclusive max end date (YYYY-MM-DD) for a startDate and maxDays ceiling. */
export function getMaxTripEndDate(startDate?: string | null, maxDays = 1): string | undefined {
  const start = parseLocalDate(startDate);
  if (!start) return undefined;
  return toLocalDateString(addDays(start, Math.max(1, maxDays) - 1));
}

export interface NormalizedDateRange {
  startDate: string;
  endDate: string;
  clamped: boolean;
}

/**
 * Normalizes a trip date range in local calendar time:
 * - Returns null when either date is empty/invalid (prevents NaN state on picker clear).
 * - Pulls endDate forward to startDate when endDate < startDate.
 * - Clamps endDate to maxDays (inclusive) and flags clamped=true.
 */
export function normalizeTripDateRange(
  startDate: string,
  endDate: string,
  maxDays: number,
): NormalizedDateRange | null {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end) return null;

  const limit = Math.max(1, maxDays);
  const days = differenceInCalendarDays(end, start) + 1;
  const normalizedStart = toLocalDateString(start);

  if (days < 1) {
    return { startDate: normalizedStart, endDate: normalizedStart, clamped: false };
  }
  if (days > limit) {
    return {
      startDate: normalizedStart,
      endDate: toLocalDateString(addDays(start, limit - 1)),
      clamped: true,
    };
  }
  return { startDate: normalizedStart, endDate: toLocalDateString(end), clamped: false };
}

/** Returns a compact weekday label (e.g. "Thứ 4" / "Wed") for YYYY-MM-DD input values. */
export function formatWeekdayShort(dateStr?: string | null, locale: AppLocale = 'vi'): string {
  const date = parseLocalDate(dateStr);
  if (!date) return '';
  if (locale === 'en') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return VI_WEEKDAYS_SHORT[date.getDay()];
}

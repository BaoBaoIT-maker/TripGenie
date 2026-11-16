import {
  TIME_SCHEDULING_CONSTANTS,
  timeToMinutes,
} from '../../../common/utils/time-of-day.util';

export type OpeningState = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export interface OpeningStatus {
  state: OpeningState;
  label: string | null;
  todayHours: string | null;
}

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const OSM_DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

const MINUTES_PER_DAY = 24 * TIME_SCHEDULING_CONSTANTS.MINUTES_PER_HOUR;

function getUtcDayOfWeek(
  dayDate: string | Date | null | undefined,
): number | null {
  if (!dayDate) return null;
  const iso =
    dayDate instanceof Date
      ? dayDate.toISOString().slice(0, 10)
      : String(dayDate).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  ).getUTCDay();
}

function parseClockToken(token: string): number | null {
  const trimmed = token.trim().toLowerCase();
  if (trimmed === 'midnight' || trimmed === '24:00') return MINUTES_PER_DAY;
  if (trimmed === 'noon')
    return 12 * TIME_SCHEDULING_CONSTANTS.MINUTES_PER_HOUR;

  const amPmMatch = /^(\d{1,2})(?::([0-5]\d))?\s*(am|pm)$/.exec(trimmed);
  if (amPmMatch) {
    let h = Number(amPmMatch[1]);
    const min = amPmMatch[2] ? Number(amPmMatch[2]) : 0;
    if (h < 1 || h > 12) return null;
    if (amPmMatch[3] === 'am') {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
    return h * TIME_SCHEDULING_CONSTANTS.MINUTES_PER_HOUR + min;
  }

  return timeToMinutes(trimmed);
}

function parseIntervals(expr: string): Array<[number, number]> | null {
  const parts = expr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const intervals: Array<[number, number]> = [];
  for (const part of parts) {
    const dashIdx = part.indexOf('-');
    if (dashIdx === -1) return null;
    const startMin = parseClockToken(part.slice(0, dashIdx));
    const endMin = parseClockToken(part.slice(dashIdx + 1));
    if (startMin == null || endMin == null) return null;
    // Equal endpoints (e.g. noisy OSM "06:00-06:00") are ambiguous unless explicit 24/7
    if (startMin === endMin) return null;
    intervals.push([startMin, endMin]);
  }
  return intervals;
}

function resolveOsmRawSchedule(
  raw: string,
  dayOfWeek: number | null,
): {
  is247: boolean;
  isClosed?: boolean;
  hoursLabel: string | null;
  intervals: Array<[number, number]> | null;
} {
  const clean = raw.trim();
  if (/^24\s*\/\s*7$/i.test(clean)) {
    return {
      is247: true,
      hoursLabel: '24/7',
      intervals: [[0, MINUTES_PER_DAY]],
    };
  }

  // Matches optional OSM day specification prefix: "Mo-Su ", "Mo-Sa ", "Mo-Fr ", "Su "
  const osmPrefix =
    /^(?:(mo|tu|we|th|fr|sa|su)(?:-(mo|tu|we|th|fr|sa|su))?\s+)?(.+)$/i.exec(
      clean,
    );
  if (!osmPrefix) {
    return { is247: false, hoursLabel: null, intervals: null };
  }

  const startDayToken = osmPrefix[1]?.toLowerCase();
  const endDayToken = osmPrefix[2]?.toLowerCase();
  const timeExpr = osmPrefix[3].trim();

  if (startDayToken && dayOfWeek != null) {
    const startIdx = OSM_DAY_INDEX[startDayToken];
    const endIdx = endDayToken ? OSM_DAY_INDEX[endDayToken] : startIdx;
    const inDayRange =
      startIdx <= endIdx
        ? dayOfWeek >= startIdx && dayOfWeek <= endIdx
        : dayOfWeek >= startIdx || dayOfWeek <= endIdx;
    if (!inDayRange) {
      return {
        is247: false,
        isClosed: true,
        hoursLabel: null,
        intervals: null,
      };
    }
  } else if (startDayToken && dayOfWeek == null) {
    // Only assume daily hours without a trip date if prefix covers every day (Mo-Su)
    if (!(startDayToken === 'mo' && endDayToken === 'su')) {
      return { is247: false, hoursLabel: null, intervals: null };
    }
  }

  if (/^(off|closed)$/i.test(timeExpr)) {
    return { is247: false, isClosed: true, hoursLabel: null, intervals: null };
  }

  const intervals = parseIntervals(timeExpr);
  return {
    is247: false,
    hoursLabel: intervals ? timeExpr : null,
    intervals,
  };
}

function resolveDayExprFromRecord(
  obj: Record<string, unknown>,
  dayOfWeek: number | null,
): string | null {
  if (dayOfWeek != null) {
    const key = WEEKDAY_KEYS[dayOfWeek];
    return typeof obj[key] === 'string' ? obj[key].trim() : null;
  }
  const values = WEEKDAY_KEYS.map((k) =>
    typeof obj[k] === 'string' ? obj[k].trim() : null,
  ).filter((v): v is string => Boolean(v));
  if (values.length === WEEKDAY_KEYS.length && new Set(values).size === 1) {
    return values[0];
  }
  return null;
}

/**
 * Evaluates whether a place is open at a scheduled stop's date & startTime
 * against real DB `opening_hours` shapes ({ monday..sunday } or { raw }).
 */
export function evaluateOpeningStatus(
  openingHours: unknown,
  dayDate: string | Date | null | undefined,
  atTime: string | null | undefined,
): OpeningStatus {
  if (
    !openingHours ||
    typeof openingHours !== 'object' ||
    Array.isArray(openingHours)
  ) {
    return { state: 'UNKNOWN', label: null, todayHours: null };
  }

  const record = openingHours as Record<string, unknown>;
  const dayOfWeek = getUtcDayOfWeek(dayDate);

  let intervals: Array<[number, number]> | null = null;
  let hoursLabel: string | null = null;
  let is247 = false;
  let isClosed = false;

  const weekdayExpr = resolveDayExprFromRecord(record, dayOfWeek);
  if (weekdayExpr) {
    if (/^(off|closed)$/i.test(weekdayExpr)) {
      isClosed = true;
    } else if (/^24\s*\/\s*7$/i.test(weekdayExpr)) {
      is247 = true;
      hoursLabel = '24/7';
      intervals = [[0, MINUTES_PER_DAY]];
    } else {
      intervals = parseIntervals(weekdayExpr);
      hoursLabel = intervals ? weekdayExpr : null;
    }
  } else if (typeof record.raw === 'string' && record.raw.trim()) {
    const parsed = resolveOsmRawSchedule(record.raw, dayOfWeek);
    is247 = parsed.is247;
    isClosed = Boolean(parsed.isClosed);
    hoursLabel = parsed.hoursLabel;
    intervals = parsed.intervals;
  }

  if (isClosed) {
    return { state: 'CLOSED', label: 'Đóng cửa ngày này', todayHours: null };
  }
  if (is247) {
    return { state: 'OPEN', label: 'Mở cửa 24/7', todayHours: '24/7' };
  }
  if (!intervals || !hoursLabel) {
    return { state: 'UNKNOWN', label: null, todayHours: null };
  }

  const atMinutes = timeToMinutes(atTime);
  if (atMinutes == null) {
    return {
      state: 'UNKNOWN',
      label: `Giờ mở cửa ${hoursLabel}`,
      todayHours: hoursLabel,
    };
  }

  const isInside = intervals.some(([start, end]) =>
    end > start
      ? atMinutes >= start && atMinutes <= end
      : atMinutes >= start || atMinutes <= end,
  );

  return isInside
    ? { state: 'OPEN', label: `Mở cửa (${hoursLabel})`, todayHours: hoursLabel }
    : {
        state: 'CLOSED',
        label: `Ngoài giờ mở cửa (${hoursLabel})`,
        todayHours: hoursLabel,
      };
}

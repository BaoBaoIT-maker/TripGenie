export const TIME_OF_DAY_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export const TIME_SCHEDULING_CONSTANTS = {
  MINUTES_PER_HOUR: 60,
  MIN_MINUTE_OF_DAY: 0,
  MAX_CLOCK_MINUTE_OF_DAY: 23 * 60 + 59, // 23:59
  DEFAULT_MAX_ACTIVITY_END_MINUTE: 23 * 60 + 45, // 23:45
  DEFAULT_TRANSIT_BUFFER_MINUTES: 15,
  DEFAULT_MIN_DURATION_MINUTES: 45,
  DEFAULT_ACTIVITY_DURATION_MINUTES: 90,
  MIN_ACTIVITY_DURATION_MINUTES: 15,
  FALLBACK_START_MINUTE: 8 * 60 + 30, // 08:30
  FALLBACK_END_MINUTE: 10 * 60, // 10:00
} as const;

export type MoveDirection = 'UP' | 'DOWN';

export interface MovableActivityInput {
  id: string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  estimatedDurationMinutes?: number | null;
  visitOrder?: number | string | { toNumber(): number } | null;
}

export interface MovableActivityUpdate {
  id: string;
  visitOrder: number;
  startTimeStr: string;
  endTimeStr: string;
  durationMinutes: number;
}

export interface ExistingTimeIntervalInput {
  startTime?: Date | string | null;
  endTime?: Date | string | null;
}

export interface NonOverlappingSlotOptions {
  bufferMinutes?: number;
  minDurationMinutes?: number;
  maxMinuteOfDay?: number;
}

export interface ResolvedTimeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

/** "8:30" | "08:30" -> Date on 1970-01-01 UTC (Prisma @db.Time), or null if invalid. */
export function parseTimeOfDay(value: string | undefined | null): Date | null {
  const match = value ? TIME_OF_DAY_REGEX.exec(value.trim()) : null;
  if (!match) return null;
  return new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2])));
}

/** Date from a @db.Time column -> "HH:mm", or null. */
export function formatTimeOfDay(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

/** Converts Date (@db.Time) or "HH:mm" string to minutes since 00:00, or null. */
export function timeToMinutes(
  value: Date | string | null | undefined,
): number | null {
  if (!value) return null;
  const str = value instanceof Date ? formatTimeOfDay(value) : value.trim();
  if (!str) return null;
  const match = TIME_OF_DAY_REGEX.exec(str);
  if (!match) return null;
  return (
    Number(match[1]) * TIME_SCHEDULING_CONSTANTS.MINUTES_PER_HOUR +
    Number(match[2])
  );
}

/** Converts minutes since 00:00 to "HH:mm" string, clamped within [00:00, 23:59]. */
export function minutesToTimeStr(totalMinutes: number): string {
  const clamped = Math.max(
    TIME_SCHEDULING_CONSTANTS.MIN_MINUTE_OF_DAY,
    Math.min(
      TIME_SCHEDULING_CONSTANTS.MAX_CLOCK_MINUTE_OF_DAY,
      Math.round(totalMinutes),
    ),
  );
  const hours = Math.floor(
    clamped / TIME_SCHEDULING_CONSTANTS.MINUTES_PER_HOUR,
  );
  const mins = clamped % TIME_SCHEDULING_CONSTANTS.MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Finds the earliest non-overlapping [start, end] time window starting at or after
 * `baseSlot.start`, preserving a transit buffer between activities on the same day.
 */
export function resolveNonOverlappingTimeSlot(
  baseSlot: { start: string; end: string },
  existingActivities: ExistingTimeIntervalInput[],
  options?: NonOverlappingSlotOptions,
): ResolvedTimeSlot {
  const buffer =
    options?.bufferMinutes ??
    TIME_SCHEDULING_CONSTANTS.DEFAULT_TRANSIT_BUFFER_MINUTES;
  const minDuration =
    options?.minDurationMinutes ??
    TIME_SCHEDULING_CONSTANTS.DEFAULT_MIN_DURATION_MINUTES;
  const maxMinute =
    options?.maxMinuteOfDay ??
    TIME_SCHEDULING_CONSTANTS.DEFAULT_MAX_ACTIVITY_END_MINUTE;

  const baseStart =
    timeToMinutes(baseSlot.start) ??
    TIME_SCHEDULING_CONSTANTS.FALLBACK_START_MINUTE;
  const baseEnd =
    timeToMinutes(baseSlot.end) ??
    TIME_SCHEDULING_CONSTANTS.FALLBACK_END_MINUTE;
  const desiredDuration = Math.max(minDuration, baseEnd - baseStart);

  const intervals = existingActivities
    .map((act) => {
      const s = timeToMinutes(act.startTime);
      const e = timeToMinutes(act.endTime);
      if (s === null || e === null || e <= s) return null;
      return { start: s, end: e };
    })
    .filter((item): item is { start: number; end: number } => item !== null)
    .sort((a, b) => a.start - b.start);

  let candidateStart = baseStart;
  let fittedEnd: number | null = null;

  for (const interval of intervals) {
    const candidateEnd = Math.min(candidateStart + desiredDuration, maxMinute);

    // Interval ends well before candidateStart (including transit buffer)
    if (interval.end + buffer <= candidateStart) {
      continue;
    }

    // Full desired duration fits cleanly before this interval
    if (interval.start - buffer >= candidateEnd) {
      fittedEnd = candidateEnd;
      break;
    }

    // Partial gap before this interval is still long enough (>= minDuration)
    const availableEndBeforeInterval = interval.start - buffer;
    if (availableEndBeforeInterval - candidateStart >= minDuration) {
      fittedEnd = availableEndBeforeInterval;
      break;
    }

    // Otherwise, advance candidateStart past this interval + transit buffer
    candidateStart = Math.max(candidateStart, interval.end + buffer);
  }

  let finalEnd =
    fittedEnd ?? Math.min(candidateStart + desiredDuration, maxMinute);
  if (finalEnd <= candidateStart) {
    candidateStart = Math.max(
      TIME_SCHEDULING_CONSTANTS.MIN_MINUTE_OF_DAY,
      maxMinute - minDuration,
    );
    finalEnd = maxMinute;
  }

  return {
    start: minutesToTimeStr(candidateStart),
    end: minutesToTimeStr(finalEnd),
    durationMinutes: finalEnd - candidateStart,
  };
}

function toVisitOrderNumber(val: MovableActivityInput['visitOrder']): number {
  if (val == null) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'string') {
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return typeof val.toNumber === 'function' ? val.toNumber() : 0;
}

export type AdjacentMoveResult =
  | { status: 'NOT_FOUND' }
  | { status: 'AT_BOUNDARY' }
  | { status: 'MOVED'; updates: MovableActivityUpdate[] };

/**
 * PhÆ°Æ¡ng Ã¡n A (Plan A): Swaps an activity with its adjacent sibling in the same day
 * and deterministically shifts their start/end times while preserving each stop's
 * duration and transition gap (cascading subsequent stops only when overlap occurs).
 */
export function computeAdjacentMoveSchedule(
  activities: MovableActivityInput[],
  targetId: string,
  direction: MoveDirection,
  options?: NonOverlappingSlotOptions,
): AdjacentMoveResult {
  const buffer =
    options?.bufferMinutes ??
    TIME_SCHEDULING_CONSTANTS.DEFAULT_TRANSIT_BUFFER_MINUTES;
  const maxMinute =
    options?.maxMinuteOfDay ??
    TIME_SCHEDULING_CONSTANTS.DEFAULT_MAX_ACTIVITY_END_MINUTE;
  const defaultDur =
    TIME_SCHEDULING_CONSTANTS.DEFAULT_ACTIVITY_DURATION_MINUTES;
  const minDur = TIME_SCHEDULING_CONSTANTS.MIN_ACTIVITY_DURATION_MINUTES;

  const sorted = [...activities].sort((a, b) => {
    const aStart = timeToMinutes(a.startTime) ?? Number.MAX_SAFE_INTEGER;
    const bStart = timeToMinutes(b.startTime) ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    const orderDiff =
      toVisitOrderNumber(a.visitOrder) - toVisitOrderNumber(b.visitOrder);
    if (orderDiff !== 0) return orderDiff;
    return a.id.localeCompare(b.id);
  });

  const idx = sorted.findIndex((a) => a.id === targetId);
  if (idx === -1) return { status: 'NOT_FOUND' };

  const otherIdx = direction === 'UP' ? idx - 1 : idx + 1;
  if (otherIdx < 0 || otherIdx >= sorted.length)
    return { status: 'AT_BOUNDARY' };

  const baseline: Array<{
    id: string;
    start: number;
    end: number;
    dur: number;
  }> = [];
  for (let i = 0; i < sorted.length; i++) {
    const act = sorted[i];
    const rawStart = timeToMinutes(act.startTime);
    const rawEnd = timeToMinutes(act.endTime);
    const dur =
      rawStart !== null && rawEnd !== null && rawEnd > rawStart
        ? rawEnd - rawStart
        : act.estimatedDurationMinutes && act.estimatedDurationMinutes > 0
          ? act.estimatedDurationMinutes
          : defaultDur;
    const prevEnd = i === 0 ? null : baseline[i - 1].end;
    const start =
      rawStart ??
      (prevEnd !== null
        ? prevEnd + buffer
        : TIME_SCHEDULING_CONSTANTS.FALLBACK_START_MINUTE);
    const clampedStart = Math.min(start, maxMinute - minDur);
    const end =
      rawEnd !== null && rawEnd > clampedStart
        ? Math.min(rawEnd, TIME_SCHEDULING_CONSTANTS.MAX_CLOCK_MINUTE_OF_DAY)
        : Math.min(maxMinute, clampedStart + dur);
    baseline.push({
      id: act.id,
      start: clampedStart,
      end: Math.max(clampedStart + minDur, end),
      dur: Math.max(minDur, dur),
    });
  }

  const earlierIdx = Math.min(idx, otherIdx);
  const laterIdx = Math.max(idx, otherIdx);
  const prevFirst = baseline[earlierIdx];
  const prevSecond = baseline[laterIdx];
  const preservedGap = Math.max(buffer, prevSecond.start - prevFirst.end);

  const reordered = [...baseline];
  reordered[earlierIdx] = { ...prevSecond };
  reordered[laterIdx] = { ...prevFirst };

  let nextFirstStart = prevFirst.start;
  let nextFirstEnd = nextFirstStart + reordered[earlierIdx].dur;
  let nextSecondStart = nextFirstEnd + preservedGap;
  let nextSecondEnd = nextSecondStart + reordered[laterIdx].dur;

  if (nextSecondEnd > maxMinute) {
    const minAllowedStart =
      earlierIdx === 0
        ? TIME_SCHEDULING_CONSTANTS.MIN_MINUTE_OF_DAY
        : reordered[earlierIdx - 1].end + buffer;
    const slackBack = Math.max(0, nextFirstStart - minAllowedStart);
    const pullBack = Math.min(nextSecondEnd - maxMinute, slackBack);
    nextFirstStart -= pullBack;
    nextFirstEnd -= pullBack;
    nextSecondStart -= pullBack;
    nextSecondEnd -= pullBack;

    if (nextSecondEnd > maxMinute) {
      nextSecondEnd = maxMinute;
      nextSecondStart = Math.min(
        nextSecondStart,
        Math.max(nextFirstStart + minDur, maxMinute - minDur),
      );
      if (nextFirstEnd > nextSecondStart) {
        nextFirstEnd = nextSecondStart;
      }
    }
  }

  reordered[earlierIdx] = {
    ...reordered[earlierIdx],
    start: nextFirstStart,
    end: Math.max(nextFirstStart + minDur, nextFirstEnd),
  };
  reordered[laterIdx] = {
    ...reordered[laterIdx],
    start: nextSecondStart,
    end: Math.max(nextSecondStart + minDur, nextSecondEnd),
  };

  // Ripple subsequent activities forward only if swapped second activity overlaps them
  for (let k = laterIdx + 1; k < reordered.length; k++) {
    const minStart = reordered[k - 1].end + buffer;
    if (reordered[k].start < minStart) {
      const shiftedStart = Math.min(minStart, maxMinute - minDur);
      const shiftedEnd = Math.min(
        maxMinute,
        Math.max(shiftedStart + minDur, shiftedStart + reordered[k].dur),
      );
      reordered[k] = { ...reordered[k], start: shiftedStart, end: shiftedEnd };
    }
  }

  return {
    status: 'MOVED',
    updates: reordered.map((item, position) => ({
      id: item.id,
      visitOrder: position + 1,
      startTimeStr: minutesToTimeStr(item.start),
      endTimeStr: minutesToTimeStr(item.end),
      durationMinutes: Math.max(minDur, item.end - item.start),
    })),
  };
}

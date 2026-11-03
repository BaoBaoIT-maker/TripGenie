const TIME_OF_DAY = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export const TIME_SCHEDULING_CONSTANTS = {
  MINUTES_PER_HOUR: 60,
  MIN_MINUTE_OF_DAY: 0,
  MAX_CLOCK_MINUTE_OF_DAY: 23 * 60 + 59, // 23:59
  DEFAULT_MAX_ACTIVITY_END_MINUTE: 23 * 60 + 45, // 23:45
  DEFAULT_TRANSIT_BUFFER_MINUTES: 15,
  DEFAULT_MIN_DURATION_MINUTES: 45,
  FALLBACK_START_MINUTE: 8 * 60 + 30, // 08:30
  FALLBACK_END_MINUTE: 10 * 60, // 10:00
} as const;

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
  const match = value ? TIME_OF_DAY.exec(value.trim()) : null;
  if (!match) return null;
  return new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2])));
}

/** Date from a @db.Time column -> "HH:mm", or null. */
export function formatTimeOfDay(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

/** Converts Date (@db.Time) or "HH:mm" string to minutes since 00:00, or null. */
export function timeToMinutes(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const str = value instanceof Date ? formatTimeOfDay(value) : value.trim();
  if (!str) return null;
  const match = TIME_OF_DAY.exec(str);
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
  const hours = Math.floor(clamped / TIME_SCHEDULING_CONSTANTS.MINUTES_PER_HOUR);
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
    options?.bufferMinutes ?? TIME_SCHEDULING_CONSTANTS.DEFAULT_TRANSIT_BUFFER_MINUTES;
  const minDuration =
    options?.minDurationMinutes ?? TIME_SCHEDULING_CONSTANTS.DEFAULT_MIN_DURATION_MINUTES;
  const maxMinute =
    options?.maxMinuteOfDay ?? TIME_SCHEDULING_CONSTANTS.DEFAULT_MAX_ACTIVITY_END_MINUTE;

  const baseStart =
    timeToMinutes(baseSlot.start) ?? TIME_SCHEDULING_CONSTANTS.FALLBACK_START_MINUTE;
  const baseEnd =
    timeToMinutes(baseSlot.end) ?? TIME_SCHEDULING_CONSTANTS.FALLBACK_END_MINUTE;
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

  let finalEnd = fittedEnd ?? Math.min(candidateStart + desiredDuration, maxMinute);
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

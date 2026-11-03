const TIME_OF_DAY = /^([01]?\d|2[0-3]):([0-5]\d)$/;

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

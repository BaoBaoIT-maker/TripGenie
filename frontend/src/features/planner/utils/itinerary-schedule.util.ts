import { Sunrise, Sun, Sunset, Moon } from "lucide-react";

export interface AddablePlace {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  areaName?: string | null;
  category?: string | null;
  coverImage?: string | null;
  primaryImage?: string | null;
}

export const COPILOT_TOOL_NAMES = {
  ADD_ACTIVITY: "add_activity",
  SWAP_ACTIVITY: "swap_activity",
  REMOVE_ACTIVITY: "remove_activity",
  MOVE_ACTIVITY: "move_activity",
  SWAP_DAYS: "swap_days",
} as const;

export const ITINERARY_SCHEDULE_CONSTANTS = {
  MINUTES_PER_HOUR: 60,
  MIN_MINUTE_OF_DAY: 0,
  MAX_CLOCK_MINUTE_OF_DAY: 23 * 60 + 59,
  MAX_ACTIVITY_END_MINUTE: 23 * 60 + 45,
  TRANSIT_BUFFER_MINUTES: 15,
  MIN_SLOT_DURATION_MINUTES: 45,
  FALLBACK_START_MINUTE: 8 * 60 + 30,
  FALLBACK_END_MINUTE: 10 * 60,
  DEFAULT_FALLBACK_LOCATION: "Việt Nam",
  PLANNER_ROUTE: "/planner",
  ITINERARY_DETAIL_ROUTE_PREFIX: "/itineraries",
  LOADING_SKELETON_COUNT: 3,
} as const;

export const ITINERARY_TIME_SLOTS = [
  {
    id: "Sáng",
    label: "Buổi sáng",
    start: "08:30",
    end: "10:00",
    timeRange: "08:30 – 10:00",
    icon: Sunrise,
  },
  {
    id: "Trưa",
    label: "Buổi trưa",
    start: "11:30",
    end: "13:00",
    timeRange: "11:30 – 13:00",
    icon: Sun,
  },
  {
    id: "Chiều",
    label: "Buổi chiều",
    start: "16:00",
    end: "17:30",
    timeRange: "16:00 – 17:30",
    icon: Sunset,
  },
  {
    id: "Tối",
    label: "Buổi tối",
    start: "18:30",
    end: "20:00",
    timeRange: "18:30 – 20:00",
    icon: Moon,
  },
] as const;

export type ItineraryTimeSlotId = (typeof ITINERARY_TIME_SLOTS)[number]["id"];

export const DEFAULT_TIME_SLOT_ID: ItineraryTimeSlotId = "Chiều";

export const TIME_SLOT_CATEGORY_RULES: ReadonlyArray<{
  slotId: ItineraryTimeSlotId;
  keywords: readonly string[];
}> = [
  { slotId: "Sáng", keywords: ["cafe", "ca-phe", "coffee", "an sang", "breakfast"] },
  { slotId: "Trưa", keywords: ["food", "nha-hang", "an-vat", "am thuc", "quan an"] },
  { slotId: "Tối", keywords: ["nightlife", "bar", "pub", "cho dem", "lounge"] },
] as const;

const HH_MM_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const ADMIN_PREFIX_REGEX = /^(tinh|thanh pho|tp\.?)\s+/i;

export function parseHhMmToMinutes(val?: string | null): number | null {
  if (!val) return null;
  const m = HH_MM_REGEX.exec(val.trim());
  if (!m) return null;
  return (
    Number(m[1]) * ITINERARY_SCHEDULE_CONSTANTS.MINUTES_PER_HOUR + Number(m[2])
  );
}

export function formatMinutesToHhMm(totalMinutes: number): string {
  const clamped = Math.max(
    ITINERARY_SCHEDULE_CONSTANTS.MIN_MINUTE_OF_DAY,
    Math.min(
      ITINERARY_SCHEDULE_CONSTANTS.MAX_CLOCK_MINUTE_OF_DAY,
      Math.round(totalMinutes)
    )
  );
  const h = Math.floor(clamped / ITINERARY_SCHEDULE_CONSTANTS.MINUTES_PER_HOUR);
  const m = clamped % ITINERARY_SCHEDULE_CONSTANTS.MINUTES_PER_HOUR;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function resolvePreviewTimeSlot(
  baseSlot: { start: string; end: string },
  existingActivities: Array<{ startTime?: string | null; endTime?: string | null }> = []
): { start: string; end: string; shifted: boolean } {
  const {
    MIN_SLOT_DURATION_MINUTES,
    MAX_ACTIVITY_END_MINUTE,
    TRANSIT_BUFFER_MINUTES,
    FALLBACK_START_MINUTE,
    FALLBACK_END_MINUTE,
    MIN_MINUTE_OF_DAY,
  } = ITINERARY_SCHEDULE_CONSTANTS;

  const baseStart = parseHhMmToMinutes(baseSlot.start) ?? FALLBACK_START_MINUTE;
  const baseEnd = parseHhMmToMinutes(baseSlot.end) ?? FALLBACK_END_MINUTE;
  const desiredDuration = Math.max(MIN_SLOT_DURATION_MINUTES, baseEnd - baseStart);

  const intervals = existingActivities
    .map((act) => {
      const s = parseHhMmToMinutes(act.startTime);
      const e = parseHhMmToMinutes(act.endTime);
      if (s === null || e === null || e <= s) return null;
      return { start: s, end: e };
    })
    .filter((x): x is { start: number; end: number } => x !== null)
    .sort((a, b) => a.start - b.start);

  let candidateStart = baseStart;
  let fittedEnd: number | null = null;

  for (const interval of intervals) {
    const candidateEnd = Math.min(
      candidateStart + desiredDuration,
      MAX_ACTIVITY_END_MINUTE
    );
    if (interval.end + TRANSIT_BUFFER_MINUTES <= candidateStart) continue;
    if (interval.start - TRANSIT_BUFFER_MINUTES >= candidateEnd) {
      fittedEnd = candidateEnd;
      break;
    }
    const availableEndBefore = interval.start - TRANSIT_BUFFER_MINUTES;
    if (availableEndBefore - candidateStart >= MIN_SLOT_DURATION_MINUTES) {
      fittedEnd = availableEndBefore;
      break;
    }
    candidateStart = Math.max(
      candidateStart,
      interval.end + TRANSIT_BUFFER_MINUTES
    );
  }

  let finalEnd =
    fittedEnd ??
    Math.min(candidateStart + desiredDuration, MAX_ACTIVITY_END_MINUTE);
  if (finalEnd <= candidateStart) {
    candidateStart = Math.max(
      MIN_MINUTE_OF_DAY,
      MAX_ACTIVITY_END_MINUTE - MIN_SLOT_DURATION_MINUTES
    );
    finalEnd = MAX_ACTIVITY_END_MINUTE;
  }

  const start = formatMinutesToHhMm(candidateStart);
  const end = formatMinutesToHhMm(finalEnd);
  return {
    start,
    end,
    shifted: start !== baseSlot.start || end !== baseSlot.end,
  };
}

export function normalizeViText(value?: string | null): string {
  if (!value || typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(ADMIN_PREFIX_REGEX, "")
    .trim();
}

export function isSameDestinationArea(
  itineraryDestination?: string | null,
  place?: AddablePlace | null
): boolean {
  if (!itineraryDestination || !place) return false;
  const normDest = normalizeViText(itineraryDestination);
  if (!normDest) return false;

  const candidates = [place.city, place.areaName, place.address]
    .map((v) => normalizeViText(v))
    .filter(Boolean);

  return candidates.some((c) => c.includes(normDest) || normDest.includes(c));
}

export function resolveDefaultTimeSlot(
  categoryOrPlace?: string | Pick<AddablePlace, "category"> | null
): ItineraryTimeSlotId {
  const rawCategory =
    typeof categoryOrPlace === "string"
      ? categoryOrPlace
      : categoryOrPlace?.category;
  const norm = normalizeViText(rawCategory);
  if (!norm) return DEFAULT_TIME_SLOT_ID;

  const matched = TIME_SLOT_CATEGORY_RULES.find((rule) =>
    rule.keywords.some((kw) => norm.includes(kw))
  );
  return matched ? matched.slotId : DEFAULT_TIME_SLOT_ID;
}

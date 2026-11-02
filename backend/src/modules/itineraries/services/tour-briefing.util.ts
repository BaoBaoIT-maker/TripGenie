/** Tour leader & assembly info a trip owner stores inside Itinerary.aiPreferences.tourBriefing. */
export interface TourBriefing {
  leaderName?: string | null;
  leaderPhone?: string | null;
  meetingPoint?: string | null;
  notes?: string | null;
}

const trimToNull = (value?: string | null): string | null => value?.trim() || null;

/** Trim every field; collapse to null when nothing is left so empty briefings are not stored. */
export function normalizeTourBriefing(input: TourBriefing): TourBriefing | null {
  const normalized: TourBriefing = {
    leaderName: trimToNull(input.leaderName),
    leaderPhone: trimToNull(input.leaderPhone),
    meetingPoint: trimToNull(input.meetingPoint),
    notes: trimToNull(input.notes),
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

/**
 * Only the owner and trip-group members may read the leader's phone and the notes.
 * Everyone else (public viewers, cloners) gets the briefing without those two fields.
 */
export function redactTourBriefing(
  briefing: TourBriefing | null | undefined,
  canViewPrivateFields: boolean,
): TourBriefing | null {
  if (!briefing) return null;
  if (canViewPrivateFields) return briefing;
  return normalizeTourBriefing({ ...briefing, leaderPhone: null, notes: null });
}

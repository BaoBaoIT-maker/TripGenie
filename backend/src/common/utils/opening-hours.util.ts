/**
 * Evaluates whether a place is currently open from its free-form `opening_hours` value.
 * Supports "24/7", "HH:MM-HH:MM" (incl. overnight windows, Vietnam time UTC+7)
 * and objects carrying a boolean `openNow` / `is_open`. Returns null when unknown.
 */
export function checkIsOpenNow(openingHours: unknown): boolean | null {
  if (!openingHours) return null;

  if (typeof openingHours === 'string') {
    const trimmed = openingHours.trim().toLowerCase();
    if (trimmed === '24/7') return true;

    const m = trimmed.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) return null;

    const now = new Date();
    const current = ((now.getUTCHours() + 7) % 24) * 60 + now.getUTCMinutes();
    const start = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const end = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);

    // Overnight window (e.g., 18:00 - 02:00) wraps past midnight
    return end >= start ? current >= start && current <= end : current >= start || current <= end;
  }

  if (typeof openingHours === 'object') {
    const o = openingHours as Record<string, unknown>;
    if (typeof o.openNow === 'boolean') return o.openNow;
    if (typeof o.is_open === 'boolean') return o.is_open;
  }

  return null;
}

import type { TourBriefing } from '@/types/itinerary';

// ponytail: client-side input caps mirror TOUR_BRIEFING_LIMITS in backend/src/modules/itineraries/dto/generate-itinerary.dto.ts; if shared monorepo package is introduced later, import from single schema.
export const TOUR_BRIEFING_UI_CONSTANTS = {
  MAX_LEADER_NAME_LENGTH: 100,
  MAX_LEADER_PHONE_LENGTH: 30,
  MAX_MEETING_POINT_LENGTH: 250,
  MAX_NOTES_LENGTH: 600,
  SHORT_CODE_PREFIX: 'TG',
  SHORT_CODE_LENGTH: 6,
  HANDWRITING_NOTES_LINES: 3,
  TRAVEL_MODE_LABELS: {
    WALK: 'Đi bộ',
    BIKE: 'Xe máy',
    CAR: 'Ô tô / Taxi',
  } as Record<string, string>,
} as const;

export interface PrintSheetOptions {
  showChecklist: boolean;
  showCostTable: boolean;
  blankHandwritingMode: boolean;
  pageBreakPerDay: boolean;
}

export const DEFAULT_PRINT_SHEET_OPTIONS: PrintSheetOptions = {
  showChecklist: true,
  showCostTable: true,
  blankHandwritingMode: false,
  pageBreakPerDay: false,
};

export function formatVnd(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return '—';
  }
  if (amount === 0) {
    return 'Miễn phí';
  }
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}

export function formatDayDateLabel(startDate: string | null, dayOffset: number): string {
  if (!startDate) return '';
  const base = new Date(startDate);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + dayOffset);
  return base.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateRangeVi(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return 'Linh hoạt';
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} – ${endDate}`;
  }
  return `${start.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`;
}

/** Stable empty reference so derived draft state does not change identity every render. */
export const EMPTY_TOUR_BRIEFING: TourBriefing = {};

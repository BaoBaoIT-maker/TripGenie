import { PACE_OPTIONS } from './config/itinerary-wizard-options';

/** Shared display labels for itinerary budget levels (single source for web view and A4 print sheet). */
export const BUDGET_LABEL: Record<string, string> = {
  LOW: 'Tiết kiệm',
  MEDIUM: 'Tiêu chuẩn',
  HIGH: 'Cao cấp',
  LUXURY: 'Hạng sang',
};

/** Shared display labels for travel pace derived from PACE_OPTIONS (single source across Wizard and detail view). */
export const PACE_LABEL: Record<string, string> = Object.fromEntries(
  PACE_OPTIONS.map((opt) => [opt.value, opt.label]),
);

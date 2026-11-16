import { describe, it, expect } from 'vitest';
import { formatDateVi, formatTripDates } from '@/features/planner/model/itinerary-format';

describe('itinerary-format date helpers', () => {
  describe('formatDateVi', () => {
    it('returns empty string for null, undefined or empty input', () => {
      expect(formatDateVi(null)).toBe('');
      expect(formatDateVi(undefined)).toBe('');
      expect(formatDateVi('')).toBe('');
    });

    it('formats ISO 8601 timestamps without timestamp artifact', () => {
      expect(formatDateVi('2026-10-28T00:00:00.000Z')).toBe('28/10/2026');
      expect(formatDateVi('2026-05-09T14:30:00+07:00')).toBe('09/05/2026');
    });

    it('formats standard YYYY-MM-DD date strings', () => {
      expect(formatDateVi('2026-10-28')).toBe('28/10/2026');
      expect(formatDateVi('2026-1-5')).toBe('05/01/2026');
    });

    it('preserves or normalizes already formatted DD/MM/YYYY dates', () => {
      expect(formatDateVi('28/10/2026')).toBe('28/10/2026');
      expect(formatDateVi('5/1/2026')).toBe('05/01/2026');
    });
  });

  describe('formatTripDates', () => {
    it('returns "Chưa định ngày" when start is missing', () => {
      expect(formatTripDates(null, null)).toBe('Chưa định ngày');
      expect(formatTripDates(undefined, '2026-10-28')).toBe('Chưa định ngày');
    });

    it('formats a date range when start and end differ', () => {
      expect(
        formatTripDates('2026-10-28T00:00:00.000Z', '2026-10-30T00:00:00.000Z')
      ).toBe('28/10/2026 – 30/10/2026');
    });

    it('returns a single date when start and end are on the same day', () => {
      expect(
        formatTripDates('2026-10-28T00:00:00.000Z', '2026-10-28T12:00:00.000Z')
      ).toBe('28/10/2026');
      expect(formatTripDates('2026-10-28', null)).toBe('28/10/2026');
    });
  });
});

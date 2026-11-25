import { describe, it, expect } from 'vitest';
import {
  calculateTripDays,
  formatDateVi,
  formatTripDates,
  formatWeekdayShort,
  getMaxTripEndDate,
  normalizeTripDateRange,
} from '@/features/planner/model/itinerary-format';

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

  describe('trip date range helpers', () => {
    it('calculates inclusive calendar days and rejects invalid/reversed ranges', () => {
      expect(calculateTripDays('2026-11-25', '2026-11-25')).toBe(1);
      expect(calculateTripDays('2026-11-25', '2026-11-27')).toBe(3);
      expect(calculateTripDays('2026-11-28', '2026-12-02')).toBe(5);
      expect(calculateTripDays('2026-11-27', '2026-11-25')).toBeNull();
      expect(calculateTripDays('', '2026-11-27')).toBeNull();
      expect(calculateTripDays('2026-02-31', '2026-03-02')).toBeNull();
    });

    it('computes inclusive max end date across month boundaries', () => {
      expect(getMaxTripEndDate('2026-11-28', 7)).toBe('2026-12-04');
      expect(getMaxTripEndDate('', 7)).toBeUndefined();
    });

    it('normalizes reversed, over-limit, and cleared date ranges safely', () => {
      expect(normalizeTripDateRange('', '2026-11-27', 7)).toBeNull();
      expect(normalizeTripDateRange('2026-11-25', '', 7)).toBeNull();
      expect(normalizeTripDateRange('2026-11-28', '2026-11-25', 7)).toEqual({
        startDate: '2026-11-28',
        endDate: '2026-11-28',
        clamped: false,
      });
      expect(normalizeTripDateRange('2026-11-25', '2026-12-10', 7)).toEqual({
        startDate: '2026-11-25',
        endDate: '2026-12-01',
        clamped: true,
      });
      expect(normalizeTripDateRange('2026-11-25', '2026-11-29', 7)).toEqual({
        startDate: '2026-11-25',
        endDate: '2026-11-29',
        clamped: false,
      });
    });

    it('formats short weekday labels in Vietnamese and English', () => {
      expect(formatWeekdayShort('2026-11-25', 'vi')).toBe('Thứ 4');
      expect(formatWeekdayShort('2026-11-25', 'en')).toBe('Wed');
      expect(formatWeekdayShort('', 'vi')).toBe('');
    });
  });
});

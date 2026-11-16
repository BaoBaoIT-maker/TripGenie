import { describe, expect, it } from 'vitest';
import { getItineraryWeather } from '@/features/planner/services/weather.service';

describe('getItineraryWeather', () => {
  it('resolves Đà Nẵng in summer (June) as SUNNY with amber visual theme', () => {
    const result = getItineraryWeather('Đà Nẵng • Phố cổ Hội An', '2026-06-18');
    expect(result.temperature).toBe(33);
    expect(result.condition).toBe('SUNNY');
    expect(result.label).toContain('Nắng hè rực rỡ');
    expect(result.badgeClass).toContain('amber');
    expect(result.heroBadgeClass).toContain('amber');
    expect(result.iconUrl).toContain('SunnyDayV3.svg');
  });

  it('resolves Đà Lạt in December as COLD with indigo visual theme', () => {
    const result = getItineraryWeather('Đà Lạt, Lâm Đồng', '2026-12-24');
    expect(result.temperature).toBe(15);
    expect(result.condition).toBe('COLD');
    expect(result.label).toContain('Rét đậm');
    expect(result.badgeClass).toContain('indigo');
    expect(result.heroBadgeClass).toContain('indigo');
  });

  it('resolves Phú Quốc in August as RAINY with blue visual theme', () => {
    const result = getItineraryWeather('Phú Quốc', '2026-08-28');
    expect(result.temperature).toBe(29);
    expect(result.condition).toBe('RAINY');
    expect(result.label).toContain('Mưa rào nhiệt đới');
    expect(result.badgeClass).toContain('blue');
    expect(result.heroBadgeClass).toContain('blue');
  });

  it('falls back gracefully to baseline climate when destination is unknown', () => {
    const result = getItineraryWeather('Địa điểm chưa biết', '2026-07-01');
    expect(result.temperature).toBeGreaterThan(0);
    expect(result.label).toBeTruthy();
    expect(result.icon).toBeTruthy();
  });

  it('handles null and undefined dates gracefully', () => {
    const result = getItineraryWeather('Hà Nội', null);
    expect(result.temperature).toBeGreaterThan(0);
    expect(result.label).toBeTruthy();
  });
});

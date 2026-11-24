import * as React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ERROR_CODES } from '@/types/error-codes';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_METADATA,
  getActiveClientLocale,
  parseLocale,
} from '@/i18n/config';
import {
  MESSAGES,
  getPlaceCategoryLabel,
  getPlaceCityLabel,
  getPlaceDescription,
  getPlaceOpenStatusText,
  getPlacePriceRangeText,
  pickLocalizedName,
  translate,
  translateApiError,
} from '@/i18n';
import { LocaleProvider, useI18n } from '@/i18n/LocaleProvider';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { createLoginSchema } from '@/features/auth/schemas/auth.schema';
import { formatTripDuration } from '@/services/community.service';
import { formatDuration, formatTripDates } from '@/features/planner/model/itinerary-format';
import { getItineraryWeather } from '@/features/planner/services/weather.service';
import { getDayWeatherAdvice } from '@/features/planner/constants/climate.constants';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return flattenKeys(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, seg) => {
    if (acc && typeof acc === 'object' && seg in acc) {
      return (acc as Record<string, unknown>)[seg];
    }
    return undefined;
  }, obj);
}

describe('i18n dictionaries & helpers', () => {
  it('enforces 100% key parity and non-empty strings between vi and en JSON', () => {
    const viKeys = flattenKeys(MESSAGES.vi as unknown as Record<string, unknown>).sort();
    const enKeys = flattenKeys(MESSAGES.en as unknown as Record<string, unknown>).sort();

    expect(enKeys).toEqual(viKeys);

    for (const key of viKeys) {
      const viVal = getByPath(MESSAGES.vi as unknown as Record<string, unknown>, key);
      const enVal = getByPath(MESSAGES.en as unknown as Record<string, unknown>, key);
      expect(typeof viVal).toBe('string');
      expect(typeof enVal).toBe('string');
      expect((viVal as string).trim().length).toBeGreaterThan(0);
      expect((enVal as string).trim().length).toBeGreaterThan(0);
    }
  });

  it('covers every canonical ERROR_CODES entry in both vi and en', () => {
    const viErrors = MESSAGES.vi.errors as Record<string, string>;
    const enErrors = MESSAGES.en.errors as Record<string, string>;

    for (const code of Object.values(ERROR_CODES)) {
      expect(viErrors[code]).toBeTruthy();
      expect(enErrors[code]).toBeTruthy();
    }
  });

  it('parses locale cookie and Accept-Language values safely', () => {
    expect(parseLocale('en')).toBe('en');
    expect(parseLocale('en-US,en;q=0.9')).toBe('en');
    expect(parseLocale('vi-VN')).toBe('vi');
    expect(parseLocale('fr-FR')).toBe(DEFAULT_LOCALE);
    expect(parseLocale(null)).toBe(DEFAULT_LOCALE);
    expect(parseLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it('picks localized DB entity names and render-time place labels with safe fallback', () => {
    const area = { name: 'Da Nang City', nameVi: 'Thành phố Đà Nẵng' };
    expect(pickLocalizedName(area, 'vi')).toBe('Thành phố Đà Nẵng');
    expect(pickLocalizedName(area, 'en')).toBe('Da Nang City');
    expect(pickLocalizedName({ name: 'Hoi An', nameVi: null }, 'vi')).toBe('Hoi An');
    expect(pickLocalizedName({ name: null, nameVi: 'Hội An' }, 'en')).toBe('Hội An');
    expect(pickLocalizedName(null, 'en', 'Unknown')).toBe('Unknown');

    const place = {
      categoryName: 'Cafe & Dessert',
      categoryNameVi: 'Cà phê & Tráng miệng',
      areaName: 'Da Nang City',
      areaNameVi: 'Thành phố Đà Nẵng',
    };
    expect(getPlaceCategoryLabel(place, 'vi')).toBe('Cà phê & Tráng miệng');
    expect(getPlaceCategoryLabel(place, 'en')).toBe('Cafe & Dessert');
    expect(getPlaceCityLabel(place, 'vi')).toBe('Thành phố Đà Nẵng');
    expect(getPlaceCityLabel(place, 'en')).toBe('Da Nang City');
    expect(getPlacePriceRangeText(1, 'en')).toBe(MESSAGES.en.place.priceLow);
    expect(getPlaceOpenStatusText(true, 'en')).toBe(MESSAGES.en.place.openNow);
    expect(getPlaceOpenStatusText(false, 'vi')).toBe(MESSAGES.vi.place.closed);
  });

  it('builds locale-aware Auth Zod schemas', () => {
    const viResult = createLoginSchema('vi').safeParse({ identifier: '', password: '' });
    const enResult = createLoginSchema('en').safeParse({ identifier: '', password: '' });
    expect(viResult.success).toBe(false);
    expect(enResult.success).toBe(false);
    if (!viResult.success && !enResult.success) {
      expect(viResult.error.issues[0].message).toBe(MESSAGES.vi.auth.validation.identifierRequired);
      expect(enResult.error.issues[0].message).toBe(MESSAGES.en.auth.validation.identifierRequired);
    }
  });

  it('translates domain ERROR_CODES while preserving specific vi messages and shielding en users from Vietnamese leaks', () => {
    expect(
      translateApiError(
        { code: ERROR_CODES.EMAIL_NOT_VERIFIED, message: 'Chưa xác thực email' },
        'en',
      ),
    ).toBe(MESSAGES.en.errors.EMAIL_NOT_VERIFIED);

    expect(
      translateApiError(
        { code: ERROR_CODES.CONFLICT, message: 'Email đã được đăng ký.' },
        'vi',
      ),
    ).toBe('Email đã được đăng ký.');

    expect(
      translateApiError(
        { code: ERROR_CODES.CONFLICT, message: 'Email đã được đăng ký.' },
        'en',
      ),
    ).toBe(MESSAGES.en.errors.CONFLICT);

    expect(
      translateApiError(
        { code: ERROR_CODES.BAD_REQUEST, message: 'Invalid date range.' },
        'en',
      ),
    ).toBe('Invalid date range.');
  });

  it('returns localized string from translate()', () => {
    expect(translate('vi', 'nav.explore')).toBe('Khám phá');
    expect(translate('en', 'nav.explore')).toBe('Explore');
  });

  it('resolves place descriptions via attributes.descriptionEn with safe fallbacks', () => {
    const placeWithEn = {
      name: 'Cầu Rồng',
      description: 'Cây cầu biểu tượng tại Đà Nẵng',
      attributes: { descriptionEn: 'Iconic dragon-shaped bridge in Da Nang.' },
    };
    expect(getPlaceDescription(placeWithEn, 'vi')).toBe('Cây cầu biểu tượng tại Đà Nẵng');
    expect(getPlaceDescription(placeWithEn, 'en')).toBe('Iconic dragon-shaped bridge in Da Nang.');

    const placeRawOnly = {
      name: 'Chợ Hàn',
      description: 'Chợ truyền thống nổi tiếng.',
    };
    expect(getPlaceDescription(placeRawOnly, 'en')).toBe('Chợ truyền thống nổi tiếng.');

    const placeEmptyDesc = {
      name: 'My Khe Beach',
      categoryName: 'Beach',
      categoryNameVi: 'Bãi biển',
      areaName: 'Da Nang',
      areaNameVi: 'Đà Nẵng',
    };
    expect(getPlaceDescription(placeEmptyDesc, 'en')).toContain('My Khe Beach');
    expect(getPlaceDescription(placeEmptyDesc, 'en')).toContain('Beach');
    expect(getPlaceDescription(placeEmptyDesc, 'vi')).toContain('Bãi biển');
  });

  it('formats trip durations, itinerary durations, dates, and seasonal weather per locale', () => {
    expect(formatTripDuration('2026-10-01', '2026-10-03', true, 'vi')).toBe('3N2Đ');
    expect(formatTripDuration('2026-10-01', '2026-10-03', true, 'en')).toBe('3D2N');
    expect(formatTripDuration('2026-10-01', '2026-10-03', false, 'vi')).toBe('3 Ngày 2 Đêm');
    expect(formatTripDuration('2026-10-01', '2026-10-03', false, 'en')).toBe('3 Days 2 Nights');

    expect(formatDuration(90, 'vi')).toBe('1 giờ 30 phút');
    expect(formatDuration(90, 'en')).toBe('1h 30m');
    expect(formatDuration(45, 'en')).toBe('45 min');

    expect(formatTripDates('2026-10-28', '2026-10-30', 'vi')).toBe('28/10/2026 – 30/10/2026');
    expect(formatTripDates('2026-10-28', '2026-10-30', 'en')).toContain('Oct 28, 2026');
    expect(formatTripDates(null, null, 'en')).toBe('Dates TBD');

    const weatherVi = getItineraryWeather('Đà Nẵng', '2026-06-15', 'vi');
    const weatherEn = getItineraryWeather('Đà Nẵng', '2026-06-15', 'en');
    expect(weatherVi.temperature).toBe(weatherEn.temperature);
    expect(weatherEn.label).not.toMatch(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i);

    const rainyAdviceEn = getDayWeatherAdvice({
      tempMin: 22,
      tempMax: 27,
      condition: 'RAINY',
      precipitationProb: 75,
    }, 'en');
    const rainyAdviceVi = getDayWeatherAdvice({
      tempMin: 22,
      tempMax: 27,
      condition: 'RAINY',
      precipitationProb: 75,
    }, 'vi');
    expect(rainyAdviceEn.advice.toLowerCase()).toContain('rain');
    expect(rainyAdviceVi.advice.toLowerCase()).toContain('mưa');
  });
});

function SwitcherHarness() {
  const { locale, t } = useI18n();
  return (
    <div>
      <span data-testid="active-locale">{locale}</span>
      <span data-testid="nav-label">{t('nav.explore')}</span>
      <LanguageSwitcher variant="mobile" />
    </div>
  );
}

describe('LocaleProvider & LanguageSwitcher Dropdown', () => {
  beforeEach(() => {
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
    document.documentElement.lang = 'vi';
  });

  it('opens dropdown, switches locale instantaneously, updates document.lang and persists cookie', () => {
    render(
      <LocaleProvider initialLocale="vi">
        <SwitcherHarness />
      </LocaleProvider>,
    );

    expect(screen.getByTestId('active-locale').textContent).toBe('vi');
    expect(screen.getByTestId('nav-label').textContent).toBe('Khám phá');

    // Open dropdown trigger showing Vietnamese display label
    const trigger = screen.getByRole('button', {
      name: MESSAGES.vi.common.languageSwitcherLabel,
    });
    expect(trigger.textContent).toContain(LOCALE_METADATA.vi.displayLabel);
    fireEvent.click(trigger);

    // Select English option from dropdown
    const enOption = screen.getByText(LOCALE_METADATA.en.displayLabel);
    fireEvent.click(enOption);

    expect(screen.getByTestId('active-locale').textContent).toBe('en');
    expect(screen.getByTestId('nav-label').textContent).toBe('Explore');
    expect(document.documentElement.lang).toBe('en');
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=en`);
    expect(getActiveClientLocale()).toBe('en');
  });
});

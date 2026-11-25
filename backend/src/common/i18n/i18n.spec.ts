import {
  DEFAULT_LOCALE,
  parseLocale,
  parseTranslationsMap,
  resolveLocalizedText,
} from './locale.util';
import { BACKEND_MESSAGES, t } from './t.util';
import {
  formatDuration,
  getHubDisplayName,
  type TransitHubDto,
} from '../../modules/itineraries/services/transit/transit.types';
import {
  getAdvisorFallbackMessages,
  getAdvisorSystemPrompt,
  getFormattedCurrentTemporalContext,
} from '../../modules/advisor/advisor.constants';
import {
  WeatherCondition,
  WeatherSource,
  buildWeatherGuidance,
  resolveWmoWeather,
} from '../../modules/weather/weather.constants';

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

const VIETNAMESE_DIACRITICS =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

describe('Backend i18n (parseLocale, t(), dictionaries, prompts & weather)', () => {
  it('parses Accept-Language headers safely with vi fallback', () => {
    expect(parseLocale('en')).toBe('en');
    expect(parseLocale('en-US,en;q=0.9')).toBe('en');
    expect(parseLocale(['en-GB', 'vi'])).toBe('en');
    expect(parseLocale('vi-VN,vi;q=0.9')).toBe('vi');
    expect(parseLocale('fr-FR')).toBe(DEFAULT_LOCALE);
    expect(parseLocale(null)).toBe(DEFAULT_LOCALE);
    expect(parseLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it('enforces 100% key parity and non-empty strings between backend vi.json and en.json', () => {
    const viKeys = flattenKeys(
      BACKEND_MESSAGES.vi as unknown as Record<string, unknown>,
    ).sort();
    const enKeys = flattenKeys(
      BACKEND_MESSAGES.en as unknown as Record<string, unknown>,
    ).sort();

    expect(enKeys).toEqual(viKeys);
    for (const key of viKeys) {
      const viVal = getByPath(
        BACKEND_MESSAGES.vi as unknown as Record<string, unknown>,
        key,
      );
      const enVal = getByPath(
        BACKEND_MESSAGES.en as unknown as Record<string, unknown>,
        key,
      );
      expect(typeof viVal).toBe('string');
      expect(typeof enVal).toBe('string');
      expect((viVal as string).trim().length).toBeGreaterThan(0);
      expect((enVal as string).trim().length).toBeGreaterThan(0);
    }
  });

  it('interpolates parameters via t() for both vi and en', () => {
    expect(t('vi', 'mail.otp.resetSubject', { otp: '123456' })).toBe(
      '[TripGenie] Mã OTP đặt lại mật khẩu: 123456',
    );
    expect(t('en', 'mail.otp.resetSubject', { otp: '123456' })).toBe(
      '[TripGenie] Password Reset OTP: 123456',
    );
    expect(
      t('en', 'copilot.proposals.swapDaysRange', { dayA: 1, dayB: 3 }),
    ).toBe('Swap Day 1 and Day 3');
    expect(getAdvisorFallbackMessages('en').NETWORK_ERROR).not.toMatch(
      VIETNAMESE_DIACRITICS,
    );
  });

  it('builds English production Advisor system prompt with locale-specific Tone Anchor', () => {
    const viCtx = getFormattedCurrentTemporalContext(
      new Date('2026-11-24T00:00:00Z'),
      'vi',
    );
    const enCtx = getFormattedCurrentTemporalContext(
      new Date('2026-11-24T00:00:00Z'),
      'en',
    );
    expect(enCtx.currentDate).toBe('2026-11-24');

    const promptEn = getAdvisorSystemPrompt(
      enCtx.currentDate,
      enCtx.dayOfWeek,
      null,
      'en',
    );
    const promptVi = getAdvisorSystemPrompt(
      viCtx.currentDate,
      viCtx.dayOfWeek,
      null,
      'vi',
    );

    expect(promptEn).toContain('STRICT DOMAIN GUARDRAIL');
    expect(promptEn).toContain('OUTPUT LANGUAGE & TONE (UI Locale = English)');
    expect(promptVi).toContain(
      'OUTPUT LANGUAGE & TONE (UI Locale = Vietnamese)',
    );
  });

  it('builds localized weather labels and guidance with zero Vietnamese bleed in en mode', () => {
    const wmo = resolveWmoWeather(61, 26);
    expect(wmo.labelVi).toBeTruthy();
    expect(wmo.labelEn).toBe('Light rain');

    const sampleDays = [
      {
        dayNumber: 1,
        date: '2026-11-24',
        source: WeatherSource.FORECAST,
        isForecast: true,
        condition: WeatherCondition.RAINY,
        labelVi: wmo.labelVi,
        labelEn: wmo.labelEn,
        tempMinC: 22,
        tempMaxC: 27,
        tempAvgC: 25,
        precipitationProbabilityMax: 75,
        uvIndexMax: 5,
        weatherCode: 61,
      },
    ];

    const guidanceEn = buildWeatherGuidance(sampleDays, 'en');
    const guidanceVi = buildWeatherGuidance(sampleDays, 'vi');

    expect(guidanceEn).toContain('DAILY WEATHER AT DESTINATION:');
    expect(guidanceEn).toContain('Light rain');
    expect(guidanceEn).not.toMatch(VIETNAMESE_DIACRITICS);
    expect(guidanceVi).toContain('THỜI TIẾT TỪNG NGÀY TẠI ĐIỂM ĐẾN:');
  });

  it('extracts valid translations maps via parseTranslationsMap and rejects invalid inputs', () => {
    expect(
      parseTranslationsMap({ en: '  Da Nang  ', vi: 'Đà Nẵng', blank: '   ', num: 123 }),
    ).toEqual({ en: 'Da Nang', vi: 'Đà Nẵng' });
    expect(parseTranslationsMap(null)).toBeNull();
    expect(parseTranslationsMap(undefined)).toBeNull();
    expect(parseTranslationsMap(['en', 'vi'])).toBeNull();
    expect(parseTranslationsMap('Da Nang')).toBeNull();
    expect(parseTranslationsMap({ en: '   ' })).toBeNull();
  });

  it('resolves localized labels cleanly with exact match, en fallback, and base fallback', () => {
    const translations = { en: 'Da Nang', vi: 'Đà Nẵng' };
    expect(resolveLocalizedText('Fallback', translations, 'en')).toBe('Da Nang');
    expect(resolveLocalizedText('Fallback', translations, 'vi')).toBe('Đà Nẵng');
    expect(resolveLocalizedText('Da Nang', { en: 'Da Nang' }, 'vi')).toBe('Da Nang');
    expect(resolveLocalizedText('Sân bay Đà Nẵng', null, 'en')).toBe('Sân bay Đà Nẵng');
    expect(resolveLocalizedText('Sân bay Đà Nẵng', { fr: 'Da Nang FR' }, 'en')).toBe(
      'Sân bay Đà Nẵng',
    );
  });

  it('resolves transit hub display names and handles null/missing hubs safely', () => {
    const hub: TransitHubDto = {
      id: 'DAD',
      name: 'Sân bay Quốc tế Đà Nẵng',
      translations: {
        en: 'Da Nang International Airport',
        vi: 'Sân bay Quốc tế Đà Nẵng',
      },
      hubType: 'AIRPORT',
      latitude: 16.0439,
      longitude: 108.199,
      areaId: 48,
    };

    expect(getHubDisplayName(hub, 'en')).toBe('Da Nang International Airport');
    expect(getHubDisplayName(hub, 'vi')).toBe('Sân bay Quốc tế Đà Nẵng');
    expect(getHubDisplayName({ ...hub, translations: null }, 'en')).toBe(
      'Sân bay Quốc tế Đà Nẵng',
    );
    expect(getHubDisplayName(null, 'en')).toBeNull();
    expect(getHubDisplayName(undefined, 'vi')).toBeNull();
  });

  it('formats durations cleanly in both vi and en locales', () => {
    expect(formatDuration(80, false, 'vi')).toBe('1h20p');
    expect(formatDuration(80, false, 'en')).toBe('1h 20m');
    expect(formatDuration(25, false, 'vi')).toBe('25 phút');
    expect(formatDuration(25, false, 'en')).toBe('25 min');
    expect(formatDuration(120, false, 'vi')).toBe('2 tiếng');
    expect(formatDuration(120, true, 'vi')).toBe('2h');
    expect(formatDuration(120, false, 'en')).toBe('2 hr');
    expect(formatDuration(120, true, 'en')).toBe('2h');
  });
});

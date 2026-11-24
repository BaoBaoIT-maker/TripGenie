import { DEFAULT_LOCALE, parseLocale } from './locale.util';
import { BACKEND_MESSAGES, t } from './t.util';
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
});

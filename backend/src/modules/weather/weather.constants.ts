import { AppLocale, DEFAULT_LOCALE } from '../../common/i18n/locale.util';
import { t } from '../../common/i18n/t.util';

export enum WeatherSource {
  FORECAST = 'FORECAST',
  SEASONAL_AVERAGE = 'SEASONAL_AVERAGE',
}

export enum WeatherCondition {
  SUNNY = 'SUNNY',
  MILD = 'MILD',
  RAINY = 'RAINY',
  COLD = 'COLD',
}

export const WEATHER_THRESHOLDS = {
  RAIN_PROB_HIGH: 60,
  HEAT_TEMP_C: 35,
  COLD_TEMP_C: 18,
  UV_HIGH: 8,
  SEASONAL_TEMP_SWING_C: 3,
  VN_UTC_OFFSET_MS: 7 * 3_600_000,
  MS_PER_DAY: 86_400_000,
  MIN_LAT: -90,
  MAX_LAT: 90,
  MIN_LNG: -180,
  MAX_LNG: 180,
  DEFAULT_SEASONAL_RAIN_PROB: {
    RAINY: 70,
    MILD: 25,
    SUNNY: 15,
    COLD: 20,
  } as Record<WeatherCondition, number>,
} as const;

export interface WmoWeatherDescriptor {
  condition: WeatherCondition;
  labelVi: string;
  labelEn: string;
}

/**
 * WMO Weather Interpretation Codes (WW) used by Open-Meteo daily.weather_code.
 */
export const WMO_WEATHER_MAP: Record<number, WmoWeatherDescriptor> = {
  0: { condition: WeatherCondition.SUNNY, labelVi: 'Trời quang nắng đẹp', labelEn: 'Clear & sunny' },
  1: { condition: WeatherCondition.SUNNY, labelVi: 'Ít mây, nắng ráo', labelEn: 'Mostly clear' },
  2: { condition: WeatherCondition.MILD, labelVi: 'Có mây rải rác', labelEn: 'Partly cloudy' },
  3: { condition: WeatherCondition.MILD, labelVi: 'Nhiều mây, dịu mát', labelEn: 'Overcast & mild' },
  45: { condition: WeatherCondition.MILD, labelVi: 'Có sương mù nhẹ', labelEn: 'Light fog' },
  48: { condition: WeatherCondition.COLD, labelVi: 'Sương mù ẩm lạnh', labelEn: 'Cold mist' },
  51: { condition: WeatherCondition.RAINY, labelVi: 'Mưa phùn nhẹ', labelEn: 'Light drizzle' },
  53: { condition: WeatherCondition.RAINY, labelVi: 'Mưa phùn vừa', labelEn: 'Moderate drizzle' },
  55: { condition: WeatherCondition.RAINY, labelVi: 'Mưa phùn dày', labelEn: 'Dense drizzle' },
  56: { condition: WeatherCondition.COLD, labelVi: 'Mưa phùn lạnh', labelEn: 'Freezing drizzle' },
  57: { condition: WeatherCondition.COLD, labelVi: 'Mưa phùn giá rét', labelEn: 'Heavy freezing drizzle' },
  61: { condition: WeatherCondition.RAINY, labelVi: 'Mưa nhỏ rải rác', labelEn: 'Light rain' },
  63: { condition: WeatherCondition.RAINY, labelVi: 'Mưa vừa', labelEn: 'Moderate rain' },
  65: { condition: WeatherCondition.RAINY, labelVi: 'Mưa to', labelEn: 'Heavy rain' },
  66: { condition: WeatherCondition.RAINY, labelVi: 'Mưa lạnh nhẹ', labelEn: 'Light freezing rain' },
  67: { condition: WeatherCondition.RAINY, labelVi: 'Mưa lạnh nặng hạt', labelEn: 'Heavy freezing rain' },
  71: { condition: WeatherCondition.COLD, labelVi: 'Tuyết nhẹ / Rét đậm', labelEn: 'Light snow / Very cold' },
  73: { condition: WeatherCondition.COLD, labelVi: 'Tuyết vừa / Rét đậm', labelEn: 'Moderate snow / Very cold' },
  75: { condition: WeatherCondition.COLD, labelVi: 'Tuyết dày / Rét buốt', labelEn: 'Heavy snow / Freezing' },
  77: { condition: WeatherCondition.COLD, labelVi: 'Mưa tuyết / Rét', labelEn: 'Snow grains / Cold' },
  80: { condition: WeatherCondition.RAINY, labelVi: 'Mưa rào nhẹ', labelEn: 'Light rain showers' },
  81: { condition: WeatherCondition.RAINY, labelVi: 'Mưa rào vừa', labelEn: 'Moderate rain showers' },
  82: { condition: WeatherCondition.RAINY, labelVi: 'Mưa rào rất to', labelEn: 'Heavy rain showers' },
  85: { condition: WeatherCondition.COLD, labelVi: 'Mưa tuyết rải rác', labelEn: 'Light snow showers' },
  86: { condition: WeatherCondition.COLD, labelVi: 'Mưa tuyết dày', labelEn: 'Heavy snow showers' },
  95: { condition: WeatherCondition.RAINY, labelVi: 'Dông sét', labelEn: 'Thunderstorm' },
  96: { condition: WeatherCondition.RAINY, labelVi: 'Mưa dông kèm mưa đá nhẹ', labelEn: 'Thunderstorm with light hail' },
  99: { condition: WeatherCondition.RAINY, labelVi: 'Mưa dông mạnh', labelEn: 'Severe thunderstorm' },
};

export const CONDITION_FALLBACK_LABEL_EN: Record<WeatherCondition, string> = {
  [WeatherCondition.SUNNY]: 'Sunny & pleasant',
  [WeatherCondition.MILD]: 'Mild & pleasant',
  [WeatherCondition.RAINY]: 'Rain showers expected',
  [WeatherCondition.COLD]: 'Cool & chilly',
};

export function resolveWmoWeather(
  code: number | null | undefined,
  tempAvgC?: number | null,
): WmoWeatherDescriptor {
  const mapped =
    code != null && WMO_WEATHER_MAP[code]
      ? WMO_WEATHER_MAP[code]
      : {
          condition: WeatherCondition.MILD,
          labelVi: 'Thời tiết ôn hòa',
          labelEn: 'Mild weather',
        };

  if (
    tempAvgC != null &&
    tempAvgC <= WEATHER_THRESHOLDS.COLD_TEMP_C &&
    mapped.condition !== WeatherCondition.RAINY
  ) {
    return {
      condition: WeatherCondition.COLD,
      labelVi: mapped.labelVi,
      labelEn: mapped.labelEn,
    };
  }
  return mapped;
}

export interface DayWeather {
  dayNumber: number;
  date: string | null;
  source: WeatherSource;
  isForecast: boolean;
  condition: WeatherCondition;
  labelVi: string;
  labelEn?: string;
  tempMinC: number;
  tempMaxC: number;
  tempAvgC: number;
  precipitationProbabilityMax: number | null;
  uvIndexMax: number | null;
  weatherCode: number | null;
  degradedFromForecast?: boolean;
}

export interface TripWeatherResponse {
  destination: string | null;
  coordinates: { lat: number; lng: number } | null;
  timezone: string;
  hasForecastDays: boolean;
  days: DayWeather[];
  guidance: string;
}

/**
 * Pure guidance formatter shared between GeminiPlannerService and CopilotAgentService.
 * Uses centralized WEATHER_THRESHOLDS + backend i18n dictionary so prompt rules stay consistent and testable.
 */
export function buildWeatherGuidance(
  days: DayWeather[] | undefined,
  locale: AppLocale = DEFAULT_LOCALE,
): string {
  if (!days || days.length === 0) return '';

  const lines = days.map((d) => {
    const source =
      d.source === WeatherSource.FORECAST
        ? t(locale, 'weather.sourceForecast')
        : t(locale, 'weather.sourceSeasonal');
    const datePart = d.date ? ` (${d.date})` : '';
    const rainPart =
      d.precipitationProbabilityMax != null
        ? t(locale, 'weather.rainPart', { prob: d.precipitationProbabilityMax })
        : '';
    const uvPart =
      d.uvIndexMax != null
        ? t(locale, 'weather.uvPart', { uv: d.uvIndexMax })
        : '';

    const hints: string[] = [];
    const isHighRain =
      (d.precipitationProbabilityMax ?? 0) >=
        WEATHER_THRESHOLDS.RAIN_PROB_HIGH ||
      d.condition === WeatherCondition.RAINY;
    if (isHighRain) {
      hints.push(t(locale, 'weather.hintRain'));
    }

    const isHotOrHighUv =
      d.tempMaxC >= WEATHER_THRESHOLDS.HEAT_TEMP_C ||
      (d.uvIndexMax ?? 0) >= WEATHER_THRESHOLDS.UV_HIGH;
    if (isHotOrHighUv) {
      hints.push(t(locale, 'weather.hintHeat'));
    }

    if (
      d.tempAvgC <= WEATHER_THRESHOLDS.COLD_TEMP_C ||
      d.condition === WeatherCondition.COLD
    ) {
      hints.push(t(locale, 'weather.hintCold'));
    }

    const hintPart = hints.length > 0 ? ` => ${hints.join('; ')}` : '';
    const label =
      locale === 'en'
        ? d.labelEn || CONDITION_FALLBACK_LABEL_EN[d.condition] || d.labelVi
        : d.labelVi;

    return t(locale, 'weather.dayLine', {
      day: d.dayNumber,
      datePart,
      source,
      label,
      min: d.tempMinC,
      max: d.tempMaxC,
      rainPart,
      uvPart,
      hintPart,
    });
  });

  const hasSeasonalOnly = days.every(
    (d) => d.source === WeatherSource.SEASONAL_AVERAGE,
  );
  const seasonalNote = hasSeasonalOnly
    ? t(locale, 'weather.seasonalNote')
    : '';

  return t(locale, 'weather.guidanceHeading', {
    lines: lines.join('\n'),
    seasonalNote,
  });
}

import { normalizeVietnamese } from '../../common/utils/string.util';
import {
  DayWeather,
  WEATHER_THRESHOLDS,
  WeatherCondition,
  WeatherSource,
} from './weather.constants';

export interface MonthClimateEntry {
  temp: number;
  condition: WeatherCondition;
  summary: string;
}

export const BASELINE_VIETNAM_CLIMATE: Record<number, MonthClimateEntry> = {
  1: { temp: 22, condition: WeatherCondition.MILD, summary: 'Dịu mát' },
  2: {
    temp: 24,
    condition: WeatherCondition.MILD,
    summary: 'Dịu mát mùa xuân',
  },
  3: { temp: 26, condition: WeatherCondition.SUNNY, summary: 'Nắng ấm' },
  4: { temp: 28, condition: WeatherCondition.SUNNY, summary: 'Nắng đẹp' },
  5: { temp: 31, condition: WeatherCondition.SUNNY, summary: 'Nắng hè' },
  6: { temp: 32, condition: WeatherCondition.SUNNY, summary: 'Nắng hè rực rỡ' },
  7: { temp: 32, condition: WeatherCondition.SUNNY, summary: 'Nắng hè rực rỡ' },
  8: { temp: 31, condition: WeatherCondition.SUNNY, summary: 'Nắng đẹp' },
  9: { temp: 28, condition: WeatherCondition.RAINY, summary: 'Mưa rải rác' },
  10: { temp: 26, condition: WeatherCondition.RAINY, summary: 'Mưa giao mùa' },
  11: { temp: 24, condition: WeatherCondition.MILD, summary: 'Mát mẻ' },
  12: { temp: 22, condition: WeatherCondition.MILD, summary: 'Se lạnh nhẹ' },
};

/**
 * Vietnam regional monthly climate profiles (single source of truth on backend).
 * Matches the 7 core regions currently in frontend climate constants.
 */
export const DESTINATION_CLIMATE_MAP: Record<
  string,
  Record<number, MonthClimateEntry>
> = {
  danang: {
    1: { temp: 23, condition: WeatherCondition.MILD, summary: 'Mát mẻ' },
    2: {
      temp: 25,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng ấm đầu xuân',
    },
    3: { temp: 27, condition: WeatherCondition.SUNNY, summary: 'Nắng đẹp' },
    4: {
      temp: 29,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng đẹp biển trong',
    },
    5: {
      temp: 32,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng hè biển xanh',
    },
    6: {
      temp: 33,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng hè rực rỡ',
    },
    7: {
      temp: 33,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng hè rực rỡ',
    },
    8: { temp: 31, condition: WeatherCondition.SUNNY, summary: 'Nắng đẹp' },
    9: { temp: 28, condition: WeatherCondition.RAINY, summary: 'Mưa rải rác' },
    10: { temp: 26, condition: WeatherCondition.RAINY, summary: 'Mùa mưa bão' },
    11: { temp: 24, condition: WeatherCondition.RAINY, summary: 'Mưa lạnh' },
    12: { temp: 22, condition: WeatherCondition.MILD, summary: 'Se lạnh' },
  },
  dalat: {
    1: {
      temp: 15,
      condition: WeatherCondition.COLD,
      summary: 'Rét ngọt, mai anh đào',
    },
    2: {
      temp: 16,
      condition: WeatherCondition.COLD,
      summary: 'Se lạnh khô ráo',
    },
    3: {
      temp: 18,
      condition: WeatherCondition.MILD,
      summary: 'Mát mẻ nắng nhẹ',
    },
    4: {
      temp: 20,
      condition: WeatherCondition.MILD,
      summary: 'Mát mẻ, nắng ấm',
    },
    5: { temp: 20, condition: WeatherCondition.MILD, summary: 'Mát mẻ đầu hè' },
    6: {
      temp: 19,
      condition: WeatherCondition.RAINY,
      summary: 'Mưa rào chiều',
    },
    7: {
      temp: 18,
      condition: WeatherCondition.RAINY,
      summary: 'Mưa phùn sương mù',
    },
    8: { temp: 18, condition: WeatherCondition.RAINY, summary: 'Mưa rải rác' },
    9: {
      temp: 18,
      condition: WeatherCondition.RAINY,
      summary: 'Mưa thu sương mờ',
    },
    10: {
      temp: 17,
      condition: WeatherCondition.COLD,
      summary: 'Se lạnh dã quỳ',
    },
    11: {
      temp: 16,
      condition: WeatherCondition.COLD,
      summary: 'Lạnh sương sớm',
    },
    12: {
      temp: 15,
      condition: WeatherCondition.COLD,
      summary: 'Rét đậm mùa lễ',
    },
  },
  phuquoc: {
    1: {
      temp: 29,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng vàng biển êm',
    },
    2: {
      temp: 30,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng đẹp rực rỡ',
    },
    3: {
      temp: 31,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng trong biển lặng',
    },
    4: {
      temp: 32,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng hè biển xanh',
    },
    5: {
      temp: 31,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng ấm đầu mùa',
    },
    6: { temp: 29, condition: WeatherCondition.RAINY, summary: 'Mưa rải rác' },
    7: {
      temp: 29,
      condition: WeatherCondition.RAINY,
      summary: 'Mưa sóng biển',
    },
    8: {
      temp: 29,
      condition: WeatherCondition.RAINY,
      summary: 'Mưa rào nhiệt đới',
    },
    9: { temp: 28, condition: WeatherCondition.RAINY, summary: 'Mưa rào' },
    10: {
      temp: 29,
      condition: WeatherCondition.MILD,
      summary: 'Giao mùa biển êm dần',
    },
    11: {
      temp: 30,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng đẹp biển êm',
    },
    12: {
      temp: 29,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng vàng mùa đẹp nhất',
    },
  },
  hanoi: {
    1: {
      temp: 17,
      condition: WeatherCondition.COLD,
      summary: 'Rét đậm, mưa phùn',
    },
    2: {
      temp: 18,
      condition: WeatherCondition.COLD,
      summary: 'Mưa xuân se lạnh',
    },
    3: { temp: 21, condition: WeatherCondition.MILD, summary: 'Ấm áp mùa hoa' },
    4: {
      temp: 26,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng ấm đầu hè',
    },
    5: { temp: 31, condition: WeatherCondition.SUNNY, summary: 'Nắng hè oi ả' },
    6: {
      temp: 34,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng gắt đỉnh điểm',
    },
    7: {
      temp: 33,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng hè, mưa rào',
    },
    8: { temp: 31, condition: WeatherCondition.RAINY, summary: 'Mưa bão hè' },
    9: {
      temp: 29,
      condition: WeatherCondition.MILD,
      summary: 'Mát mẻ đầu thu',
    },
    10: {
      temp: 26,
      condition: WeatherCondition.MILD,
      summary: 'Thu Hà Nội đẹp nhất',
    },
    11: {
      temp: 22,
      condition: WeatherCondition.COLD,
      summary: 'Gió mùa se lạnh',
    },
    12: {
      temp: 18,
      condition: WeatherCondition.COLD,
      summary: 'Rét ngọt hanh khô',
    },
  },
  sapa: {
    1: {
      temp: 10,
      condition: WeatherCondition.COLD,
      summary: 'Rét buốt, săn mây',
    },
    2: {
      temp: 12,
      condition: WeatherCondition.COLD,
      summary: 'Lạnh sương mùa đào',
    },
    3: {
      temp: 15,
      condition: WeatherCondition.MILD,
      summary: 'Mát lành hoa ban',
    },
    4: {
      temp: 18,
      condition: WeatherCondition.MILD,
      summary: 'Mát mẻ trong lành',
    },
    5: { temp: 20, condition: WeatherCondition.MILD, summary: 'Mùa nước đổ' },
    6: {
      temp: 22,
      condition: WeatherCondition.MILD,
      summary: 'Tránh nóng lý tưởng',
    },
    7: {
      temp: 21,
      condition: WeatherCondition.RAINY,
      summary: 'Mưa rào sương mù',
    },
    8: {
      temp: 20,
      condition: WeatherCondition.RAINY,
      summary: 'Mưa nhẹ đầu thu',
    },
    9: {
      temp: 18,
      condition: WeatherCondition.SUNNY,
      summary: 'Lúa chín vàng rực',
    },
    10: {
      temp: 16,
      condition: WeatherCondition.COLD,
      summary: 'Se lạnh mùa săn mây',
    },
    11: {
      temp: 13,
      condition: WeatherCondition.COLD,
      summary: 'Lạnh buốt sương sớm',
    },
    12: {
      temp: 9,
      condition: WeatherCondition.COLD,
      summary: 'Rét đậm mùa đông',
    },
  },
  ninhbinh: {
    1: {
      temp: 18,
      condition: WeatherCondition.COLD,
      summary: 'Se lạnh, lễ hội',
    },
    2: {
      temp: 19,
      condition: WeatherCondition.MILD,
      summary: 'Mát mẻ mùa xuân',
    },
    3: {
      temp: 23,
      condition: WeatherCondition.MILD,
      summary: 'Dịu mát trong xanh',
    },
    4: {
      temp: 27,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng ấm bướm Cúc Phương',
    },
    5: {
      temp: 31,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng vàng lúa chín Tam Cốc',
    },
    6: {
      temp: 33,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng hè hoa sen',
    },
    7: { temp: 33, condition: WeatherCondition.SUNNY, summary: 'Nắng hè' },
    8: {
      temp: 31,
      condition: WeatherCondition.RAINY,
      summary: 'Mưa hè rải rác',
    },
    9: {
      temp: 28,
      condition: WeatherCondition.MILD,
      summary: 'Mát mẻ đầu thu',
    },
    10: {
      temp: 25,
      condition: WeatherCondition.MILD,
      summary: 'Trời trong thu vàng',
    },
    11: {
      temp: 22,
      condition: WeatherCondition.COLD,
      summary: 'Se lạnh đầu đông',
    },
    12: {
      temp: 19,
      condition: WeatherCondition.COLD,
      summary: 'Lạnh ráo cuối năm',
    },
  },
  nhatrang: {
    1: {
      temp: 26,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng dịu biển êm',
    },
    2: {
      temp: 27,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng đẹp mùa xuân',
    },
    3: {
      temp: 29,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng vàng biển xanh',
    },
    4: {
      temp: 30,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng đẹp lý tưởng',
    },
    5: {
      temp: 32,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng hè rực rỡ',
    },
    6: {
      temp: 33,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng hè rực rỡ',
    },
    7: {
      temp: 32,
      condition: WeatherCondition.SUNNY,
      summary: 'Nắng hè biển trong',
    },
    8: { temp: 32, condition: WeatherCondition.SUNNY, summary: 'Nắng đẹp' },
    9: {
      temp: 30,
      condition: WeatherCondition.MILD,
      summary: 'Dịu nắng cuối hè',
    },
    10: { temp: 28, condition: WeatherCondition.RAINY, summary: 'Mưa rải rác' },
    11: {
      temp: 26,
      condition: WeatherCondition.RAINY,
      summary: 'Mưa bão biển động',
    },
    12: {
      temp: 25,
      condition: WeatherCondition.MILD,
      summary: 'Mát mẻ cuối năm',
    },
  },
};

const DESTINATION_ALIASES: Array<{
  keywords: string[];
  profileKey: keyof typeof DESTINATION_CLIMATE_MAP;
}> = [
  { keywords: ['danang', 'hoian', 'quangnam'], profileKey: 'danang' },
  { keywords: ['dalat', 'lamdong'], profileKey: 'dalat' },
  { keywords: ['phuquoc', 'kiengiang'], profileKey: 'phuquoc' },
  { keywords: ['hanoi'], profileKey: 'hanoi' },
  { keywords: ['sapa', 'laocai'], profileKey: 'sapa' },
  {
    keywords: ['ninhbinh', 'trangAn', 'tamcoc'].map((s) => s.toLowerCase()),
    profileKey: 'ninhbinh',
  },
  { keywords: ['nhatrang', 'khanhhoa'], profileKey: 'nhatrang' },
];

/**
 * Resolves seasonal climate baseline for a Vietnam destination and month (1-12).
 */
export function seasonalFor(
  areaName: string | null | undefined,
  month: number,
): MonthClimateEntry {
  const safeMonth = month >= 1 && month <= 12 ? Math.trunc(month) : 1;
  const compact = normalizeVietnamese(areaName || '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');

  const match = DESTINATION_ALIASES.find((a) =>
    a.keywords.some((kw) => compact.includes(kw)),
  );
  const profile = match
    ? DESTINATION_CLIMATE_MAP[match.profileKey]
    : BASELINE_VIETNAM_CLIMATE;

  return profile[safeMonth] ?? BASELINE_VIETNAM_CLIMATE[safeMonth];
}

export function buildSeasonalDayWeather(params: {
  dayNumber: number;
  date: string | null;
  destination: string | null | undefined;
  month: number;
  degradedFromForecast?: boolean;
}): DayWeather {
  const entry = seasonalFor(params.destination, params.month);
  const swing = WEATHER_THRESHOLDS.SEASONAL_TEMP_SWING_C;

  return {
    dayNumber: params.dayNumber,
    date: params.date,
    source: WeatherSource.SEASONAL_AVERAGE,
    isForecast: false,
    condition: entry.condition,
    labelVi: entry.summary,
    tempMinC: entry.temp - swing,
    tempMaxC: entry.temp + swing,
    tempAvgC: entry.temp,
    precipitationProbabilityMax:
      WEATHER_THRESHOLDS.DEFAULT_SEASONAL_RAIN_PROB[entry.condition],
    uvIndexMax: null,
    weatherCode: null,
    ...(params.degradedFromForecast ? { degradedFromForecast: true } : {}),
  };
}

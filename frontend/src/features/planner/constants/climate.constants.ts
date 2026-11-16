/**
 * Domain constants for Vietnam seasonal climate.
 * Used for instant, zero-latency climate knowledge lookup on travel itineraries.
 * Adheres to AGENTS.md (Ponytail mode: typed domain constants, zero hardcoding, zero external bloat).
 */

import type { WeatherCondition, DayWeather } from '@/types/itinerary';

export const MSN_WEATHER_BASE_URL =
  'https://assets.msn.com/weathermapdata/1/static/weather/Icons/taskbar_v10/Condition_Card';

export const WEATHER_MSN_ICONS: Record<WeatherCondition, string> = {
  SUNNY: `${MSN_WEATHER_BASE_URL}/SunnyDayV3.svg`,
  MILD: `${MSN_WEATHER_BASE_URL}/MostlySunnyDay.svg`,
  RAINY: `${MSN_WEATHER_BASE_URL}/RainShowersDayV2.svg`,
  COLD: `${MSN_WEATHER_BASE_URL}/FogV2.svg`,
};

/**
 * Resolves verified MSN Weather taskbar v10 vector SVG URL matching condition and optional WMO weather code.
 */
export function getMsnWeatherIconUrl(condition: WeatherCondition, weatherCode?: number | null): string {
  if (weatherCode != null) {
    if (weatherCode === 0 || weatherCode === 1) return `${MSN_WEATHER_BASE_URL}/SunnyDayV3.svg`;
    if (weatherCode === 2) return `${MSN_WEATHER_BASE_URL}/MostlySunnyDay.svg`;
    if (weatherCode === 3) return `${MSN_WEATHER_BASE_URL}/MostlyCloudyDayV2.svg`;
    if (weatherCode === 45 || weatherCode === 48) return `${MSN_WEATHER_BASE_URL}/FogV2.svg`;
    if (weatherCode >= 51 && weatherCode <= 67) return `${MSN_WEATHER_BASE_URL}/RainShowersDayV2.svg`;
    if (weatherCode >= 71 && weatherCode <= 77) return `${MSN_WEATHER_BASE_URL}/FogV2.svg`;
    if (weatherCode >= 80 && weatherCode <= 82) return `${MSN_WEATHER_BASE_URL}/RainShowersDayV2.svg`;
    if (weatherCode >= 95) return `${MSN_WEATHER_BASE_URL}/ThunderstormsV2.svg`;
  }
  return WEATHER_MSN_ICONS[condition] || WEATHER_MSN_ICONS.SUNNY;
}

export interface WeatherVisualTheme {
  condition: WeatherCondition;
  icon: string;
  iconUrl: string;
  badgeClass: string;
  heroBadgeClass: string;
}

export const WEATHER_THEMES: Record<WeatherCondition, WeatherVisualTheme> = {
  SUNNY: {
    condition: 'SUNNY',
    icon: 'fa-solid fa-sun',
    iconUrl: `${MSN_WEATHER_BASE_URL}/SunnyDayV3.svg`,
    badgeClass: 'text-amber-700 bg-amber-50 border-amber-200/60',
    heroBadgeClass: 'bg-amber-500/25 text-amber-100 border-amber-300/30',
  },
  MILD: {
    condition: 'MILD',
    icon: 'fa-solid fa-cloud-sun',
    iconUrl: `${MSN_WEATHER_BASE_URL}/MostlySunnyDay.svg`,
    badgeClass: 'text-sky-700 bg-sky-50 border-sky-200/60',
    heroBadgeClass: 'bg-white/20 text-white border-white/20',
  },
  RAINY: {
    condition: 'RAINY',
    icon: 'fa-solid fa-cloud-rain',
    iconUrl: `${MSN_WEATHER_BASE_URL}/RainShowersDayV2.svg`,
    badgeClass: 'text-blue-700 bg-blue-50 border-blue-200/60',
    heroBadgeClass: 'bg-blue-500/25 text-blue-100 border-blue-300/30',
  },
  COLD: {
    condition: 'COLD',
    icon: 'fa-solid fa-cloud-moon',
    iconUrl: `${MSN_WEATHER_BASE_URL}/FogV2.svg`,
    badgeClass: 'text-indigo-700 bg-indigo-50 border-indigo-200/60',
    heroBadgeClass: 'bg-indigo-500/25 text-indigo-100 border-indigo-300/30',
  },
};

export interface ItineraryWeather {
  temperature: number;
  condition: WeatherCondition;
  label: string;
  icon: string;
  iconUrl: string;
  badgeClass: string;
  heroBadgeClass: string;
  isForecast: boolean;
}

export interface MonthClimateEntry {
  temp: number;
  condition: WeatherCondition;
  summary: string;
}

/**
 * Baseline Vietnam monthly climate (average coastal / tropical monsoon baseline)
 */
export const BASELINE_VIETNAM_CLIMATE: Record<number, MonthClimateEntry> = {
  1: { temp: 22, condition: 'MILD', summary: 'Dịu mát' },
  2: { temp: 24, condition: 'MILD', summary: 'Dịu mát mùa xuân' },
  3: { temp: 26, condition: 'SUNNY', summary: 'Nắng ấm' },
  4: { temp: 28, condition: 'SUNNY', summary: 'Nắng đẹp' },
  5: { temp: 31, condition: 'SUNNY', summary: 'Nắng hè' },
  6: { temp: 32, condition: 'SUNNY', summary: 'Nắng hè rực rỡ' },
  7: { temp: 32, condition: 'SUNNY', summary: 'Nắng hè rực rỡ' },
  8: { temp: 31, condition: 'SUNNY', summary: 'Nắng đẹp' },
  9: { temp: 28, condition: 'RAINY', summary: 'Mưa rải rác' },
  10: { temp: 26, condition: 'RAINY', summary: 'Mưa giao mùa' },
  11: { temp: 24, condition: 'MILD', summary: 'Mát mẻ' },
  12: { temp: 22, condition: 'MILD', summary: 'Se lạnh nhẹ' },
};

/**
 * Top Vietnamese travel destination climate profiles
 */
export const DESTINATION_CLIMATE_MAP: Record<string, Record<number, MonthClimateEntry>> = {
  // Đà Nẵng / Hội An / Quảng Nam
  danang: {
    1: { temp: 23, condition: 'MILD', summary: 'Mát mẻ' },
    2: { temp: 25, condition: 'SUNNY', summary: 'Nắng ấm đầu xuân' },
    3: { temp: 27, condition: 'SUNNY', summary: 'Nắng đẹp' },
    4: { temp: 29, condition: 'SUNNY', summary: 'Nắng đẹp biển trong' },
    5: { temp: 32, condition: 'SUNNY', summary: 'Nắng hè biển xanh' },
    6: { temp: 33, condition: 'SUNNY', summary: 'Nắng hè rực rỡ' },
    7: { temp: 33, condition: 'SUNNY', summary: 'Nắng hè rực rỡ' },
    8: { temp: 31, condition: 'SUNNY', summary: 'Nắng đẹp' },
    9: { temp: 28, condition: 'RAINY', summary: 'Mưa rải rác' },
    10: { temp: 26, condition: 'RAINY', summary: 'Mùa mưa bão' },
    11: { temp: 24, condition: 'RAINY', summary: 'Mưa lạnh' },
    12: { temp: 22, condition: 'MILD', summary: 'Se lạnh' },
  },
  // Đà Lạt / Lâm Đồng
  dalat: {
    1: { temp: 15, condition: 'COLD', summary: 'Rét ngọt, mai anh đào' },
    2: { temp: 16, condition: 'COLD', summary: 'Se lạnh khô ráo' },
    3: { temp: 18, condition: 'MILD', summary: 'Mát mẻ nắng nhẹ' },
    4: { temp: 20, condition: 'MILD', summary: 'Mát mẻ, nắng ấm' },
    5: { temp: 20, condition: 'MILD', summary: 'Mát mẻ đầu hè' },
    6: { temp: 19, condition: 'RAINY', summary: 'Mưa rào chiều' },
    7: { temp: 18, condition: 'RAINY', summary: 'Mưa phùn sương mù' },
    8: { temp: 18, condition: 'RAINY', summary: 'Mưa rải rác' },
    9: { temp: 18, condition: 'RAINY', summary: 'Mưa thu sương mờ' },
    10: { temp: 17, condition: 'COLD', summary: 'Se lạnh dã quỳ' },
    11: { temp: 16, condition: 'COLD', summary: 'Lạnh sương sớm' },
    12: { temp: 15, condition: 'COLD', summary: 'Rét đậm mùa lễ' },
  },
  // Phú Quốc / Kiên Giang
  phuquoc: {
    1: { temp: 29, condition: 'SUNNY', summary: 'Nắng vàng biển êm' },
    2: { temp: 30, condition: 'SUNNY', summary: 'Nắng đẹp rực rỡ' },
    3: { temp: 31, condition: 'SUNNY', summary: 'Nắng trong biển lặng' },
    4: { temp: 32, condition: 'SUNNY', summary: 'Nắng hè biển xanh' },
    5: { temp: 31, condition: 'SUNNY', summary: 'Nắng ấm đầu mùa' },
    6: { temp: 29, condition: 'RAINY', summary: 'Mưa rải rác' },
    7: { temp: 29, condition: 'RAINY', summary: 'Mưa sóng biển' },
    8: { temp: 29, condition: 'RAINY', summary: 'Mưa rào nhiệt đới' },
    9: { temp: 28, condition: 'RAINY', summary: 'Mưa rào' },
    10: { temp: 29, condition: 'MILD', summary: 'Giao mùa biển êm dần' },
    11: { temp: 30, condition: 'SUNNY', summary: 'Nắng đẹp biển êm' },
    12: { temp: 29, condition: 'SUNNY', summary: 'Nắng vàng mùa đẹp nhất' },
  },
  // Hà Nội
  hanoi: {
    1: { temp: 17, condition: 'COLD', summary: 'Rét đậm, mưa phùn' },
    2: { temp: 18, condition: 'COLD', summary: 'Mưa xuân se lạnh' },
    3: { temp: 21, condition: 'MILD', summary: 'Ấm áp mùa hoa' },
    4: { temp: 26, condition: 'SUNNY', summary: 'Nắng ấm đầu hè' },
    5: { temp: 31, condition: 'SUNNY', summary: 'Nắng hè oi ả' },
    6: { temp: 34, condition: 'SUNNY', summary: 'Nắng gắt đỉnh điểm' },
    7: { temp: 33, condition: 'SUNNY', summary: 'Nắng hè, mưa rào' },
    8: { temp: 31, condition: 'RAINY', summary: 'Mưa bão hè' },
    9: { temp: 29, condition: 'MILD', summary: 'Mát mẻ đầu thu' },
    10: { temp: 26, condition: 'MILD', summary: 'Thu Hà Nội đẹp nhất' },
    11: { temp: 22, condition: 'COLD', summary: 'Gió mùa se lạnh' },
    12: { temp: 18, condition: 'COLD', summary: 'Rét ngọt hanh khô' },
  },
  // Sa Pa / Lào Cai
  sapa: {
    1: { temp: 10, condition: 'COLD', summary: 'Rét buốt, săn mây' },
    2: { temp: 12, condition: 'COLD', summary: 'Lạnh sương mùa đào' },
    3: { temp: 15, condition: 'MILD', summary: 'Mát lành hoa ban' },
    4: { temp: 18, condition: 'MILD', summary: 'Mát mẻ trong lành' },
    5: { temp: 20, condition: 'MILD', summary: 'Mùa nước đổ' },
    6: { temp: 22, condition: 'MILD', summary: 'Tránh nóng lý tưởng' },
    7: { temp: 21, condition: 'RAINY', summary: 'Mưa rào sương mù' },
    8: { temp: 20, condition: 'RAINY', summary: 'Mưa nhẹ đầu thu' },
    9: { temp: 18, condition: 'SUNNY', summary: 'Lúa chín vàng rực' },
    10: { temp: 16, condition: 'COLD', summary: 'Se lạnh mùa săn mây' },
    11: { temp: 13, condition: 'COLD', summary: 'Lạnh buốt sương sớm' },
    12: { temp: 9, condition: 'COLD', summary: 'Rét đậm mùa đông' },
  },
  // Ninh Bình
  ninhbinh: {
    1: { temp: 18, condition: 'COLD', summary: 'Se lạnh, lễ hội' },
    2: { temp: 19, condition: 'MILD', summary: 'Mát mẻ mùa xuân' },
    3: { temp: 23, condition: 'MILD', summary: 'Dịu mát trong xanh' },
    4: { temp: 27, condition: 'SUNNY', summary: 'Nắng ấm bướm Cúc Phương' },
    5: { temp: 31, condition: 'SUNNY', summary: 'Nắng vàng lúa chín Tam Cốc' },
    6: { temp: 33, condition: 'SUNNY', summary: 'Nắng hè hoa sen' },
    7: { temp: 33, condition: 'SUNNY', summary: 'Nắng hè' },
    8: { temp: 31, condition: 'RAINY', summary: 'Mưa hè rải rác' },
    9: { temp: 28, condition: 'MILD', summary: 'Mát mẻ đầu thu' },
    10: { temp: 25, condition: 'MILD', summary: 'Trời trong thu vàng' },
    11: { temp: 22, condition: 'COLD', summary: 'Se lạnh đầu đông' },
    12: { temp: 19, condition: 'COLD', summary: 'Lạnh ráo cuối năm' },
  },
  // Nha Trang / Khánh Hòa
  nhatrang: {
    1: { temp: 26, condition: 'SUNNY', summary: 'Nắng dịu biển êm' },
    2: { temp: 27, condition: 'SUNNY', summary: 'Nắng đẹp mùa xuân' },
    3: { temp: 29, condition: 'SUNNY', summary: 'Nắng vàng biển xanh' },
    4: { temp: 30, condition: 'SUNNY', summary: 'Nắng đẹp lý tưởng' },
    5: { temp: 32, condition: 'SUNNY', summary: 'Nắng hè rực rỡ' },
    6: { temp: 33, condition: 'SUNNY', summary: 'Nắng hè rực rỡ' },
    7: { temp: 32, condition: 'SUNNY', summary: 'Nắng hè biển trong' },
    8: { temp: 32, condition: 'SUNNY', summary: 'Nắng đẹp' },
    9: { temp: 30, condition: 'MILD', summary: 'Dịu nắng cuối hè' },
    10: { temp: 28, condition: 'RAINY', summary: 'Mưa rải rác' },
    11: { temp: 26, condition: 'RAINY', summary: 'Mưa bão biển động' },
    12: { temp: 25, condition: 'MILD', summary: 'Mát mẻ cuối năm' },
  },
};

export const CLIMATE_THRESHOLDS = {
  HEAT_TEMP_C: 34,
  COLD_TEMP_C: 19,
  HIGH_RAIN_PROB: 50,
  HIGH_UV_INDEX: 8,
} as const;

export interface DayWeatherAdvice {
  advice: string;
  isHighRain: boolean;
  isHeatOrHighUv: boolean;
  isCold: boolean;
}

/**
 * Pure, deterministic day-level climate advice generator for travellers.
 * Provides concise, non-repetitive micro-guidance without invoking LLMs.
 */
export function getDayWeatherAdvice(dayWeather: DayWeather): DayWeatherAdvice {
  const isHighRain =
    (dayWeather.precipitationProbabilityMax ?? 0) >= CLIMATE_THRESHOLDS.HIGH_RAIN_PROB ||
    dayWeather.condition === 'RAINY';
  const isHeatOrHighUv =
    dayWeather.tempMaxC >= CLIMATE_THRESHOLDS.HEAT_TEMP_C ||
    (dayWeather.uvIndexMax ?? 0) >= CLIMATE_THRESHOLDS.HIGH_UV_INDEX;
  const isCold =
    dayWeather.tempAvgC <= CLIMATE_THRESHOLDS.COLD_TEMP_C ||
    dayWeather.condition === 'COLD';

  let advice: string;
  if (isHighRain) {
    advice = 'Khả năng có mưa rào, bạn nên mang theo ô/áo mưa gọn nhẹ và ưu tiên hoạt động trong nhà hoặc nơi có mái che.';
  } else if (isHeatOrHighUv) {
    advice = 'Buổi trưa nắng gắt và chỉ số UV cao, bạn nên bôi kem chống nắng, đội mũ và ưu tiên ăn trưa, nghỉ ngơi khung 11:30–14:00.';
  } else if (isCold) {
    advice = 'Thời tiết se lạnh, đừng quên mang theo áo ấm nhẹ hoặc khăn choàng khi đi vào sáng sớm và đêm muộn.';
  } else {
    advice = 'Thời tiết thuận lợi và dễ chịu, rất thích hợp cho các hoạt động tham quan, khám phá ngoài trời.';
  }

  return {
    advice,
    isHighRain,
    isHeatOrHighUv,
    isCold,
  };
}

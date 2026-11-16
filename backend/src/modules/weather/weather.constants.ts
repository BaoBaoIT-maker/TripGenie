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
  MAX_TRIP_DAYS: 30,
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
}

/**
 * WMO Weather Interpretation Codes (WW) used by Open-Meteo daily.weather_code.
 */
export const WMO_WEATHER_MAP: Record<number, WmoWeatherDescriptor> = {
  0: { condition: WeatherCondition.SUNNY, labelVi: 'Trời quang nắng đẹp' },
  1: { condition: WeatherCondition.SUNNY, labelVi: 'Ít mây, nắng ráo' },
  2: { condition: WeatherCondition.MILD, labelVi: 'Có mây rải rác' },
  3: { condition: WeatherCondition.MILD, labelVi: 'Nhiều mây, dịu mát' },
  45: { condition: WeatherCondition.MILD, labelVi: 'Có sương mù nhẹ' },
  48: { condition: WeatherCondition.COLD, labelVi: 'Sương mù ẩm lạnh' },
  51: { condition: WeatherCondition.RAINY, labelVi: 'Mưa phùn nhẹ' },
  53: { condition: WeatherCondition.RAINY, labelVi: 'Mưa phùn vừa' },
  55: { condition: WeatherCondition.RAINY, labelVi: 'Mưa phùn dày' },
  56: { condition: WeatherCondition.COLD, labelVi: 'Mưa phùn lạnh' },
  57: { condition: WeatherCondition.COLD, labelVi: 'Mưa phùn giá rét' },
  61: { condition: WeatherCondition.RAINY, labelVi: 'Mưa nhỏ rải rác' },
  63: { condition: WeatherCondition.RAINY, labelVi: 'Mưa vừa' },
  65: { condition: WeatherCondition.RAINY, labelVi: 'Mưa to' },
  66: { condition: WeatherCondition.RAINY, labelVi: 'Mưa lạnh nhẹ' },
  67: { condition: WeatherCondition.RAINY, labelVi: 'Mưa lạnh nặng hạt' },
  71: { condition: WeatherCondition.COLD, labelVi: 'Tuyết nhẹ / Rét đậm' },
  73: { condition: WeatherCondition.COLD, labelVi: 'Tuyết vừa / Rét đậm' },
  75: { condition: WeatherCondition.COLD, labelVi: 'Tuyết dày / Rét buốt' },
  77: { condition: WeatherCondition.COLD, labelVi: 'Mưa tuyết / Rét' },
  80: { condition: WeatherCondition.RAINY, labelVi: 'Mưa rào nhẹ' },
  81: { condition: WeatherCondition.RAINY, labelVi: 'Mưa rào vừa' },
  82: { condition: WeatherCondition.RAINY, labelVi: 'Mưa rào rất to' },
  85: { condition: WeatherCondition.COLD, labelVi: 'Mưa tuyết rải rác' },
  86: { condition: WeatherCondition.COLD, labelVi: 'Mưa tuyết dày' },
  95: { condition: WeatherCondition.RAINY, labelVi: 'Dông sét' },
  96: { condition: WeatherCondition.RAINY, labelVi: 'Mưa dông kèm mưa đá nhẹ' },
  99: { condition: WeatherCondition.RAINY, labelVi: 'Mưa dông mạnh' },
};

export function resolveWmoWeather(
  code: number | null | undefined,
  tempAvgC?: number | null,
): WmoWeatherDescriptor {
  const mapped =
    code != null && WMO_WEATHER_MAP[code]
      ? WMO_WEATHER_MAP[code]
      : { condition: WeatherCondition.MILD, labelVi: 'Thời tiết ôn hòa' };

  if (
    tempAvgC != null &&
    tempAvgC <= WEATHER_THRESHOLDS.COLD_TEMP_C &&
    mapped.condition !== WeatherCondition.RAINY
  ) {
    return { condition: WeatherCondition.COLD, labelVi: mapped.labelVi };
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
 * Uses centralized WEATHER_THRESHOLDS so prompt rules stay consistent and testable.
 */
export function buildWeatherGuidance(days: DayWeather[] | undefined): string {
  if (!days || days.length === 0) return '';

  const lines = days.map((d) => {
    const sourceTag =
      d.source === WeatherSource.FORECAST
        ? 'Dự báo'
        : 'Xu hướng khí hậu mùa, không phải dự báo';
    const datePart = d.date ? ` (${d.date})` : '';
    const rainPart =
      d.precipitationProbabilityMax != null
        ? `, xác suất mưa ${d.precipitationProbabilityMax}%`
        : '';
    const uvPart = d.uvIndexMax != null ? `, UV tối đa ${d.uvIndexMax}` : '';

    const hints: string[] = [];
    const isHighRain =
      (d.precipitationProbabilityMax ?? 0) >=
        WEATHER_THRESHOLDS.RAIN_PROB_HIGH ||
      d.condition === WeatherCondition.RAINY;
    if (isHighRain) {
      hints.push(
        'ƯU TIÊN điểm trong nhà/có mái che (bảo tàng, café, workshop, ẩm thực, TTTM), hạn chế ngoài trời kéo dài và gợi ý phương án dự phòng trong notes',
      );
    }

    const isHotOrHighUv =
      d.tempMaxC >= WEATHER_THRESHOLDS.HEAT_TEMP_C ||
      (d.uvIndexMax ?? 0) >= WEATHER_THRESHOLDS.UV_HIGH;
    if (isHotOrHighUv) {
      hints.push(
        'Nắng gắt/UV cao: đẩy điểm ngoài trời lên sáng sớm (07:30-10:30) hoặc chiều muộn/tối (>=16:00); khung 11:30-15:00 ưu tiên ăn trưa, nghỉ ngơi, nơi có điều hòa',
      );
    }

    if (
      d.tempAvgC <= WEATHER_THRESHOLDS.COLD_TEMP_C ||
      d.condition === WeatherCondition.COLD
    ) {
      hints.push(
        'Trời lạnh: ưu tiên đồ ăn nóng, quán ấm cúng, nhắc giữ ấm khi đi sáng sớm/tối',
      );
    }

    const hintText = hints.length > 0 ? ` => ${hints.join('; ')}` : '';
    return `- Ngày ${d.dayNumber}${datePart} [${sourceTag}]: ${d.labelVi}, ${d.tempMinC}-${d.tempMaxC}°C${rainPart}${uvPart}${hintText}`;
  });

  const hasSeasonalOnly = days.every(
    (d) => d.source === WeatherSource.SEASONAL_AVERAGE,
  );
  const seasonalNote = hasSeasonalOnly
    ? '\nLưu ý: Dữ liệu trên là trung bình khí hậu theo mùa (ngoài cửa sổ dự báo), chỉ dùng để gợi ý khung giờ và trang phục, không khẳng định chắc chắn thời tiết từng giờ.'
    : '';

  return `THỜI TIẾT TỪNG NGÀY TẠI ĐIỂM ĐẾN:\n${lines.join('\n')}${seasonalNote}`;
}

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type Redis from 'ioredis';
import { WEATHER_DEFAULTS, weatherConfig } from '../../config/weather.config';
import {
  DayWeather,
  TripWeatherResponse,
  WEATHER_THRESHOLDS,
  WeatherSource,
  buildWeatherGuidance,
  resolveWmoWeather,
} from './weather.constants';
import { buildSeasonalDayWeather } from './seasonal-climate';

interface OpenMeteoDailyArrays {
  time?: string[];
  weather_code?: Array<number | null>;
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
  uv_index_max?: Array<number | null>;
}

interface OpenMeteoForecastResponse {
  daily?: OpenMeteoDailyArrays;
}

interface CachedDailyEntry {
  tempMinC: number;
  tempMaxC: number;
  precipitationProbabilityMax: number | null;
  uvIndexMax: number | null;
  weatherCode: number | null;
}

type ForecastMap = Record<string, CachedDailyEntry>;

export interface TripWeatherParams {
  lat?: number | null;
  lng?: number | null;
  destination?: string | null;
  startDate?: string | Date | null;
  totalDays: number;
  now?: Date;
}

export interface CoordinateSourceInput {
  destinations?: Array<{
    place?: { latitude?: number | null; longitude?: number | null } | null;
  }>;
  area?: {
    bboxMinLat?: number | null;
    bboxMaxLat?: number | null;
    bboxMinLng?: number | null;
    bboxMaxLng?: number | null;
  } | null;
}

function isValidCoordinate(
  lat: number | null | undefined,
  lng: number | null | undefined,
): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= WEATHER_THRESHOLDS.MIN_LAT &&
    lat <= WEATHER_THRESHOLDS.MAX_LAT &&
    lng >= WEATHER_THRESHOLDS.MIN_LNG &&
    lng <= WEATHER_THRESHOLDS.MAX_LNG &&
    (lat !== 0 || lng !== 0)
  );
}

/**
 * Pure coordinate resolver prioritizing actual trip stops, then TravelArea bbox center.
 */
export function resolveItineraryCoordinates(
  source: CoordinateSourceInput,
): { lat: number; lng: number } | null {
  const validStops: Array<{ lat: number; lng: number }> = [];
  for (const dest of source.destinations || []) {
    const lat = dest.place?.latitude;
    const lng = dest.place?.longitude;
    if (isValidCoordinate(lat, lng) && typeof lng === 'number') {
      validStops.push({ lat, lng });
    }
  }

  if (validStops.length > 0) {
    const sum = validStops.reduce(
      (acc, cur) => ({ lat: acc.lat + cur.lat, lng: acc.lng + cur.lng }),
      { lat: 0, lng: 0 },
    );
    return {
      lat: Number((sum.lat / validStops.length).toFixed(4)),
      lng: Number((sum.lng / validStops.length).toFixed(4)),
    };
  }

  const area = source.area;
  if (
    area &&
    isValidCoordinate(area.bboxMinLat, area.bboxMinLng) &&
    isValidCoordinate(area.bboxMaxLat, area.bboxMaxLng)
  ) {
    return {
      lat: Number(((area.bboxMinLat + area.bboxMaxLat) / 2).toFixed(4)),
      lng: Number(
        (
          ((area.bboxMinLng as number) + (area.bboxMaxLng as number)) /
          2
        ).toFixed(4),
      ),
    };
  }

  return null;
}

function parseIsoDatePrefix(
  value: string | Date | null | undefined,
): number | null {
  if (!value) return null;
  const iso =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly httpClient: AxiosInstance;
  private readonly cfg: {
    baseUrl: string;
    timeoutMs: number;
    forecastHorizonDays: number;
    cacheTtlSeconds: number;
    coordPrecision: number;
    timezone: string;
    redisKeyPrefix: string;
    negativeCacheSeconds: number;
  };
  private readonly inFlight = new Map<string, Promise<ForecastMap | null>>();
  // ponytail: per-instance negative cache (grid-bounded keys); upgrade to Redis SET NX EX if multiple API instances share an outage.
  private readonly failedUntilMs = new Map<string, number>();

  constructor(
    @Optional()
    @Inject(weatherConfig.KEY)
    config?: ConfigType<typeof weatherConfig>,
    @Optional()
    @Inject('REDIS_CLIENT')
    private readonly redis?: Redis,
  ) {
    this.cfg = {
      baseUrl: config?.baseUrl || WEATHER_DEFAULTS.BASE_URL,
      timeoutMs: config?.timeoutMs ?? WEATHER_DEFAULTS.TIMEOUT_MS,
      forecastHorizonDays:
        config?.forecastHorizonDays ?? WEATHER_DEFAULTS.FORECAST_HORIZON_DAYS,
      cacheTtlSeconds:
        config?.cacheTtlSeconds ?? WEATHER_DEFAULTS.CACHE_TTL_SECONDS,
      coordPrecision:
        config?.coordPrecision ?? WEATHER_DEFAULTS.COORD_PRECISION,
      timezone: config?.timezone || WEATHER_DEFAULTS.TIMEZONE,
      redisKeyPrefix:
        config?.redisKeyPrefix || WEATHER_DEFAULTS.REDIS_KEY_PREFIX,
      negativeCacheSeconds:
        config?.negativeCacheSeconds ?? WEATHER_DEFAULTS.NEGATIVE_CACHE_SECONDS,
    };
    this.httpClient = axios.create({ timeout: this.cfg.timeoutMs });
  }

  /**
   * Hybrid weather resolver: Open-Meteo 16-day forecast (cached in Redis + in-flight deduped)
   * with automatic seasonal climate fallback. Never throws.
   */
  async getTripWeather(
    params: TripWeatherParams,
  ): Promise<TripWeatherResponse> {
    const safeTotalDays = Math.max(
      1,
      Math.min(
        WEATHER_THRESHOLDS.MAX_TRIP_DAYS,
        Math.trunc(params.totalDays || 1),
      ),
    );
    const now = params.now ?? new Date();
    const vnNow = new Date(now.getTime() + WEATHER_THRESHOLDS.VN_UTC_OFFSET_MS);
    const todayMidnightMs = Date.UTC(
      vnNow.getUTCFullYear(),
      vnNow.getUTCMonth(),
      vnNow.getUTCDate(),
    );
    const currentVnMonth = vnNow.getUTCMonth() + 1;
    const startMidnightMs = parseIsoDatePrefix(params.startDate);

    const daySpecs = Array.from({ length: safeTotalDays }, (_, idx) => {
      const dayNumber = idx + 1;
      if (startMidnightMs == null) {
        return {
          dayNumber,
          date: null as string | null,
          month: currentVnMonth,
          inForecastWindow: false,
        };
      }
      const dayMs = startMidnightMs + idx * WEATHER_THRESHOLDS.MS_PER_DAY;
      const d = new Date(dayMs);
      const diffDays = Math.round(
        (dayMs - todayMidnightMs) / WEATHER_THRESHOLDS.MS_PER_DAY,
      );
      return {
        dayNumber,
        date: d.toISOString().slice(0, 10),
        month: d.getUTCMonth() + 1,
        inForecastWindow:
          diffDays >= 0 && diffDays < this.cfg.forecastHorizonDays,
      };
    });

    const hasValidCoords =
      isValidCoordinate(params.lat, params.lng) &&
      typeof params.lng === 'number';
    const needsForecast =
      hasValidCoords && daySpecs.some((d) => d.inForecastWindow);

    const forecastMap = needsForecast
      ? await this.getForecastWithCacheAndDedupe(
          params.lat as number,
          params.lng as number,
        )
      : null;

    const days: DayWeather[] = daySpecs.map((spec) => {
      const forecastEntry =
        spec.inForecastWindow && spec.date && forecastMap
          ? forecastMap[spec.date]
          : undefined;

      if (forecastEntry && spec.date) {
        const tempAvgC = Math.round(
          (forecastEntry.tempMinC + forecastEntry.tempMaxC) / 2,
        );
        const wmo = resolveWmoWeather(forecastEntry.weatherCode, tempAvgC);
        return {
          dayNumber: spec.dayNumber,
          date: spec.date,
          source: WeatherSource.FORECAST,
          isForecast: true,
          condition: wmo.condition,
          labelVi: wmo.labelVi,
          tempMinC: Math.round(forecastEntry.tempMinC),
          tempMaxC: Math.round(forecastEntry.tempMaxC),
          tempAvgC,
          precipitationProbabilityMax:
            forecastEntry.precipitationProbabilityMax,
          uvIndexMax: forecastEntry.uvIndexMax,
          weatherCode: forecastEntry.weatherCode,
        };
      }

      return buildSeasonalDayWeather({
        dayNumber: spec.dayNumber,
        date: spec.date,
        destination: params.destination,
        month: spec.month,
        degradedFromForecast: spec.inForecastWindow,
      });
    });

    return {
      destination: params.destination ?? null,
      coordinates: hasValidCoords
        ? { lat: params.lat as number, lng: params.lng as number }
        : null,
      timezone: this.cfg.timezone,
      hasForecastDays: days.some((d) => d.source === WeatherSource.FORECAST),
      days,
      guidance: buildWeatherGuidance(days),
    };
  }

  private buildCacheKey(
    lat: number,
    lng: number,
  ): { key: string; latRounded: number; lngRounded: number } {
    const latStr = lat.toFixed(this.cfg.coordPrecision);
    const lngStr = lng.toFixed(this.cfg.coordPrecision);
    return {
      key: `${this.cfg.redisKeyPrefix}:${latStr}:${lngStr}`,
      latRounded: Number(latStr),
      lngRounded: Number(lngStr),
    };
  }

  private async getForecastWithCacheAndDedupe(
    lat: number,
    lng: number,
  ): Promise<ForecastMap | null> {
    // ponytail: Redis cache keys round coordinates to WEATHER_COORD_PRECISION decimals (~1km grid)
    // to share 16-day forecasts across trips in the same city; upgrade to multi-coord batching if traffic grows.
    // Note: Open-Meteo free endpoint is for non-commercial / academic thesis use.
    const { key, latRounded, lngRounded } = this.buildCacheKey(lat, lng);

    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          return JSON.parse(cached) as ForecastMap;
        }
      } catch (err) {
        this.logger.warn(
          `Weather Redis read failed for ${key}: ${(err as Error).message}`,
        );
      }
    }

    const failedUntil = this.failedUntilMs.get(key);
    if (failedUntil !== undefined) {
      if (failedUntil > Date.now()) return null;
      this.failedUntilMs.delete(key);
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const requestPromise = this.fetchAndCacheForecast(
      key,
      latRounded,
      lngRounded,
    )
      .then((map) => {
        if (!map) {
          this.failedUntilMs.set(
            key,
            Date.now() + this.cfg.negativeCacheSeconds * 1000,
          );
        }
        return map;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, requestPromise);
    return requestPromise;
  }

  private async fetchAndCacheForecast(
    cacheKey: string,
    lat: number,
    lng: number,
  ): Promise<ForecastMap | null> {
    try {
      const response = await this.httpClient.get<OpenMeteoForecastResponse>(
        `${this.cfg.baseUrl}/forecast`,
        {
          params: {
            latitude: lat,
            longitude: lng,
            daily:
              'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max',
            timezone: this.cfg.timezone,
            forecast_days: this.cfg.forecastHorizonDays,
          },
        },
      );

      const daily = response.data?.daily;
      if (!daily?.time || !Array.isArray(daily.time)) {
        return null;
      }

      const map: ForecastMap = {};
      for (let i = 0; i < daily.time.length; i++) {
        const dateKey = daily.time[i];
        const minC = daily.temperature_2m_min?.[i];
        const maxC = daily.temperature_2m_max?.[i];
        if (!dateKey || typeof minC !== 'number' || typeof maxC !== 'number')
          continue;

        const precip = daily.precipitation_probability_max?.[i];
        const uv = daily.uv_index_max?.[i];
        const code = daily.weather_code?.[i];

        map[dateKey] = {
          tempMinC: minC,
          tempMaxC: maxC,
          precipitationProbabilityMax:
            typeof precip === 'number' ? Math.round(precip) : null,
          uvIndexMax: typeof uv === 'number' ? Number(uv.toFixed(1)) : null,
          weatherCode: typeof code === 'number' ? code : null,
        };
      }

      if (Object.keys(map).length === 0) {
        return null;
      }

      if (this.redis) {
        try {
          await this.redis.set(
            cacheKey,
            JSON.stringify(map),
            'EX',
            this.cfg.cacheTtlSeconds,
          );
        } catch (err) {
          this.logger.warn(
            `Weather Redis write failed for ${cacheKey}: ${(err as Error).message}`,
          );
        }
      }

      return map;
    } catch (err) {
      this.logger.warn(
        `Open-Meteo fetch failed for ${cacheKey}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}

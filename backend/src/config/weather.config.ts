import { registerAs } from '@nestjs/config';

export const WEATHER_DEFAULTS = {
  BASE_URL: 'https://api.open-meteo.com/v1',
  TIMEOUT_MS: 2000,
  FORECAST_HORIZON_DAYS: 16,
  CACHE_TTL_SECONDS: 10800,
  COORD_PRECISION: 2,
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  REDIS_KEY_PREFIX: 'weather:v1',
  NEGATIVE_CACHE_SECONDS: 60,
} as const;

export const weatherConfig = registerAs('weather', () => ({
  baseUrl: process.env.WEATHER_API_BASE_URL || WEATHER_DEFAULTS.BASE_URL,
  timeoutMs: parseInt(
    process.env.WEATHER_TIMEOUT_MS || String(WEATHER_DEFAULTS.TIMEOUT_MS),
    10,
  ),
  forecastHorizonDays: parseInt(
    process.env.WEATHER_FORECAST_HORIZON_DAYS ||
      String(WEATHER_DEFAULTS.FORECAST_HORIZON_DAYS),
    10,
  ),
  cacheTtlSeconds: parseInt(
    process.env.WEATHER_CACHE_TTL_SECONDS ||
      String(WEATHER_DEFAULTS.CACHE_TTL_SECONDS),
    10,
  ),
  coordPrecision: parseInt(
    process.env.WEATHER_COORD_PRECISION ||
      String(WEATHER_DEFAULTS.COORD_PRECISION),
    10,
  ),
  timezone: process.env.WEATHER_TIMEZONE || WEATHER_DEFAULTS.TIMEZONE,
  redisKeyPrefix: WEATHER_DEFAULTS.REDIS_KEY_PREFIX,
  negativeCacheSeconds: WEATHER_DEFAULTS.NEGATIVE_CACHE_SECONDS,
}));

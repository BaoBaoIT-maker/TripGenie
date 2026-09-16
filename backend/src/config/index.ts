import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.BACKEND_BASE_URL || 'http://localhost:3000',
  uploadStorage: process.env.UPLOAD_STORAGE || 'local',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  url: process.env.REDIS_URL,
}));

export const aiConfig = registerAs('ai', () => ({
  provider: process.env.AI_PROVIDER || 'GEMINI',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
}));

export const crawlerConfig = registerAs('crawler', () => ({
  overpassApiUrl: process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
  foursquareApiKey: process.env.FOURSQUARE_API_KEY,
  dedupRadiusMeters: parseInt(process.env.DEDUP_RADIUS_METERS || '50', 10),
}));

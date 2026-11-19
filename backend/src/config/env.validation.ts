import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  BACKEND_BASE_URL: Joi.string().uri().required(),
  FRONTEND_BASE_URL: Joi.string()
    .uri()
    .optional()
    .default('http://localhost:3000'),
  OTP_SECRET: Joi.string().optional().allow(''),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_URL: Joi.string().optional().allow(''),

  // AI Assistant
  GEMINI_API_KEY: Joi.string().optional().allow('').default('mock_key'),
  GEMINI_MODEL: Joi.string().default('gemini-2.5-flash'),
  GEMINI_EMBEDDING_MODEL: Joi.string().optional().allow(''),
  AI_PROVIDER: Joi.string().default('GEMINI'),

  // Auth & JWT
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // OAuth
  GOOGLE_CLIENT_ID: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  GOOGLE_CALLBACK_URL: Joi.string().optional().allow(''),

  FACEBOOK_APP_ID: Joi.string().optional().allow(''),
  FACEBOOK_APP_SECRET: Joi.string().optional().allow(''),
  FACEBOOK_VERIFY_TOKEN: Joi.string().optional().allow(''),
  FACEBOOK_CALLBACK_URL: Joi.string().optional().allow(''),

  // Storage
  UPLOAD_STORAGE: Joi.string()
    .valid('local', 'cloudinary', 's3')
    .default('local'),
  CLOUDINARY_CLOUD_NAME: Joi.string().optional().allow(''),
  CLOUDINARY_API_KEY: Joi.string().optional().allow(''),
  CLOUDINARY_API_SECRET: Joi.string().optional().allow(''),

  // Weather (Open-Meteo + seasonal fallback)
  WEATHER_API_BASE_URL: Joi.string().uri().optional().allow(''),
  WEATHER_TIMEOUT_MS: Joi.number()
    .integer()
    .min(500)
    .max(15000)
    .optional()
    .default(2000),
  WEATHER_FORECAST_HORIZON_DAYS: Joi.number()
    .integer()
    .min(1)
    .max(16)
    .optional()
    .default(16),
  WEATHER_CACHE_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .optional()
    .default(10800),
  WEATHER_COORD_PRECISION: Joi.number()
    .integer()
    .min(1)
    .max(4)
    .optional()
    .default(2),
  WEATHER_TIMEZONE: Joi.string().optional().default('Asia/Ho_Chi_Minh'),

  // Email
  EMAIL_HOST: Joi.string().optional().allow(''),
  EMAIL_PORT: Joi.number().optional(),
  EMAIL_USER: Joi.string().optional().allow(''),
  EMAIL_PASS: Joi.string().optional().allow(''),

  // Rate Limiting (optional overrides)
  RATE_LIMIT_ENABLED: Joi.boolean().optional().default(true),
  RATE_LIMIT_GLOBAL_TTL: Joi.number().optional(),
  RATE_LIMIT_GLOBAL_LIMIT: Joi.number().optional(),
  RATE_LIMIT_AUTH_TTL: Joi.number().optional(),
  RATE_LIMIT_AUTH_LIMIT: Joi.number().optional(),
  RATE_LIMIT_AI_GENERATE_TTL: Joi.number().optional(),
  RATE_LIMIT_AI_GENERATE_LIMIT: Joi.number().optional(),
  RATE_LIMIT_AI_CHAT_TTL: Joi.number().optional(),
  RATE_LIMIT_AI_CHAT_LIMIT: Joi.number().optional(),
  RATE_LIMIT_UPLOAD_TTL: Joi.number().optional(),
  RATE_LIMIT_UPLOAD_LIMIT: Joi.number().optional(),
});

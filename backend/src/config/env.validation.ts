import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  BACKEND_BASE_URL: Joi.string().uri().required(),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_URL: Joi.string().optional(),

  // AI Assistant
  GEMINI_API_KEY: Joi.string().required(),
  GEMINI_MODEL: Joi.string().default('gemini-2.5-flash'),
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
  UPLOAD_STORAGE: Joi.string().valid('local', 'cloudinary', 's3').default('local'),
  CLOUDINARY_CLOUD_NAME: Joi.string().optional().allow(''),
  CLOUDINARY_API_KEY: Joi.string().optional().allow(''),
  CLOUDINARY_API_SECRET: Joi.string().optional().allow(''),

  // Crawler & External POI APIs
  OVERPASS_API_URL: Joi.string().optional().allow(''),
  FOURSQUARE_API_KEY: Joi.string().optional().allow(''),

  // Email
  EMAIL_HOST: Joi.string().optional().allow(''),
  EMAIL_PORT: Joi.number().optional(),
  EMAIL_USER: Joi.string().optional().allow(''),
  EMAIL_PASS: Joi.string().optional().allow(''),
});

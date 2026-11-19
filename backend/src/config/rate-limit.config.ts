import { registerAs } from '@nestjs/config';

export enum RateLimitTier {
  GLOBAL = 'GLOBAL',
  AUTH_LOGIN = 'AUTH_LOGIN',
  AI_GENERATE = 'AI_GENERATE',
  AI_CHAT = 'AI_CHAT',
  MEDIA_UPLOAD = 'MEDIA_UPLOAD',
}

export type RateLimitKeyBy = 'ip' | 'user';

export interface RateLimitTierConfig {
  ttl: number; // in seconds
  limit: number;
  keyBy: RateLimitKeyBy;
}

export interface RateLimitConfig {
  enabled: boolean;
  tiers: Record<RateLimitTier, RateLimitTierConfig>;
}

export const RATE_LIMIT_DEFAULT_TIERS: Record<RateLimitTier, RateLimitTierConfig> = {
  [RateLimitTier.GLOBAL]: {
    ttl: 60,
    limit: 80,
    keyBy: 'ip',
  },
  [RateLimitTier.AUTH_LOGIN]: {
    ttl: 60,
    limit: 5,
    keyBy: 'ip',
  },
  [RateLimitTier.AI_GENERATE]: {
    ttl: 30,
    limit: 1,
    keyBy: 'user',
  },
  [RateLimitTier.AI_CHAT]: {
    ttl: 60,
    limit: 4,
    keyBy: 'user',
  },
  [RateLimitTier.MEDIA_UPLOAD]: {
    ttl: 60,
    limit: 5,
    keyBy: 'user',
  },
};

export const rateLimitConfig = registerAs<RateLimitConfig>('rateLimit', () => ({
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  tiers: {
    [RateLimitTier.GLOBAL]: {
      ttl:
        Number(process.env.RATE_LIMIT_GLOBAL_TTL) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.GLOBAL].ttl,
      limit:
        Number(process.env.RATE_LIMIT_GLOBAL_LIMIT) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.GLOBAL].limit,
      keyBy: 'ip',
    },
    [RateLimitTier.AUTH_LOGIN]: {
      ttl:
        Number(process.env.RATE_LIMIT_AUTH_TTL) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.AUTH_LOGIN].ttl,
      limit:
        Number(process.env.RATE_LIMIT_AUTH_LIMIT) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.AUTH_LOGIN].limit,
      keyBy: 'ip',
    },
    [RateLimitTier.AI_GENERATE]: {
      ttl:
        Number(process.env.RATE_LIMIT_AI_GENERATE_TTL) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.AI_GENERATE].ttl,
      limit:
        Number(process.env.RATE_LIMIT_AI_GENERATE_LIMIT) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.AI_GENERATE].limit,
      keyBy: 'user',
    },
    [RateLimitTier.AI_CHAT]: {
      ttl:
        Number(process.env.RATE_LIMIT_AI_CHAT_TTL) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.AI_CHAT].ttl,
      limit:
        Number(process.env.RATE_LIMIT_AI_CHAT_LIMIT) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.AI_CHAT].limit,
      keyBy: 'user',
    },
    [RateLimitTier.MEDIA_UPLOAD]: {
      ttl:
        Number(process.env.RATE_LIMIT_UPLOAD_TTL) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.MEDIA_UPLOAD].ttl,
      limit:
        Number(process.env.RATE_LIMIT_UPLOAD_LIMIT) ||
        RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.MEDIA_UPLOAD].limit,
      keyBy: 'user',
    },
  },
}));

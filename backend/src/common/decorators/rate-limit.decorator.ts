import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { RateLimitTier, RateLimitKeyBy } from '../../config/rate-limit.config';

export const RATE_LIMIT_OPTIONS_KEY = 'rate_limit:options';
export const RATE_LIMIT_SKIP_KEY = 'rate_limit:skip';

export interface RateLimitOptions {
  tier?: RateLimitTier;
  ttl?: number;
  limit?: number;
  keyBy?: RateLimitKeyBy;
}

/**
 * Decorator to apply a specific rate limit tier or custom limit/ttl to a controller or method.
 *
 * Example usage:
 *   @RateLimit({ tier: RateLimitTier.AI_GENERATE })
 *   @RateLimit({ limit: 10, ttl: 60, keyBy: 'user' })
 */
export const RateLimit = (options: RateLimitOptions): CustomDecorator<string> =>
  SetMetadata(RATE_LIMIT_OPTIONS_KEY, options);

/**
 * Decorator to skip rate limiting entirely on public webhooks, health checks, or whitelisted routes.
 */
export const SkipRateLimit = (): CustomDecorator<string> =>
  SetMetadata(RATE_LIMIT_SKIP_KEY, true);

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Request, Response } from 'express';
import {
  RATE_LIMIT_OPTIONS_KEY,
  RATE_LIMIT_SKIP_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import {
  RateLimitTier,
  RateLimitConfig,
  RATE_LIMIT_DEFAULT_TIERS,
} from '../../config/rate-limit.config';
import { ERROR_CODES } from '../constants/error-codes';

// Atomic Lua script: Increment and guarantee TTL in a single network round-trip.
// Self-heals keys with negative TTL to prevent indefinite leaks.
const ATOMIC_RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
return {current, ttl}
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    // 1. Check if rate limiting is globally disabled via env
    const rateLimitConfig =
      this.configService.get<RateLimitConfig>('rateLimit');
    if (rateLimitConfig && rateLimitConfig.enabled === false) {
      return true;
    }

    // 2. Check if route is marked with @SkipRateLimit()
    const shouldSkip = this.reflector.getAllAndOverride<boolean>(
      RATE_LIMIT_SKIP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (shouldSkip) {
      return true;
    }

    // 3. Resolve rate limit options (handler overrides class, falls back to GLOBAL tier)
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_OPTIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const tierName = options?.tier || RateLimitTier.GLOBAL;
    const tierConfig =
      rateLimitConfig?.tiers?.[tierName] ||
      RATE_LIMIT_DEFAULT_TIERS[tierName] ||
      RATE_LIMIT_DEFAULT_TIERS[RateLimitTier.GLOBAL];

    const limit = options?.limit ?? tierConfig.limit;
    const ttl = options?.ttl ?? tierConfig.ttl;
    const keyBy = options?.keyBy ?? tierConfig.keyBy;

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { id?: string; sub?: string } }>();
    const response = http.getResponse<Response>();

    // 4. Resolve tracking identifier
    const identifier = this.resolveIdentifier(request, keyBy);
    const redisKey = `ratelimit:${tierName}:${keyBy}:${identifier}`;

    // 5. Execute atomic rate check on Redis (with fail-open resilience)
    let current = 1;
    let remainingTtl = ttl;

    try {
      const result = (await this.redisClient.eval(
        ATOMIC_RATE_LIMIT_LUA,
        1,
        redisKey,
        ttl.toString(),
      )) as [number, number];

      current = Number(result[0]);
      remainingTtl = Number(result[1]);
    } catch (err) {
      const error = err as Error;
      // Fail-open: Redis connectivity issues must never lock legitimate users out
      this.logger.warn(
        `RateLimiter: Redis evaluation failed (${error.message}). Failing open to protect UX.`,
      );
      return true;
    }

    // 6. Inject standard RFC RateLimit headers
    const remainingRequests = Math.max(0, limit - current);
    const resetTimestamp = Math.floor(Date.now() / 1000) + remainingTtl;

    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', remainingRequests.toString());
      response.setHeader('X-RateLimit-Reset', resetTimestamp.toString());
    }

    // 7. Check if limit exceeded
    if (current > limit) {
      if (response && typeof response.setHeader === 'function') {
        response.setHeader('Retry-After', remainingTtl.toString());
      }

      this.logger.warn(
        `Rate limit exceeded for key [${redisKey}]: ${current}/${limit} (TTL: ${remainingTtl}s)`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: `Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau ${remainingTtl} giây.`,
          retryAfter: remainingTtl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Safely resolves client IP or user ID depending on keyBy policy.
   */
  private resolveIdentifier(
    request: Request & { user?: { id?: string; sub?: string } },
    keyBy: 'ip' | 'user',
  ): string {
    if (keyBy === 'user') {
      const userId = request.user?.id || request.user?.sub;
      if (userId) {
        return userId;
      }
    }

    // Fallback to client IP if anonymous or keyBy === 'ip'
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].trim();
    }

    return (
      request.ip ||
      request.socket?.remoteAddress ||
      '127.0.0.1'
    );
  }
}

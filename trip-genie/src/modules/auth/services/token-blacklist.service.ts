import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';

/**
 * TokenBlacklistService — SRP: manages token revocation via Redis.
 *
 * Strategy:
 * - On logout: decode token → get jti (JWT ID) + exp → SET blacklist:token:<jti> EX <remaining_ttl>
 * - On each request: JwtStrategy calls isBlacklisted(jti) before trusting the token
 * - Redis key expires automatically when the token would have expired anyway → no memory leak
 *
 * Why jti instead of full token hash?
 * - jti is a short UUID (36 chars) vs hashing full token (expensive CPU on every request)
 * - Requires JWT_ACCESS_SECRET to sign tokens with jti (done in generateTokens)
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly BLACKLIST_PREFIX = 'blacklist:token:';

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Revokes an access token by adding its jti to Redis with remaining TTL.
   * If the token is already expired or malformed, this is a no-op.
   */
  async revokeAccessToken(token: string): Promise<void> {
    try {
      const secret = this.configService.get<string>('JWT_SECRET', '');
      const payload = this.jwtService.decode(token) as {
        jti?: string;
        exp?: number;
        sub?: string;
      } | null;

      if (!payload?.jti || !payload?.exp) {
        this.logger.warn('Token missing jti or exp — cannot blacklist');
        return;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const remainingTtl = payload.exp - nowSec;

      if (remainingTtl <= 0) {
        // Token already expired — no need to blacklist
        return;
      }

      const key = `${this.BLACKLIST_PREFIX}${payload.jti}`;
      await this.redisClient.set(key, payload.sub ?? '1', 'EX', remainingTtl);
      this.logger.debug(`Token ${payload.jti} blacklisted for ${remainingTtl}s`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to blacklist token: ${message}`);
      // Do NOT re-throw — logout should still succeed even if Redis is unavailable
    }
  }

  /**
   * Returns true if the given jti has been revoked.
   * Called by JwtStrategy.validate() on every authenticated request.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    try {
      const result = await this.redisClient.exists(`${this.BLACKLIST_PREFIX}${jti}`);
      return result === 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Redis blacklist check failed: ${message}`);
      // Fail-open: if Redis is down, allow request through rather than locking everyone out
      // Fail-closed variant: return true (reject all) — choose based on security posture
      return false;
    }
  }
}

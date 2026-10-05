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
      const payload = this.jwtService.decode(token) as {
        jti?: string;
        exp?: number;
        sub?: string;
      } | null;

      if (!payload?.jti || !payload?.exp) {
        this.logger.warn('Token missing jti or exp — cannot blacklist');
        return;
      }

      await this.revokeByJti(payload.jti, payload.exp, payload.sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to blacklist token: ${message}`);
    }
  }

  /**
   * Revokes a token by its jti + exp directly — preferred when jti is already available
   * in req.user (e.g. from JwtStrategy.validate), avoiding a second token decode.
   *
   * @param jti  — JWT ID claim
   * @param exp  — Token expiry as unix timestamp
   * @param sub  — Optional subject (userId) stored as Redis value for traceability
   */
  async revokeByJti(jti: string, exp: number, sub?: string): Promise<void> {
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const remainingTtl = exp - nowSec;

      if (remainingTtl <= 0) {
        return; // Already expired — nothing to revoke
      }

      const key = `${this.BLACKLIST_PREFIX}${jti}`;
      await this.redisClient.set(key, sub ?? '1', 'EX', remainingTtl);
      this.logger.debug(`Token jti=${jti} blacklisted for ${remainingTtl}s`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to blacklist jti ${jti}: ${message}`);
      // Non-fatal: logout should succeed even if Redis is temporarily unavailable
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

import {
  Injectable,
  Inject,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { MailService } from './mail.service';

export type OtpPurpose = 'email-verification' | 'password-reset';

export interface OtpChallengeResult {
  message: string;
  expiresIn: number;
  retryAfter: number;
}

export interface StoredOtpChallenge {
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  // Configuration constants
  public static readonly OTP_TTL_SECONDS = 600; // 10 minutes
  public static readonly RESEND_COOLDOWN_SECONDS = 60; // 60 seconds
  public static readonly MAX_ATTEMPTS = 5;
  public static readonly HOURLY_LIMIT = 5;

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private getOtpSecret(): string {
    return (
      this.configService.get<string>('OTP_SECRET') ||
      this.configService.get<string>('JWT_SECRET', 'tripgenie_default_otp_secret_key_32_chars')
    );
  }

  private hashOtp(otp: string): string {
    const secret = this.getOtpSecret();
    return crypto.createHmac('sha256', secret).update(otp).digest('hex');
  }

  private getChallengeKey(purpose: OtpPurpose, email: string): string {
    return `otp:challenge:${purpose}:${email.toLowerCase().trim()}`;
  }

  private getCooldownKey(purpose: OtpPurpose, email: string): string {
    return `otp:cooldown:${purpose}:${email.toLowerCase().trim()}`;
  }

  private getRateLimitKey(purpose: OtpPurpose, email: string): string {
    return `otp:ratelimit:${purpose}:${email.toLowerCase().trim()}`;
  }

  /**
   * Generates a 6-digit cryptographic OTP, saves challenge in Redis, and sends email.
   * Throws if cooldown is active, rate limit exceeded, or email sending fails.
   */
  async generateAndSendOtp(email: string, purpose: OtpPurpose): Promise<OtpChallengeResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const cooldownKey = this.getCooldownKey(purpose, normalizedEmail);
    const challengeKey = this.getChallengeKey(purpose, normalizedEmail);
    const rateLimitKey = this.getRateLimitKey(purpose, normalizedEmail);

    // 1. Check Resend Cooldown
    try {
      const remainingCooldown = await this.redisClient.ttl(cooldownKey);
      if (remainingCooldown > 0) {
        throw new BadRequestException(
          `Vui lòng đợi ${remainingCooldown} giây trước khi yêu cầu mã OTP mới`,
        );
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Redis cooldown check error: ${err.message}`);
      throw new ServiceUnavailableException('Dịch vụ xác thực tạm thời không khả dụng, vui lòng thử lại');
    }

    // 2. Check Hourly Rate Limit (max 5 per hour per email/purpose)
    try {
      const requestsThisHour = await this.redisClient.incr(rateLimitKey);
      if (requestsThisHour === 1) {
        await this.redisClient.expire(rateLimitKey, 3600);
      }
      if (requestsThisHour > OtpService.HOURLY_LIMIT) {
        throw new BadRequestException('Bạn đã vượt quá giới hạn gửi OTP trong 1 giờ. Vui lòng thử lại sau.');
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Redis rate limit error: ${err.message}`);
      throw new ServiceUnavailableException('Dịch vụ xác thực tạm thời không khả dụng, vui lòng thử lại');
    }

    // 3. Generate Cryptographically Secure 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    this.logger.log(`🔑 [OTP DEBUG] Mã OTP cho ${normalizedEmail} (${purpose}) là: ${rawOtp}`);
    const otpHash = this.hashOtp(rawOtp);
    const now = Date.now();

    const challenge: StoredOtpChallenge = {
      otpHash,
      attempts: 0,
      maxAttempts: OtpService.MAX_ATTEMPTS,
      createdAt: now,
      expiresAt: now + OtpService.OTP_TTL_SECONDS * 1000,
    };

    // 4. Save Challenge in Redis with 10-minute TTL
    try {
      await this.redisClient.set(
        challengeKey,
        JSON.stringify(challenge),
        'EX',
        OtpService.OTP_TTL_SECONDS,
      );
      // Set Cooldown key for 60s
      await this.redisClient.set(cooldownKey, '1', 'EX', OtpService.RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      this.logger.error(`Redis set challenge error: ${err.message}`);
      throw new ServiceUnavailableException('Dịch vụ lưu trữ xác thực tạm thời không khả dụng');
    }

    // 5. Send Email via MailService
    const emailSent = await this.mailService.sendOtpEmail(normalizedEmail, rawOtp, purpose);
    if (!emailSent) {
      // Clean up challenge so user isn't stuck with unreachable code
      try {
        await this.redisClient.del(challengeKey);
        await this.redisClient.del(cooldownKey);
      } catch {
        /* non-fatal rollback */
      }
      throw new ServiceUnavailableException(
        'Không thể gửi email chứa mã OTP. Vui lòng kiểm tra lại địa chỉ email hoặc thử lại sau.',
      );
    }

    const message =
      purpose === 'password-reset'
        ? 'Mã OTP đặt lại mật khẩu đã được gửi tới email của bạn. Mã có hiệu lực trong 10 phút.'
        : 'Mã OTP xác thực đã được gửi tới email của bạn. Mã có hiệu lực trong 10 phút.';

    return {
      message,
      expiresIn: OtpService.OTP_TTL_SECONDS,
      retryAfter: OtpService.RESEND_COOLDOWN_SECONDS,
    };
  }

  /**
   * Verifies the provided OTP against the active challenge in Redis.
   * Decrements attempts on failure; deletes challenge on success (single-use consume).
   */
  async verifyOtp(email: string, rawOtp: string, purpose: OtpPurpose): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const challengeKey = this.getChallengeKey(purpose, normalizedEmail);

    let rawData: string | null = null;
    try {
      rawData = await this.redisClient.get(challengeKey);
    } catch (err: any) {
      this.logger.error(`Redis get challenge error: ${err.message}`);
      throw new ServiceUnavailableException('Dịch vụ xác thực tạm thời không khả dụng, vui lòng thử lại');
    }

    if (!rawData) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn');
    }

    let challenge: StoredOtpChallenge;
    try {
      challenge = JSON.parse(rawData);
    } catch {
      await this.redisClient.del(challengeKey);
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
    }

    // Check attempts
    if (challenge.attempts >= challenge.maxAttempts) {
      await this.redisClient.del(challengeKey);
      throw new BadRequestException(
        'Đã vượt quá số lần thử OTP cho phép (5 lần). Vui lòng yêu cầu mã mới.',
      );
    }

    // Check hash
    const inputHash = this.hashOtp(rawOtp);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(challenge.otpHash, 'hex'),
      Buffer.from(inputHash, 'hex'),
    );

    if (!isValid) {
      challenge.attempts += 1;
      const remainingTtl = await this.redisClient.ttl(challengeKey);
      if (remainingTtl > 0) {
        await this.redisClient.set(challengeKey, JSON.stringify(challenge), 'EX', remainingTtl);
      }
      const attemptsLeft = challenge.maxAttempts - challenge.attempts;
      throw new BadRequestException(
        `Mã OTP không chính xác. Bạn còn ${attemptsLeft} lần thử.`,
      );
    }

    // Successfully verified -> consume challenge immediately
    try {
      await this.redisClient.del(challengeKey);
    } catch {
      /* non-fatal */
    }

    return true;
  }
}

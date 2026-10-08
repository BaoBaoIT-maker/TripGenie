import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { IUsersRepository } from '@/modules/users/interfaces/users-repository.interface';
import { OtpService } from './otp.service';
import { PrismaService } from '@/database/prisma.service';

export interface StoredResetTicket {
  userId: string;
  authVersion: number;
  createdAt: number;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  public static readonly TICKET_TTL_SECONDS = 300; // 5 minutes

  constructor(
    @Inject(INJECT_TOKENS.USER_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly prisma: PrismaService,
  ) {}

  private hashTicket(ticket: string): string {
    const secret =
      this.configService.get<string>('JWT_SECRET', 'tripgenie_reset_ticket_secret');
    return crypto.createHmac('sha256', secret).update(ticket).digest('hex');
  }

  private getTicketKey(ticket: string): string {
    const hash = this.hashTicket(ticket);
    return `reset:ticket:${hash}`;
  }

  /**
   * Initiates password reset by sending an OTP.
   * Always returns a generic response to prevent user enumeration (OWASP).
   */
  async forgotPassword(email: string): Promise<{
    message: string;
    expiresIn: number;
    retryAfter: number;
  }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersRepository.findByEmail(normalizedEmail);

    // Only allow sending reset OTP if user exists, is active, has verified email and has local password
    if (user && user.isActive && user.isVerified && user.passwordHash) {
      try {
        await this.otpService.generateAndSendOtp(normalizedEmail, 'password-reset');
      } catch (err: any) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        this.logger.error(`Error sending reset OTP: ${err.message}`);
        if (err.status === 503) {
          throw err;
        }
      }
    }

    return {
      message: 'Nếu email tồn tại và có liên kết mật khẩu trên hệ thống, mã xác thực OTP đã được gửi tới email của bạn.',
      expiresIn: OtpService.OTP_TTL_SECONDS,
      retryAfter: OtpService.RESEND_COOLDOWN_SECONDS,
    };
  }

  /**
   * Verifies OTP for password reset and issues a single-use opaque reset ticket.
   */
  async verifyResetOtp(
    email: string,
    otp: string,
  ): Promise<{ resetTicket: string; expiresIn: number }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP challenge
    await this.otpService.verifyOtp(normalizedEmail, otp, 'password-reset');

    const user = await this.usersRepository.findByEmail(normalizedEmail);
    if (!user || !user.isActive || !user.passwordHash) {
      throw new BadRequestException('Tài khoản không hợp lệ hoặc không hỗ trợ đặt lại mật khẩu');
    }

    // Generate cryptographically random opaque ticket (32 bytes = 64 hex chars)
    const resetTicket = crypto.randomBytes(32).toString('hex');
    const ticketKey = this.getTicketKey(resetTicket);

    const ticketData: StoredResetTicket = {
      userId: user.id,
      authVersion: user.authVersion ?? 0,
      createdAt: Date.now(),
    };

    await this.redisClient.set(
      ticketKey,
      JSON.stringify(ticketData),
      'EX',
      PasswordResetService.TICKET_TTL_SECONDS,
    );

    return {
      resetTicket,
      expiresIn: PasswordResetService.TICKET_TTL_SECONDS,
    };
  }

  /**
   * Consumes the reset ticket and updates the user's password.
   * Increments user.authVersion to invalidate all previous sessions.
   */
  async resetPassword(resetTicket: string, newPassword: string): Promise<{ message: string }> {
    if (!resetTicket || resetTicket.length < 32) {
      throw new BadRequestException('Vé xác thực đặt lại mật khẩu không hợp lệ');
    }

    if (!newPassword || newPassword.length < 15) {
      throw new BadRequestException('Mật khẩu mới phải có tối thiểu 15 ký tự');
    }

    if (Buffer.byteLength(newPassword, 'utf8') > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 bytes UTF-8');
    }

    const ticketKey = this.getTicketKey(resetTicket);
    // Atomic ticket consumption via Redis DEL check
    const rawTicket = await this.redisClient.get(ticketKey);

    if (!rawTicket) {
      throw new BadRequestException(
        'Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
      );
    }

    let ticket: StoredResetTicket;
    try {
      ticket = JSON.parse(rawTicket);
    } catch {
      await this.redisClient.del(ticketKey);
      throw new BadRequestException('Dữ liệu yêu cầu không hợp lệ');
    }

    const user = await this.usersRepository.findById(ticket.userId);
    if (!user || !user.isActive || !user.passwordHash) {
      await this.redisClient.del(ticketKey);
      throw new BadRequestException('Tài khoản không tồn tại, đã bị khóa hoặc không hỗ trợ mật khẩu');
    }

    if ((user.authVersion ?? 0) !== ticket.authVersion) {
      await this.redisClient.del(ticketKey);
      throw new BadRequestException(
        'Phiên đặt lại mật khẩu đã bị vô hiệu do có thay đổi tài khoản gần đây',
      );
    }

    // Atomically delete ticket from Redis to prevent concurrent reuse
    const deletedCount = await this.redisClient.del(ticketKey);
    if (deletedCount === 0) {
      throw new BadRequestException('Yêu cầu đặt lại mật khẩu đã được sử dụng');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Atomically update password with conditional authVersion matching
    const updateResult = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        authVersion: ticket.authVersion,
      },
      data: {
        passwordHash,
        authVersion: ticket.authVersion + 1,
        isVerified: true,
        verifiedAt: user.verifiedAt || new Date(),
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('Không thể cập nhật mật khẩu do phiên làm việc đã thay đổi');
    }

    return {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới của bạn.',
    };
  }
}

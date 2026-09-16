import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { IUsersRepository } from '@/modules/users/interfaces/users-repository.interface';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto';
import { AuthTokens, AuthResponse, UserResponse } from './interfaces/auth.interface';
import { MailService } from './services/mail.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { User, AuthProvider } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(INJECT_TOKENS.USER_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existingUser = await this.usersRepository.findByEmail(dto.email);

    if (existingUser && existingUser.isVerified) {
      throw new ConflictException('Email này đã được đăng ký tài khoản');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    let user = existingUser;
    if (!user) {
      user = await this.usersRepository.create({
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        isVerified: false,
      });
    } else {
      user = await this.usersRepository.update(user.id, {
        passwordHash,
        fullName: dto.fullName,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      await this.redisClient.set(`otp:${dto.email.toLowerCase()}`, otp, 'EX', 600);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Redis set OTP failed: ${message}`);
    }

    await this.mailService.sendOtpEmail(dto.email, otp);

    return {
      message: 'Mã OTP xác thực đã được gửi tới email của bạn. Mã có hiệu lực trong 10 phút.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản với email này');
    }

    let storedOtp: string | null = null;
    try {
      storedOtp = await this.redisClient.get(`otp:${dto.email.toLowerCase()}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Redis get OTP failed: ${message}`);
    }

    if (!storedOtp || storedOtp !== dto.otp) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn');
    }

    try {
      await this.redisClient.del(`otp:${dto.email.toLowerCase()}`);
    } catch { /* non-fatal */ }

    const updatedUser = await this.usersRepository.update(user.id, {
      isVerified: true,
      verifiedAt: new Date(),
    });

    const tokens = await this.generateTokens(updatedUser);
    return { user: this.formatUserResponse(updatedUser), tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersRepository.findByEmail(dto.email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Tài khoản chưa được xác thực OTP. Vui lòng xác thực email.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const tokens = await this.generateTokens(user);
    return { user: this.formatUserResponse(user), tokens };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersRepository.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Tài khoản không hợp lệ');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh Token không hợp lệ hoặc đã hết hạn');
    }
  }

  /**
   * Revokes the current session token by jti — no need to re-decode the raw token.
   * jti and exp come directly from req.user (set by JwtStrategy.validate).
   */
  async logout(jti: string, exp: number, userId: string): Promise<void> {
    await this.tokenBlacklistService.revokeByJti(jti, exp, userId);
  }

  async validateOAuthUser(oauthProfile: {
    provider: string;
    providerUserId: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
  }): Promise<AuthResponse> {
    const existingIdentity = await this.usersRepository.findIdentity(
      oauthProfile.provider,
      oauthProfile.providerUserId,
    );

    let user: User | null = null;

    if (existingIdentity) {
      user = (existingIdentity as any).user || (await this.usersRepository.findById(existingIdentity.userId));
    } else {
      user = await this.usersRepository.findByEmail(oauthProfile.email);

      if (!user) {
        user = await this.usersRepository.create({
          email: oauthProfile.email,
          fullName: oauthProfile.fullName,
          avatarUrl: oauthProfile.avatarUrl,
          isVerified: true,
          verifiedAt: new Date(),
        });
      }

      await this.usersRepository.createIdentity({
        user: { connect: { id: user.id } },
        provider: oauthProfile.provider as AuthProvider,
        providerUserId: oauthProfile.providerUserId,
        identityData: oauthProfile as any,
      });
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    const tokens = await this.generateTokens(user);
    return { user: this.formatUserResponse(user), tokens };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Generates access + refresh tokens.
   * Each token embeds a unique `jti` (JWT ID) so it can be individually revoked.
   */
  private async generateTokens(user: User): Promise<AuthTokens> {
    const basePayload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...basePayload, jti: randomUUID() }, // jti enables per-token revocation
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1d') as any,
        },
      ),
      this.jwtService.signAsync(
        { ...basePayload, jti: randomUUID() },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private formatUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isVerified: user.isVerified,
    };
  }
}

import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { AUTH_CONSTANTS } from '@/common/constants/auth.constants';
import { IUsersRepository } from '@/modules/users/interfaces/users-repository.interface';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  VerifyResetOtpDto,
  ResetPasswordDto,
} from './dto';
import { AuthTokens, AuthResponse, UserResponse } from './interfaces/auth.interface';
import { MailService } from './services/mail.service';
import { OtpService } from './services/otp.service';
import { PasswordResetService } from './services/password-reset.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { User, AuthProvider } from '@prisma/client';

export interface RegisterResult {
  message: string;
  expiresIn: number;
  retryAfter: number;
  registrationId: string;
}

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
    private readonly otpService: OtpService,
    private readonly passwordResetService: PasswordResetService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  private hashVerificationToken(token: string): string {
    const secret =
      this.configService.get<string>('JWT_SECRET', 'tripgenie_verification_secret');
    return crypto.createHmac('sha256', secret).update(token).digest('hex');
  }

  /**
   * Helper: Atomic GET and DEL via Redis Lua script to prevent race conditions.
   * Guarantees single-use consumption even under concurrent requests.
   */
  public async atomicGetDel(key: string): Promise<string | null> {
    const luaScript = `
      local val = redis.call("get", KEYS[1])
      if val then
        redis.call("del", KEYS[1])
      end
      return val
    `;
    const result = await this.redisClient.eval(luaScript, 1, key);
    return typeof result === 'string' ? result : null;
  }

  /**
   * Đăng ký tài khoản bằng email & mật khẩu:
   * Lưu draft trong Redis với thời hạn 30 phút, gửi email link xác thực.
   * KHÔNG phát phiên hoặc cấp token khi chưa xác thực email.
   */
  async register(dto: RegisterDto): Promise<RegisterResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingUser = await this.usersRepository.findByEmail(normalizedEmail);

    if (existingUser && existingUser.isVerified) {
      throw new ConflictException('Email này đã được sử dụng bởi một tài khoản khác');
    }

    const registrationId = randomUUID();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashVerificationToken(rawToken);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const draft = {
      registrationId,
      email: normalizedEmail,
      fullName: dto.fullName.trim(),
      passwordHash,
      tokenHash,
      createdAt: Date.now(),
    };

    const tokenKey = `email_verification:token:${tokenHash}`;
    const regKey = `email_verification:reg:${registrationId}`;
    const cooldownKey = `email_verification:cooldown:${registrationId}`;

    await this.redisClient.set(
      tokenKey,
      JSON.stringify(draft),
      'EX',
      AUTH_CONSTANTS.EMAIL_VERIFICATION_TTL_SECONDS,
    );
    await this.redisClient.set(
      regKey,
      JSON.stringify(draft),
      'EX',
      AUTH_CONSTANTS.EMAIL_VERIFICATION_TTL_SECONDS,
    );
    await this.redisClient.set(
      cooldownKey,
      '1',
      'EX',
      AUTH_CONSTANTS.EMAIL_VERIFICATION_COOLDOWN_SECONDS,
    );

    const frontendUrl =
      this.configService.get<string>('FRONTEND_BASE_URL') ||
      process.env.FRONTEND_BASE_URL ||
      'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

    const emailSent = await this.mailService.sendVerificationLinkEmail(
      normalizedEmail,
      verificationUrl,
    );

    if (!emailSent) {
      await this.redisClient.del(tokenKey);
      await this.redisClient.del(regKey);
      await this.redisClient.del(cooldownKey);
      throw new ServiceUnavailableException(
        'Dịch vụ gửi email xác thực tạm thời không khả dụng. Vui lòng thử lại sau.',
      );
    }

    this.logger.log(`🔗 [DEV VERIFY LINK] Cho ${normalizedEmail}: ${verificationUrl}`);

    return {
      message: 'Đăng ký thành công! Vui lòng kiểm tra hộp thư email của bạn để xác thực tài khoản.',
      expiresIn: AUTH_CONSTANTS.EMAIL_VERIFICATION_TTL_SECONDS,
      retryAfter: AUTH_CONSTANTS.EMAIL_VERIFICATION_COOLDOWN_SECONDS,
      registrationId,
    };
  }

  /**
   * Xác thực tài khoản qua link email:
   * Consume verification token một lần duy nhất, lưu credentials và cấp phiên đăng nhập.
   */
  async verifyEmail(token: string): Promise<AuthResponse> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Mã xác thực email không hợp lệ');
    }

    const tokenHash = this.hashVerificationToken(token);
    const tokenKey = `email_verification:token:${tokenHash}`;

    const rawDraft = await this.atomicGetDel(tokenKey);
    if (!rawDraft) {
      throw new BadRequestException(
        'Đường link xác thực không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại.',
      );
    }

    let draft: {
      registrationId: string;
      email: string;
      fullName: string;
      passwordHash: string;
    };

    try {
      draft = JSON.parse(rawDraft);
    } catch {
      throw new BadRequestException('Dữ liệu xác thực không hợp lệ');
    }

    await this.redisClient.del(`email_verification:reg:${draft.registrationId}`);

    let user = await this.usersRepository.findByEmail(draft.email);
    if (user && user.isVerified) {
      throw new ConflictException('Email này đã được xác thực trước đó. Vui lòng đăng nhập.');
    }

    if (user) {
      user = await this.usersRepository.update(user.id, {
        fullName: draft.fullName,
        passwordHash: draft.passwordHash,
        isVerified: true,
        verifiedAt: new Date(),
      });
    } else {
      user = await this.usersRepository.create({
        email: draft.email,
        fullName: draft.fullName,
        passwordHash: draft.passwordHash,
        isVerified: true,
        verifiedAt: new Date(),
      });
    }

    const tokens = await this.generateTokens(user);
    const formattedUser = await this.formatUserResponse(user);
    return { user: formattedUser, tokens };
  }

  /**
   * Gửi lại email xác thực: Vô hiệu hóa link cũ và cấp link mới.
   */
  async resendVerificationEmail(registrationId: string): Promise<{
    message: string;
    expiresIn: number;
    retryAfter: number;
    registrationId: string;
  }> {
    const cooldownKey = `email_verification:cooldown:${registrationId}`;
    const remainingCooldown = await this.redisClient.ttl(cooldownKey);
    if (remainingCooldown > 0) {
      throw new BadRequestException(
        `Vui lòng đợi ${remainingCooldown} giây trước khi yêu cầu gửi lại email xác thực`,
      );
    }

    const regKey = `email_verification:reg:${registrationId}`;
    const rawReg = await this.redisClient.get(regKey);
    if (!rawReg) {
      throw new BadRequestException(
        'Phiên đăng ký đã hết hạn hoặc không tồn tại. Vui lòng đăng ký lại.',
      );
    }

    const draft = JSON.parse(rawReg);
    if (draft.tokenHash) {
      await this.redisClient.del(`email_verification:token:${draft.tokenHash}`);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashVerificationToken(rawToken);
    draft.tokenHash = tokenHash;

    const tokenKey = `email_verification:token:${tokenHash}`;
    await this.redisClient.set(
      tokenKey,
      JSON.stringify(draft),
      'EX',
      AUTH_CONSTANTS.EMAIL_VERIFICATION_TTL_SECONDS,
    );
    await this.redisClient.set(
      regKey,
      JSON.stringify(draft),
      'EX',
      AUTH_CONSTANTS.EMAIL_VERIFICATION_TTL_SECONDS,
    );
    await this.redisClient.set(
      cooldownKey,
      '1',
      'EX',
      AUTH_CONSTANTS.EMAIL_VERIFICATION_COOLDOWN_SECONDS,
    );

    const frontendUrl =
      this.configService.get<string>('FRONTEND_BASE_URL') ||
      process.env.FRONTEND_BASE_URL ||
      'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

    const emailSent = await this.mailService.sendVerificationLinkEmail(
      draft.email,
      verificationUrl,
    );

    if (!emailSent) {
      throw new ServiceUnavailableException(
        'Dịch vụ gửi email xác thực tạm thời không khả dụng. Vui lòng thử lại sau.',
      );
    }

    this.logger.log(`🔗 [DEV RESEND VERIFY LINK] Cho ${draft.email}: ${verificationUrl}`);

    return {
      message: 'Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư của bạn.',
      expiresIn: AUTH_CONSTANTS.EMAIL_VERIFICATION_TTL_SECONDS,
      retryAfter: AUTH_CONSTANTS.EMAIL_VERIFICATION_COOLDOWN_SECONDS,
      registrationId,
    };
  }

  /**
   * Đăng nhập bằng email hoặc tên tài khoản (hỗ trợ tài khoản legacy).
   * Kiểm tra mật khẩu trước, nếu tài khoản chưa kích hoạt trả về EMAIL_NOT_VERIFIED.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const trimmedIdentifier = dto.identifier.trim();
    const user = await this.usersRepository.findByIdentifier(trimmedIdentifier);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    if (!user.isVerified) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email để xác thực tài khoản.',
      });
    }

    const tokens = await this.generateTokens(user);
    const formattedUser = await this.formatUserResponse(user);
    return { user: formattedUser, tokens };
  }

  /**
   * Xử lý OAuth callback cho Google (chỉ đăng nhập/đăng ký mới, không còn mode link).
   */
  async handleOAuthCallback(oauthProfile: {
    provider: string;
    providerUserId: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
  }): Promise<{ mode: 'login'; authResponse: AuthResponse }> {
    const authResponse = await this.validateOAuthUser(oauthProfile);
    return { mode: 'login', authResponse };
  }

  async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    return this.formatUserResponse(user);
  }

  /**
   * Đăng nhập thông qua Google:
   * Chỉ cho phép khi identity có canSignIn = true hoặc tạo mới Google-only user.
   */
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
      if (!existingIdentity.canSignIn) {
        throw new UnauthorizedException(
          'Tài khoản này chỉ được liên kết Gmail để nhận thông báo hoặc khôi phục mật khẩu. Vui lòng đăng nhập bằng tên tài khoản và mật khẩu.',
        );
      }

      user =
        (existingIdentity as any).user ||
        (await this.usersRepository.findById(existingIdentity.userId));
    } else {
      const normalizedEmail = oauthProfile.email.toLowerCase().trim();
      user = await this.usersRepository.findByEmail(normalizedEmail);

      if (user) {
        throw new ConflictException(
          'Email này đã được sử dụng bởi một tài khoản khác. Vui lòng đăng nhập bằng mật khẩu.',
        );
      } else {
        user = await this.usersRepository.create({
          email: normalizedEmail,
          fullName: oauthProfile.fullName,
          avatarUrl: oauthProfile.avatarUrl,
          isVerified: true,
          verifiedAt: new Date(),
        });

        await this.usersRepository.createIdentity({
          user: { connect: { id: user.id } },
          provider: oauthProfile.provider as AuthProvider,
          providerUserId: oauthProfile.providerUserId,
          canSignIn: true,
          identityData: oauthProfile as any,
        });
      }
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa hoặc không tồn tại');
    }

    const tokens = await this.generateTokens(user);
    const formattedUser = await this.formatUserResponse(user);
    return { user: formattedUser, tokens };
  }

  async resendOtp(
    dto: ResendOtpDto,
  ): Promise<{ message: string; expiresIn: number; retryAfter: number }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.usersRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản với email này');
    }

    if (user.isVerified && dto.purpose !== 'password-reset') {
      throw new BadRequestException('Tài khoản đã được xác thực');
    }

    const purpose = dto.purpose || 'email-verification';
    return this.otpService.generateAndSendOtp(normalizedEmail, purpose);
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.usersRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản với email này');
    }

    await this.otpService.verifyOtp(normalizedEmail, dto.otp, 'email-verification');

    const updatedUser = await this.usersRepository.update(user.id, {
      isVerified: true,
      verifiedAt: new Date(),
    });

    const tokens = await this.generateTokens(updatedUser);
    const formattedUser = await this.formatUserResponse(updatedUser);
    return { user: formattedUser, tokens };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; expiresIn: number; retryAfter: number }> {
    return this.passwordResetService.forgotPassword(dto.email);
  }

  async verifyResetOtp(
    dto: VerifyResetOtpDto,
  ): Promise<{ resetTicket: string; expiresIn: number }> {
    return this.passwordResetService.verifyResetOtp(dto.email, dto.otp);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.passwordResetService.resetPassword(dto.resetTicket, dto.password);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.jti) {
        const isRevoked = await this.tokenBlacklistService.isBlacklisted(payload.jti);
        if (isRevoked) {
          throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
        }
      }

      const user = await this.usersRepository.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Tài khoản không hợp lệ hoặc đã bị khóa');
      }

      const currentAuthVersion = user.authVersion ?? 0;
      const tokenAuthVersion = payload.authVersion ?? 0;
      if (tokenAuthVersion !== currentAuthVersion) {
        throw new UnauthorizedException('Phiên làm việc đã hết hạn do thay đổi tài khoản');
      }

      return this.generateTokens(user);
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  async logout(userId: string, options: { accessToken?: string; refreshToken?: string }): Promise<void> {
    const tryRevoke = async (token?: string) => {
      if (!token) return;
      try {
        await this.tokenBlacklistService.revokeAccessToken(token);
      } catch {
        // Non-blocking revocation failure
      }
    };

    await Promise.all([
      tryRevoke(options.accessToken),
      tryRevoke(options.refreshToken),
    ]);
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const basePayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      authVersion: user.authVersion ?? 0,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...basePayload, jti: randomUUID() },
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

  public async formatUserResponse(user: User): Promise<UserResponse> {
    const userWithIdentities = await this.usersRepository.findUserWithIdentities(user.id);
    const identities = userWithIdentities?.identities || [];

    const authMethods: ('LOCAL' | 'GOOGLE')[] = [];
    if (user.passwordHash) {
      authMethods.push('LOCAL');
    }
    if (identities.some((identity) => identity.provider === 'GOOGLE')) {
      authMethods.push('GOOGLE');
    }

    const hasVerifiedEmail = Boolean(user.email && user.isVerified);
    const canResetPasswordByEmail = Boolean(
      user.passwordHash && user.email && user.isVerified,
    );

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isVerified: user.isVerified,
      authMethods,
      capabilities: {
        hasVerifiedEmail,
        hasGoogleEmailLink: false,
        canResetPasswordByEmail,
      },
    };
  }
}

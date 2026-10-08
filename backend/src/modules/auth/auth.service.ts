import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { IUsersRepository } from '@/modules/users/interfaces/users-repository.interface';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  VerifyResetOtpDto,
  ResetPasswordDto,
  ReauthenticateDto,
  StartGoogleLinkDto,
} from './dto';
import { AuthTokens, AuthResponse, UserResponse } from './interfaces/auth.interface';
import { MailService } from './services/mail.service';
import { OtpService } from './services/otp.service';
import { PasswordResetService } from './services/password-reset.service';
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
    private readonly otpService: OtpService,
    private readonly passwordResetService: PasswordResetService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  /**
   * Đăng ký tài khoản thường bằng username & password.
   * Không bắt buộc email/OTP; trả về AuthResponse và phiên đăng nhập ngay.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const trimmedUsername = dto.username.trim().toLowerCase();
    const existingUser = await this.usersRepository.findByUsername(trimmedUsername);

    if (existingUser) {
      throw new ConflictException('Tên tài khoản này đã được sử dụng');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.usersRepository.create({
      username: trimmedUsername,
      passwordHash,
      fullName: dto.fullName.trim(),
      email: null,
      isVerified: false,
    });

    const tokens = await this.generateTokens(user);
    const formattedUser = await this.formatUserResponse(user);
    return { user: formattedUser, tokens };
  }

  /**
   * Đăng nhập bằng tên tài khoản hoặc email (legacy).
   * Không chặn tài khoản chưa xác minh email (isVerified = false).
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const trimmedIdentifier = dto.identifier.trim();
    const user = await this.usersRepository.findByIdentifier(trimmedIdentifier);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    const tokens = await this.generateTokens(user);
    const formattedUser = await this.formatUserResponse(user);
    return { user: formattedUser, tokens };
  }

  /**
   * Xác thực lại mật khẩu của người dùng hiện tại để cấp grantToken ngắn hạn (5 phút).
   */
  async reauthenticate(
    userId: string,
    dto: ReauthenticateDto,
  ): Promise<{ grantToken: string; expiresIn: number }> {
    const user = await this.usersRepository.findById(userId);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Tài khoản không hỗ trợ xác thực bằng mật khẩu');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Mật khẩu không chính xác');
    }

    const grantToken = randomUUID();
    const grantKey = `reauth_grant:${grantToken}`;
    const ttlSeconds = 300; // 5 mins

    await this.redisClient.set(
      grantKey,
      JSON.stringify({ userId }),
      'EX',
      ttlSeconds,
    );

    return { grantToken, expiresIn: ttlSeconds };
  }

  /**
   * Khởi tạo quá trình liên kết Google email an toàn bằng grantToken.
   * Sinh state lưu trong Redis và trả về URL ủy quyền Google.
   */
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
   * Khởi tạo quá trình liên kết Google email an toàn bằng grantToken.
   * Sinh state lưu trong Redis và trả về URL ủy quyền Google.
   */
  async startGoogleLink(
    userId: string,
    dto: StartGoogleLinkDto,
  ): Promise<{ url: string; state: string; browserNonce: string }> {
    const grantKey = `reauth_grant:${dto.grantToken}`;
    // Atomically consume grant token to prevent concurrent replay
    const rawGrant = await this.atomicGetDel(grantKey);

    if (!rawGrant) {
      throw new UnauthorizedException('Mã xác thực lại đã hết hạn, không hợp lệ hoặc đã được sử dụng');
    }

    const grant = JSON.parse(rawGrant);
    if (grant.userId !== userId) {
      throw new UnauthorizedException('Mã xác thực lại không khớp với tài khoản hiện tại');
    }

    const userWithIdentities = await this.usersRepository.findUserWithIdentities(userId);
    if (!userWithIdentities) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const hasGoogle = userWithIdentities.identities?.some(
      (identity) => identity.provider === 'GOOGLE',
    );
    if (hasGoogle) {
      throw new ConflictException('Tài khoản này đã được liên kết với Google');
    }

    const state = randomUUID();
    const browserNonce = randomUUID();
    const stateKey = `oauth_state:${state}`;
    const ttlSeconds = 600; // 10 mins

    await this.redisClient.set(
      stateKey,
      JSON.stringify({
        purpose: 'link-email',
        userId,
        authVersion: userWithIdentities.authVersion ?? 0,
        browserNonce,
        returnUrl: dto.returnUrl || '/profile',
      }),
      'EX',
      ttlSeconds,
    );

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL', '');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
      browserNonce,
    };
  }

  /**
   * Xử lý OAuth callback cho Google: Phân tách rõ ràng giữa Login và Link Email.
   * State được bind chặt chẽ với browser nonce, user id và authVersion.
   */
  async handleOAuthCallback(
    oauthProfile: {
      provider: string;
      providerUserId: string;
      email: string;
      fullName: string;
      avatarUrl?: string;
    },
    state?: string,
    options?: {
      browserNonce?: string;
      currentUserId?: string;
    },
  ): Promise<
    | { mode: 'login'; authResponse: AuthResponse }
    | { mode: 'link'; returnUrl: string }
  > {
    if (state) {
      const stateKey = `oauth_state:${state}`;
      // Atomically consume state to prevent concurrent replay attacks
      const rawState = await this.atomicGetDel(stateKey);

      if (!rawState) {
        throw new BadRequestException('Trạng thái xác thực không hợp lệ, đã hết hạn hoặc đã được sử dụng');
      }

      const parsedState = JSON.parse(rawState);

      if (parsedState.purpose === 'link-email') {
        // 1. Current user login session is MANDATORY for linking Gmail as required by plan
        if (!options?.currentUserId) {
          throw new UnauthorizedException(
            'Phiên đăng nhập đã hết hạn hoặc không tồn tại. Vui lòng đăng nhập lại để liên kết Gmail.',
          );
        }

        // 2. Current session must match the initiator's userId
        if (options.currentUserId !== parsedState.userId) {
          throw new UnauthorizedException(
            'Tài khoản đăng nhập hiện tại không khớp với tài khoản yêu cầu liên kết ban đầu',
          );
        }

        // 3. Verify browser nonce cookie
        if (!options?.browserNonce || options.browserNonce !== parsedState.browserNonce) {
          throw new UnauthorizedException('Phiên trình duyệt không khớp với yêu cầu liên kết');
        }

        // 4. Verify user in database
        const targetUser = await this.usersRepository.findById(parsedState.userId);
        if (!targetUser || !targetUser.isActive) {
          throw new UnauthorizedException('Tài khoản người dùng không tồn tại hoặc đã bị khóa');
        }

        if ((targetUser.authVersion ?? 0) !== parsedState.authVersion) {
          throw new UnauthorizedException('Phiên liên kết bị hủy do tài khoản đã thay đổi');
        }

        await this.linkGoogleEmail(parsedState.userId, oauthProfile);
        return {
          mode: 'link',
          returnUrl: parsedState.returnUrl || '/profile',
        };
      }

      throw new BadRequestException('Mục đích xác thực không hợp lệ');
    }

    // Default flow: Google Login
    const authResponse = await this.validateOAuthUser(oauthProfile);
    return { mode: 'login', authResponse };
  }

  /**
   * Liên kết Google email an toàn cho tài khoản local:
   * - canSignIn = false (chống bypass mật khẩu)
   * - 1 email chỉ thuộc 1 tài khoản
   */
  private async linkGoogleEmail(
    userId: string,
    oauthProfile: {
      provider: string;
      providerUserId: string;
      email: string;
      fullName: string;
      avatarUrl?: string;
    },
  ): Promise<User> {
    const normalizedEmail = oauthProfile.email.toLowerCase().trim();

    // 1. Kiểm tra email đã thuộc user khác chưa
    const userWithEmail = await this.usersRepository.findByEmail(normalizedEmail);
    if (userWithEmail && userWithEmail.id !== userId) {
      throw new ConflictException('Email này đã được sử dụng bởi một tài khoản khác');
    }

    // 2. Kiểm tra Google providerUserId đã thuộc user khác chưa
    const existingIdentity = await this.usersRepository.findIdentity(
      'GOOGLE',
      oauthProfile.providerUserId,
    );
    if (existingIdentity && existingIdentity.userId !== userId) {
      throw new ConflictException('Tài khoản Google này đã được liên kết với người dùng khác');
    }

    // 3. Kiểm tra user hiện tại
    const currentUser = await this.usersRepository.findUserWithIdentities(userId);
    if (!currentUser) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    if (currentUser.email && currentUser.email.toLowerCase() !== normalizedEmail) {
      throw new ConflictException(
        'Tài khoản đã có email khác, không thể ghi đè địa chỉ email liên kết',
      );
    }

    // 4. Tạo identity nếu chưa có (canSignIn = false)
    if (!existingIdentity) {
      await this.usersRepository.createIdentity({
        user: { connect: { id: userId } },
        provider: AuthProvider.GOOGLE,
        providerUserId: oauthProfile.providerUserId,
        canSignIn: false,
        identityData: oauthProfile as any,
      });
    }

    // 5. Cập nhật user email & isVerified
    return this.usersRepository.update(userId, {
      email: normalizedEmail,
      isVerified: true,
      verifiedAt: currentUser.verifiedAt || new Date(),
    });
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
        // 1 email chỉ thuộc 1 tài khoản, không tự gộp
        throw new ConflictException(
          'Email này đã được sử dụng bởi một tài khoản khác. Vui lòng đăng nhập và liên kết tài khoản trong trang cá nhân.',
        );
      } else {
        // Tạo tài khoản Google mới (Google-only, canSignIn = true)
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
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    const tokens = await this.generateTokens(user);
    const formattedUser = await this.formatUserResponse(user);
    return { user: formattedUser, tokens };
  }

  // ---------------------------------------------------------------------------
  // OTP & Recovery methods
  // ---------------------------------------------------------------------------

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

      if (payload.jti && payload.exp) {
        await this.tokenBlacklistService.revokeByJti(payload.jti, payload.exp, user.id);
      }

      return this.generateTokens(user);
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Refresh Token không hợp lệ hoặc đã hết hạn');
    }
  }

  async logout(jti: string, exp: number, userId: string): Promise<void> {
    await this.tokenBlacklistService.revokeByJti(jti, exp, userId);
  }

  /**
   * Safely revokes available session tokens (even if expired) and prevents replay.
   */
  async performLogout(options: {
    accessToken?: string;
    refreshToken?: string;
  }): Promise<void> {
    const tryRevoke = async (token?: string, secretKeyName = 'JWT_SECRET') => {
      if (!token) return;
      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>(secretKeyName),
          ignoreExpiration: true,
        });
        if (payload?.jti && payload?.exp && payload?.sub) {
          await this.tokenBlacklistService.revokeByJti(
            payload.jti,
            payload.exp,
            payload.sub,
          );
        }
      } catch {
        // Ignore verify error for malformed tokens
      }
    };

    await Promise.all([
      tryRevoke(options.accessToken, 'JWT_SECRET'),
      tryRevoke(options.refreshToken, 'JWT_REFRESH_SECRET'),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
    const hasGoogleEmailLink = Boolean(
      user.email &&
        user.isVerified &&
        identities.some((identity) => identity.provider === 'GOOGLE'),
    );
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
        hasGoogleEmailLink,
        canResetPasswordByEmail,
      },
    };
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { MailService } from './services/mail.service';
import { OtpService } from './services/otp.service';
import { PasswordResetService } from './services/password-reset.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUsersRepository: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockMailService: any;
  let mockOtpService: any;
  let mockPasswordResetService: any;
  let mockRedisClient: any;
  let mockTokenBlacklistService: any;

  beforeEach(async () => {
    mockUsersRepository = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findByIdentifier: jest.fn(),
      findById: jest.fn(),
      findUserWithIdentities: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findIdentity: jest.fn(),
      createIdentity: jest.fn(),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock_token'),
      verify: jest.fn(),
      decode: jest.fn().mockReturnValue({ jti: 'mock_jti', exp: Math.floor(Date.now() / 1000) + 3600 }),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'JWT_SECRET') return 'secret';
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        if (key === 'GOOGLE_CLIENT_ID') return 'google_id';
        if (key === 'GOOGLE_CALLBACK_URL') return 'http://localhost:3000/api/v1/auth/google/callback';
        return defaultValue;
      }),
    };

    mockMailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(true),
      sendVerificationLinkEmail: jest.fn().mockResolvedValue(true),
    };

    mockOtpService = {
      generateAndSendOtp: jest.fn().mockResolvedValue({
        message: 'Mã OTP đã gửi',
        expiresIn: 600,
        retryAfter: 60,
      }),
      verifyOtp: jest.fn().mockResolvedValue(true),
    };

    mockPasswordResetService = {
      forgotPassword: jest.fn().mockResolvedValue({
        message: 'Mã OTP đã gửi nếu tồn tại',
        expiresIn: 600,
        retryAfter: 60,
      }),
      verifyResetOtp: jest.fn().mockResolvedValue({
        resetTicket: 'mock_ticket',
        expiresIn: 300,
      }),
      resetPassword: jest.fn().mockResolvedValue({
        message: 'Đặt lại mật khẩu thành công',
      }),
    };

    const redisStore = new Map<string, string>();
    mockRedisClient = {
      set: jest.fn().mockImplementation(async (key: string, val: string) => {
        redisStore.set(key, val);
        return 'OK';
      }),
      get: jest.fn().mockImplementation(async (key: string) => {
        return redisStore.get(key) || null;
      }),
      del: jest.fn().mockImplementation(async (key: string) => {
        return redisStore.delete(key) ? 1 : 0;
      }),
      ttl: jest.fn().mockResolvedValue(-1),
      eval: jest.fn().mockImplementation(async (_script: string, _numKeys: number, key: string) => {
        const val = redisStore.get(key) || null;
        if (val) {
          redisStore.delete(key);
        }
        return val;
      }),
    };

    mockTokenBlacklistService = {
      revokeAccessToken: jest.fn().mockResolvedValue(undefined),
      revokeByJti: jest.fn().mockResolvedValue(undefined),
      isBlacklisted: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: INJECT_TOKENS.USER_REPOSITORY, useValue: mockUsersRepository },
        { provide: 'REDIS_CLIENT', useValue: mockRedisClient },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: PasswordResetService, useValue: mockPasswordResetService },
        { provide: TokenBlacklistService, useValue: mockTokenBlacklistService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('nên ném ra ConflictException nếu email đã tồn tại và đã xác thực', async () => {
      mockUsersRepository.findByEmail.mockResolvedValue({
        id: '1',
        email: 'traveler1@example.com',
        isVerified: true,
      });

      await expect(
        authService.register({
          email: 'traveler1@example.com',
          password: 'Password123!',
          fullName: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('nên lưu draft vào Redis, gửi email xác thực và trả về registrationId mà không cấp session', async () => {
      mockUsersRepository.findByEmail.mockResolvedValue(null);

      const result = await authService.register({
        email: 'traveler1@example.com',
        password: 'Password123!',
        fullName: 'Test User',
      });

      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(mockMailService.sendVerificationLinkEmail).toHaveBeenCalledWith(
        'traveler1@example.com',
        expect.stringContaining('/verify-email?token='),
      );
      expect(result.registrationId).toBeDefined();
      expect(result.message).toContain('xác thực tài khoản');
      expect((result as any).tokens).toBeUndefined();
    });
  });

  describe('verifyEmail', () => {
    it('nên từ chối nếu token không hợp lệ hoặc đã hết hạn', async () => {
      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(BadRequestException);
    });

    it('nên tạo tài khoản và cấp phiên khi token hợp lệ', async () => {
      const regId = 'reg-123';
      const email = 'newuser@example.com';
      const token = 'valid-token-32-chars-long-test-string-here';
      const tokenHash = (authService as any).hashVerificationToken(token);

      await mockRedisClient.set(
        `email_verification:token:${tokenHash}`,
        JSON.stringify({
          registrationId: regId,
          email,
          fullName: 'New User',
          passwordHash: 'hashed_pwd',
        }),
      );

      const createdUser = {
        id: 'user-new',
        email,
        fullName: 'New User',
        isVerified: true,
        role: 'USER',
      };
      mockUsersRepository.findByEmail.mockResolvedValue(null);
      mockUsersRepository.create.mockResolvedValue(createdUser);
      mockUsersRepository.findUserWithIdentities.mockResolvedValue({
        ...createdUser,
        identities: [],
      });

      const result = await authService.verifyEmail(token);
      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          fullName: 'New User',
          isVerified: true,
        }),
      );
      expect(result.tokens).toBeDefined();
      expect(result.user.email).toBe(email);
    });
  });

  describe('login', () => {
    it('nên từ chối đăng nhập nếu sai mật khẩu', async () => {
      const passwordHash = await bcrypt.hash('ValidPassword123!', 10);
      mockUsersRepository.findByIdentifier.mockResolvedValue({
        id: 'user-1',
        passwordHash,
        isActive: true,
        isVerified: true,
      });

      await expect(
        authService.login({
          identifier: 'user@example.com',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('nên ném ForbiddenException với code EMAIL_NOT_VERIFIED nếu tài khoản chưa kích hoạt', async () => {
      const passwordHash = await bcrypt.hash('ValidPassword123!', 10);
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash,
        isActive: true,
        isVerified: false,
        role: 'USER',
      };
      mockUsersRepository.findByIdentifier.mockResolvedValue(user);

      try {
        await authService.login({
          identifier: 'user@example.com',
          password: 'ValidPassword123!',
        });
        fail('Should have thrown ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()?.code).toBe('EMAIL_NOT_VERIFIED');
      }
    });

    it('nên đăng nhập thành công khi đúng mật khẩu và tài khoản đã kích hoạt', async () => {
      const passwordHash = await bcrypt.hash('ValidPassword123!', 10);
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash,
        isActive: true,
        isVerified: true,
        role: 'USER',
      };
      mockUsersRepository.findByIdentifier.mockResolvedValue(user);
      mockUsersRepository.findUserWithIdentities.mockResolvedValue({
        ...user,
        identities: [],
      });

      const result = await authService.login({
        identifier: 'user@example.com',
        password: 'ValidPassword123!',
      });

      expect(result.tokens).toBeDefined();
      expect(result.user.id).toBe('user-1');
    });
  });

  describe('Google OAuth login', () => {
    it('validateOAuthUser nên từ chối login nếu identity có canSignIn = false', async () => {
      mockUsersRepository.findIdentity.mockResolvedValue({
        id: 'id-1',
        userId: 'user-1',
        canSignIn: false,
      });

      await expect(
        authService.validateOAuthUser({
          provider: 'GOOGLE',
          providerUserId: 'g-123',
          email: 'test@gmail.com',
          fullName: 'Test Google',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('validateOAuthUser nên tạo mới Google user nếu chưa tồn tại', async () => {
      mockUsersRepository.findIdentity.mockResolvedValue(null);
      mockUsersRepository.findByEmail.mockResolvedValue(null);
      const createdUser = {
        id: 'g-user-1',
        email: 'newgoogle@gmail.com',
        fullName: 'Google User',
        isVerified: true,
        isActive: true,
      };
      mockUsersRepository.create.mockResolvedValue(createdUser);
      mockUsersRepository.findUserWithIdentities.mockResolvedValue({
        ...createdUser,
        identities: [{ provider: 'GOOGLE' }],
      });

      const res = await authService.validateOAuthUser({
        provider: 'GOOGLE',
        providerUserId: 'g-999',
        email: 'newgoogle@gmail.com',
        fullName: 'Google User',
      });

      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newgoogle@gmail.com',
          isVerified: true,
        }),
      );
      expect(mockUsersRepository.createIdentity).toHaveBeenCalledWith(
        expect.objectContaining({
          canSignIn: true,
        }),
      );
      expect(res.tokens).toBeDefined();
    });
  });
});

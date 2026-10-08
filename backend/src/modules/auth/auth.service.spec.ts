import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
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

    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockImplementation(async (_script: string, _numKeys: number, key: string) => {
        const val = await mockRedisClient.get(key);
        if (val) {
          await mockRedisClient.del(key);
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
    it('nên ném ra ConflictException nếu username đã tồn tại', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: '1',
        username: 'traveler1',
      });

      await expect(
        authService.register({
          username: 'traveler1',
          password: 'Password123456789!',
          fullName: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('nên tạo user mới bằng username, không bắt email/OTP và trả tokens ngay', async () => {
      mockUsersRepository.findByUsername.mockResolvedValue(null);
      const createdUser = {
        id: '1',
        username: 'traveler1',
        fullName: 'Test User',
        email: null,
        isVerified: false,
        role: 'USER',
        passwordHash: 'hashed_pwd',
      };
      mockUsersRepository.create.mockResolvedValue(createdUser);
      mockUsersRepository.findUserWithIdentities.mockResolvedValue({
        ...createdUser,
        identities: [],
      });

      const result = await authService.register({
        username: 'traveler1',
        password: 'Password123456789!',
        fullName: 'Test User',
      });

      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'traveler1',
          fullName: 'Test User',
          email: null,
          isVerified: false,
        }),
      );
      expect(result.tokens).toBeDefined();
      expect(result.user.username).toBe('traveler1');
      expect(result.user.capabilities.hasVerifiedEmail).toBe(false);
    });
  });

  describe('login', () => {
    it('nên đăng nhập thành công bằng identifier và mật khẩu dù tài khoản chưa xác minh email', async () => {
      const passwordHash = await bcrypt.hash('ValidPassword123456', 10);
      const user = {
        id: 'user-1',
        username: 'traveler1',
        passwordHash,
        isActive: true,
        isVerified: false,
        role: 'USER',
      };
      mockUsersRepository.findByIdentifier.mockResolvedValue(user);
      mockUsersRepository.findUserWithIdentities.mockResolvedValue({
        ...user,
        identities: [],
      });

      const result = await authService.login({
        identifier: 'traveler1',
        password: 'ValidPassword123456',
      });

      expect(result.tokens).toBeDefined();
      expect(result.user.id).toBe('user-1');
    });

    it('nên từ chối đăng nhập nếu sai mật khẩu', async () => {
      const passwordHash = await bcrypt.hash('ValidPassword123456', 10);
      mockUsersRepository.findByIdentifier.mockResolvedValue({
        id: 'user-1',
        passwordHash,
        isActive: true,
      });

      await expect(
        authService.login({
          identifier: 'traveler1',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('reauthenticate & startGoogleLink', () => {
    it('nên phát sinh grantToken khi mật khẩu xác thực lại chính xác', async () => {
      const passwordHash = await bcrypt.hash('Secret123456789!', 10);
      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash,
      });

      const res = await authService.reauthenticate('user-1', {
        password: 'Secret123456789!',
      });

      expect(res.grantToken).toBeDefined();
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('reauth_grant:'),
        JSON.stringify({ userId: 'user-1' }),
        'EX',
        300,
      );
    });

    it('startGoogleLink nên từ chối nếu grantToken không tồn tại hoặc sai user', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        authService.startGoogleLink('user-1', { grantToken: 'invalid-grant' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Google OAuth login & link mode', () => {
    it('validateOAuthUser nên từ chối login bằng Google nếu identity có canSignIn = false', async () => {
      mockUsersRepository.findIdentity.mockResolvedValue({
        id: 'id-1',
        userId: 'user-1',
        canSignIn: false, // Local user link Gmail only
      });

      await expect(
        authService.validateOAuthUser({
          provider: 'GOOGLE',
          providerUserId: 'google-sub-123',
          email: 'user@gmail.com',
          fullName: 'Google User',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('handleOAuthCallback nên từ chối ngay lập tức nếu state không tồn tại trong Redis, không fall-through sang login', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        authService.handleOAuthCallback(
          {
            provider: 'GOOGLE',
            providerUserId: 'google-sub-123',
            email: 'user@gmail.com',
            fullName: 'Google User',
          },
          'invalid-or-expired-state',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('handleOAuthCallback mode link nên từ chối nếu thiếu phiên đăng nhập hiện tại (currentUserId)', async () => {
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          purpose: 'link-email',
          userId: 'user-1',
          authVersion: 0,
          browserNonce: 'nonce-123',
          returnUrl: '/profile',
        }),
      );

      await expect(
        authService.handleOAuthCallback(
          {
            provider: 'GOOGLE',
            providerUserId: 'google-sub-123',
            email: 'linked@gmail.com',
            fullName: 'Google User',
          },
          'state-123',
          { browserNonce: 'nonce-123' }, // missing currentUserId
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('handleOAuthCallback mode link nên từ chối nếu phiên đăng nhập khác với tài khoản yêu cầu', async () => {
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          purpose: 'link-email',
          userId: 'user-1',
          authVersion: 0,
          browserNonce: 'nonce-123',
          returnUrl: '/profile',
        }),
      );

      await expect(
        authService.handleOAuthCallback(
          {
            provider: 'GOOGLE',
            providerUserId: 'google-sub-123',
            email: 'linked@gmail.com',
            fullName: 'Google User',
          },
          'state-123',
          { browserNonce: 'nonce-123', currentUserId: 'user-different' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('handleOAuthCallback mode link nên từ chối nếu browserNonce không khớp', async () => {
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          purpose: 'link-email',
          userId: 'user-1',
          authVersion: 0,
          browserNonce: 'correct-nonce-123',
          returnUrl: '/profile',
        }),
      );

      await expect(
        authService.handleOAuthCallback(
          {
            provider: 'GOOGLE',
            providerUserId: 'google-sub-123',
            email: 'linked@gmail.com',
            fullName: 'Google User',
          },
          'state-123',
          { browserNonce: 'wrong-nonce-456', currentUserId: 'user-1' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('handleOAuthCallback mode link nên tạo identity canSignIn = false và cập nhật email khi hợp lệ', async () => {
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          purpose: 'link-email',
          userId: 'user-1',
          authVersion: 0,
          browserNonce: 'nonce-123',
          returnUrl: '/profile',
        }),
      );

      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        authVersion: 0,
      });
      mockUsersRepository.findByEmail.mockResolvedValue(null);
      mockUsersRepository.findIdentity.mockResolvedValue(null);
      mockUsersRepository.findUserWithIdentities.mockResolvedValue({
        id: 'user-1',
        email: null,
        authVersion: 0,
        identities: [],
      });
      mockUsersRepository.update.mockResolvedValue({
        id: 'user-1',
        email: 'linked@gmail.com',
        isVerified: true,
      });

      const result = await authService.handleOAuthCallback(
        {
          provider: 'GOOGLE',
          providerUserId: 'google-sub-123',
          email: 'linked@gmail.com',
          fullName: 'Google User',
        },
        'state-123',
        { browserNonce: 'nonce-123', currentUserId: 'user-1' },
      );

      expect(result.mode).toBe('link');
      expect(mockUsersRepository.createIdentity).toHaveBeenCalledWith(
        expect.objectContaining({
          canSignIn: false,
          providerUserId: 'google-sub-123',
        }),
      );
      expect(mockUsersRepository.update).toHaveBeenCalledWith('user-1', {
        email: 'linked@gmail.com',
        isVerified: true,
        verifiedAt: expect.any(Date),
      });
    });

    it('handleOAuthCallback mode link nên từ chối nếu email Google đã thuộc về tài khoản khác', async () => {
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          purpose: 'link-email',
          userId: 'user-1',
          authVersion: 0,
          browserNonce: 'nonce-123',
          returnUrl: '/profile',
        }),
      );

      mockUsersRepository.findById.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        authVersion: 0,
      });
      mockUsersRepository.findByEmail.mockResolvedValue({
        id: 'user-different',
        email: 'taken@gmail.com',
      });

      await expect(
        authService.handleOAuthCallback(
          {
            provider: 'GOOGLE',
            providerUserId: 'google-sub-123',
            email: 'taken@gmail.com',
            fullName: 'Google User',
          },
          'state-123',
          { browserNonce: 'nonce-123', currentUserId: 'user-1' },
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('performLogout', () => {
    it('thu hồi cả accessToken và refreshToken qua tokenBlacklistService', async () => {
      mockJwtService.verify
        .mockReturnValueOnce({ jti: 'jti-access', exp: 1234567, sub: 'user-1' })
        .mockReturnValueOnce({ jti: 'jti-refresh', exp: 1234567, sub: 'user-1' });

      await authService.performLogout({
        accessToken: 'valid-access',
        refreshToken: 'valid-refresh',
      });

      expect(mockTokenBlacklistService.revokeByJti).toHaveBeenCalledWith(
        'jti-access',
        1234567,
        'user-1',
      );
      expect(mockTokenBlacklistService.revokeByJti).toHaveBeenCalledWith(
        'jti-refresh',
        1234567,
        'user-1',
      );
    });
  });
});

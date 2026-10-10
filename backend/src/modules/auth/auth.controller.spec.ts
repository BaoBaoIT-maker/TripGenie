import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenBlacklistService } from './services/token-blacklist.service';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;
  let mockConfigService: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn().mockResolvedValue({
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản.',
        expiresIn: 1800,
        retryAfter: 60,
        registrationId: 'reg-uuid-1',
      }),
      verifyEmail: jest.fn().mockResolvedValue({
        user: { id: '1', email: 'traveler1@example.com', fullName: 'Test' },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      }),
      resendVerificationEmail: jest.fn().mockResolvedValue({
        message: 'Email xác thực mới đã được gửi.',
        expiresIn: 1800,
        retryAfter: 60,
      }),
      login: jest.fn().mockResolvedValue({
        user: { id: '1', email: 'traveler1@example.com' },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      }),
      handleOAuthCallback: jest.fn(),
      refreshTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
      forgotPassword: jest.fn().mockResolvedValue({ message: 'OTP sent if exists' }),
      verifyResetOtp: jest.fn().mockResolvedValue({ resetTicket: 'ticket', expiresIn: 300 }),
      resetPassword: jest.fn().mockResolvedValue({ message: 'Password reset successful' }),
      logout: jest.fn().mockResolvedValue(undefined),
      getProfile: jest.fn().mockResolvedValue({ id: '1', email: 'traveler1@example.com' }),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    mockJwtService = {
      decode: jest.fn().mockReturnValue({ sub: 'user-1' }),
      verify: jest.fn().mockReturnValue({ sub: 'user-1', jti: 'jti-1' }),
    };

    const mockTokenBlacklistService = {
      isBlacklisted: jest.fn().mockResolvedValue(false),
      revokeAccessToken: jest.fn().mockResolvedValue(undefined),
      revokeByJti: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: TokenBlacklistService, useValue: mockTokenBlacklistService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('nên được khởi tạo thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('nên gọi AuthService.register và không setAuthCookies', async () => {
      const dto = { email: 'traveler1@example.com', password: 'Password123!', fullName: 'Test' };
      const res = await controller.register(dto);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(res.registrationId).toBe('reg-uuid-1');
    });
  });

  describe('verifyEmail', () => {
    it('nên gọi AuthService.verifyEmail và setAuthCookies', async () => {
      const dto = { token: 'valid-32-byte-hex-token' };
      const mockRes: any = { cookie: jest.fn() };
      const res = await controller.verifyEmail(dto, mockRes);
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(dto.token);
      expect(mockRes.cookie).toHaveBeenCalled();
      expect(res.user.email).toBe('traveler1@example.com');
    });
  });

  describe('resendVerificationEmail', () => {
    it('nên gọi AuthService.resendVerificationEmail', async () => {
      const dto = { registrationId: 'reg-uuid-1' };
      const res = await controller.resendVerificationEmail(dto);
      expect(mockAuthService.resendVerificationEmail).toHaveBeenCalledWith('reg-uuid-1');
      expect(res.expiresIn).toBe(1800);
    });
  });

  describe('login', () => {
    it('nên gọi AuthService.login và setAuthCookies', async () => {
      const dto = { identifier: 'traveler1@example.com', password: 'Password123!' };
      const mockRes: any = { cookie: jest.fn() };
      const res = await controller.login(dto, mockRes);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(mockRes.cookie).toHaveBeenCalled();
      expect(res.user.email).toBe('traveler1@example.com');
    });
  });

  describe('logout', () => {
    it('logout an toàn gọi authService.logout và luôn luôn xóa cookies', async () => {
      const mockReq: any = {
        cookies: { accessToken: 'acc-token', refreshToken: 'ref-token' },
        headers: {},
      };
      const mockRes: any = { clearCookie: jest.fn() };

      const res = await controller.logout(mockReq, mockRes);

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1', {
        accessToken: 'acc-token',
        refreshToken: 'ref-token',
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('accessToken', { path: '/' });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/' });
      expect(res.message).toBe('Đăng xuất thành công');
    });
  });

  describe('forgot-password & reset-password', () => {
    it('nên gọi AuthService.forgotPassword', async () => {
      const dto = { email: 'test@example.com' };
      const res = await controller.forgotPassword(dto);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(res.message).toBeDefined();
    });

    it('nên gọi AuthService.resetPassword', async () => {
      const dto = { resetTicket: 'ticket', password: 'newPassword123' };
      const mockRes: any = { clearCookie: jest.fn() };
      const res = await controller.resetPassword(dto);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
      expect(res.message).toBe('Password reset successful');
    });
  });

  describe('googleAuthRedirect', () => {
    it('chuyển hướng thành công khi login mode', async () => {
      mockAuthService.handleOAuthCallback.mockResolvedValue({
        authResponse: {
          user: { id: 'user-1' },
          tokens: { accessToken: 'a', refreshToken: 'r' },
        },
      });

      const mockReq: any = {
        user: { email: 'user@gmail.com' },
        cookies: {},
        query: {},
      };
      const mockRes: any = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.googleAuthRedirect(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/callback?success=true',
      );
      expect(mockRes.cookie).toHaveBeenCalled();
    });

    it('chuyển hướng kèm error code khi login thất bại', async () => {
      mockAuthService.handleOAuthCallback.mockRejectedValue(
        new Error('OAuth error'),
      );

      const mockReq: any = {
        user: { email: 'user@gmail.com' },
        cookies: {},
        query: {},
      };
      const mockRes: any = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.googleAuthRedirect(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/login?error=oauth_failed',
      );
    });
  });
});

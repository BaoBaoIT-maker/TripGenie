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
        user: { id: '1', username: 'traveler1' },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      }),
      login: jest.fn().mockResolvedValue({
        user: { id: '1', username: 'traveler1' },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      }),
      reauthenticate: jest.fn().mockResolvedValue({ grantToken: 'grant-123', expiresIn: 300 }),
      startGoogleLink: jest.fn().mockResolvedValue({
        url: 'https://accounts.google.com/...',
        state: 'state-123',
        browserNonce: 'nonce-123',
      }),
      handleOAuthCallback: jest.fn(),
      refreshTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
      forgotPassword: jest.fn().mockResolvedValue({ message: 'OTP sent if exists' }),
      verifyResetOtp: jest.fn().mockResolvedValue({ resetTicket: 'ticket', expiresIn: 300 }),
      resetPassword: jest.fn().mockResolvedValue({ message: 'Password reset successful' }),
      logout: jest.fn().mockResolvedValue(undefined),
      performLogout: jest.fn().mockResolvedValue(undefined),
      getProfile: jest.fn().mockResolvedValue({ id: '1', username: 'traveler1' }),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    mockJwtService = {
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
    it('nên gọi AuthService.register và setAuthCookies', async () => {
      const dto = { username: 'traveler1', password: 'Password123456789!', fullName: 'Test' };
      const mockRes: any = { cookie: jest.fn() };
      const res = await controller.register(dto, mockRes);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(mockRes.cookie).toHaveBeenCalled();
      expect(res.user.username).toBe('traveler1');
    });
  });

  describe('login', () => {
    it('nên gọi AuthService.login và setAuthCookies', async () => {
      const dto = { identifier: 'traveler1', password: 'Password123456789!' };
      const mockRes: any = { cookie: jest.fn() };
      const res = await controller.login(dto, mockRes);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(mockRes.cookie).toHaveBeenCalled();
      expect(res.user.username).toBe('traveler1');
    });
  });

  describe('reauthenticate & startGoogleLink', () => {
    it('nên gọi AuthService.reauthenticate', async () => {
      const dto = { password: 'Password123456789!' };
      const res = await controller.reauthenticate({ id: 'user-1' } as any, dto);
      expect(mockAuthService.reauthenticate).toHaveBeenCalledWith('user-1', dto);
      expect(res.grantToken).toBe('grant-123');
    });

    it('startGoogleLink nên gọi service và gán cookie oauth_link_nonce', async () => {
      const dto = { grantToken: 'grant-123', returnUrl: '/profile' };
      const mockRes: any = { cookie: jest.fn() };
      const res = await controller.startGoogleLink({ id: 'user-1' } as any, dto, mockRes);
      expect(mockAuthService.startGoogleLink).toHaveBeenCalledWith('user-1', dto);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'oauth_link_nonce',
        'nonce-123',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.url).toContain('https://accounts.google.com');
    });
  });

  describe('logout', () => {
    it('logout an toàn gọi performLogout và luôn luôn xóa cookies', async () => {
      const mockReq: any = {
        cookies: { accessToken: 'acc-token', refreshToken: 'ref-token' },
        headers: {},
      };
      const mockRes: any = { clearCookie: jest.fn() };

      const res = await controller.logout(mockReq, {}, mockRes);

      expect(mockAuthService.performLogout).toHaveBeenCalledWith({
        accessToken: 'acc-token',
        refreshToken: 'ref-token',
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('accessToken', { path: '/' });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/' });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('oauth_link_nonce', { path: '/' });
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
      const dto = { resetTicket: 'ticket', password: 'newPassword123456' };
      const mockRes: any = { clearCookie: jest.fn() };
      const res = await controller.resetPassword(dto, mockRes);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
      expect(mockRes.clearCookie).toHaveBeenCalled();
      expect(res.message).toBe('Password reset successful');
    });
  });

  describe('googleAuthRedirect', () => {
    it('chuyển hướng thành công khi login mode', async () => {
      mockAuthService.handleOAuthCallback.mockResolvedValue({
        mode: 'login',
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
        clearCookie: jest.fn(),
        cookie: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.googleAuthRedirect(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/callback?success=true',
      );
      expect(mockRes.cookie).toHaveBeenCalled();
    });

    it('chuyển hướng với linked=true khi link mode thành công', async () => {
      mockAuthService.handleOAuthCallback.mockResolvedValue({
        mode: 'link',
        returnUrl: '/profile',
      });

      const mockReq: any = {
        user: { email: 'user@gmail.com' },
        cookies: {
          oauth_link_nonce: 'nonce-123',
          accessToken: 'valid-acc',
        },
        query: { state: 'state-123' },
      };
      const mockRes: any = {
        clearCookie: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.googleAuthRedirect(mockReq, mockRes);

      expect(mockAuthService.handleOAuthCallback).toHaveBeenCalledWith(
        mockReq.user,
        'state-123',
        expect.objectContaining({
          browserNonce: 'nonce-123',
          currentUserId: 'user-1',
        }),
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/profile?linked=true',
      );
    });

    it('bắt lỗi và redirect kèm link_error khi link thất bại', async () => {
      mockAuthService.handleOAuthCallback.mockRejectedValue(
        new Error('Phiên đăng nhập đã hết hạn'),
      );

      const mockReq: any = {
        user: { email: 'user@gmail.com' },
        cookies: {},
        query: { state: 'state-123' },
      };
      const mockRes: any = {
        clearCookie: jest.fn(),
        redirect: jest.fn(),
      };

      await controller.googleAuthRedirect(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/profile?link_error='),
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '@/services/auth.service';

describe('authService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getMe trả về null khi backend trả về 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ statusCode: 401, message: 'Unauthorized' }),
    } as Response);

    const user = await authService.getMe();
    expect(user).toBeNull();
  });

  it('getMe trả về user kèm email và capabilities khi backend trả về 200', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'traveler1@example.com',
      fullName: 'Test User',
      role: 'USER' as const,
      isVerified: true,
      authMethods: ['LOCAL' as const],
      capabilities: {
        hasVerifiedEmail: true,
        canResetPasswordByEmail: true,
      },
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        statusCode: 200,
        success: true,
        data: mockUser,
      }),
    } as Response);

    const user = await authService.getMe();
    expect(user).toEqual(mockUser);
  });

  it('register gửi payload email, fullName, password và nhận RegisterResult', async () => {
    const mockResponse = {
      message: 'Đăng ký thành công. Vui lòng kiểm tra email.',
      expiresIn: 1800,
      retryAfter: 60,
      registrationId: 'reg-uuid-1',
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        statusCode: 201,
        success: true,
        data: mockResponse,
      }),
    } as Response);

    const result = await authService.register({
      email: 'traveler1@example.com',
      fullName: 'Test User',
      password: 'Password123!',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          email: 'traveler1@example.com',
          fullName: 'Test User',
          password: 'Password123!',
        }),
      }),
    );
    expect(result.registrationId).toBe('reg-uuid-1');
  });

  it('verifyEmail gửi token và nhận AuthResponse', async () => {
    const mockResponse = {
      user: {
        id: 'user-1',
        email: 'traveler1@example.com',
        fullName: 'Test User',
        role: 'USER' as const,
        isVerified: true,
      },
      tokens: {
        accessToken: 'mock_at',
        refreshToken: 'mock_rt',
      },
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        statusCode: 200,
        success: true,
        data: mockResponse,
      }),
    } as Response);

    const result = await authService.verifyEmail('valid-token-hex');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/verify-email'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ token: 'valid-token-hex' }),
      }),
    );
    expect(result.user.email).toBe('traveler1@example.com');
  });

  it('resendVerificationEmail gửi registrationId', async () => {
    const mockResponse = {
      message: 'Email xác thực mới đã được gửi.',
      expiresIn: 1800,
      retryAfter: 60,
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        statusCode: 200,
        success: true,
        data: mockResponse,
      }),
    } as Response);

    const result = await authService.resendVerificationEmail('reg-uuid-1');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/resend-verification-email'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ registrationId: 'reg-uuid-1' }),
      }),
    );
    expect(result.expiresIn).toBe(1800);
  });

  it('login gửi identifier và password', async () => {
    const mockResponse = {
      user: {
        id: 'user-1',
        email: 'traveler1@example.com',
        fullName: 'Test User',
        role: 'USER' as const,
        isVerified: true,
      },
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        statusCode: 200,
        success: true,
        data: mockResponse,
      }),
    } as Response);

    const result = await authService.login({
      identifier: 'traveler1@example.com',
      password: 'Password123!',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          identifier: 'traveler1@example.com',
          password: 'Password123!',
        }),
      }),
    );
    expect(result.user.email).toBe('traveler1@example.com');
  });

  it('logout gửi request và trả về thông báo', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Đăng xuất thành công' }),
    } as Response);

    const res = await authService.logout();
    expect(res.message).toBeDefined();
  });
});

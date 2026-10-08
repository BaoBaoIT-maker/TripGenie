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

  it('getMe trả về user kèm username và capabilities khi backend trả về 200', async () => {
    const mockUser = {
      id: 'user-1',
      username: 'traveler1',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'USER' as const,
      isVerified: true,
      authMethods: ['LOCAL' as const],
      capabilities: {
        hasVerifiedEmail: true,
        hasGoogleEmailLink: false,
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

  it('register gửi payload username, fullName, password và nhận AuthResponse', async () => {
    const mockResponse = {
      user: {
        id: 'user-1',
        username: 'traveler1',
        fullName: 'Test User',
        role: 'USER' as const,
        isVerified: false,
      },
      tokens: {
        accessToken: 'mock_at',
        refreshToken: 'mock_rt',
      },
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
      username: 'traveler1',
      fullName: 'Test User',
      password: 'Password123456789!',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          username: 'traveler1',
          fullName: 'Test User',
          password: 'Password123456789!',
        }),
      }),
    );
    expect(result.user.username).toBe('traveler1');
  });

  it('login gửi identifier và password', async () => {
    const mockResponse = {
      user: {
        id: 'user-1',
        username: 'traveler1',
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
      identifier: 'traveler1',
      password: 'Password123456789!',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          identifier: 'traveler1',
          password: 'Password123456789!',
        }),
      }),
    );
    expect(result.user.username).toBe('traveler1');
  });

  it('reauthenticate gửi password và trả về grantToken', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        statusCode: 200,
        success: true,
        data: { grantToken: 'grant-xyz', expiresIn: 300 },
      }),
    } as Response);

    const res = await authService.reauthenticate('Secret123456789!');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/reauthenticate'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'Secret123456789!' }),
      }),
    );
    expect(res.grantToken).toBe('grant-xyz');
  });

  it('startGoogleLink gửi grantToken và returnUrl', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        statusCode: 200,
        success: true,
        data: { url: 'https://accounts.google.com/...', state: 'state-123' },
      }),
    } as Response);

    const res = await authService.startGoogleLink('grant-xyz', '/profile');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/google/link/start'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ grantToken: 'grant-xyz', returnUrl: '/profile' }),
      }),
    );
    expect(res.url).toContain('https://accounts.google.com');
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

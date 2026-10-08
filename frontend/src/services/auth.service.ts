import { apiClient, ApiClientError } from '@/lib/api-client';
import {
  AuthUser,
  AuthResponse,
  OtpChallengeResponse,
  ResetTicketResponse,
  RegisterDto,
  LoginDto,
} from '@/types/auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const authService = {
  async getMe(): Promise<AuthUser | null> {
    try {
      const user = await apiClient<AuthUser>('/auth/me');
      return user;
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        return null;
      }
      throw error;
    }
  },

  async login(credentials: LoginDto): Promise<AuthResponse> {
    return apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      skipAuthRefresh: true,
    });
  },

  async register(data: RegisterDto): Promise<AuthResponse> {
    return apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuthRefresh: true,
    });
  },

  async reauthenticate(password: string): Promise<{ grantToken: string; expiresIn: number }> {
    return apiClient<{ grantToken: string; expiresIn: number }>('/auth/reauthenticate', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  async startGoogleLink(
    grantToken: string,
    returnUrl?: string,
  ): Promise<{ url: string; state: string }> {
    return apiClient<{ url: string; state: string }>('/auth/google/link/start', {
      method: 'POST',
      body: JSON.stringify({ grantToken, returnUrl }),
    });
  },

  async updateUsername(username: string): Promise<{ message: string; user: AuthUser }> {
    return apiClient<{ message: string; user: AuthUser }>('/users/me/username', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    });
  },

  async verifyOtp(data: { email: string; otp: string }): Promise<AuthResponse> {
    return apiClient<AuthResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuthRefresh: true,
    });
  },

  async resendOtp(data: {
    email: string;
    purpose?: 'email-verification' | 'password-reset';
  }): Promise<OtpChallengeResponse> {
    return apiClient<OtpChallengeResponse>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async forgotPassword(data: { email: string }): Promise<OtpChallengeResponse> {
    return apiClient<OtpChallengeResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuthRefresh: true,
    });
  },

  async verifyResetOtp(data: {
    email: string;
    otp: string;
  }): Promise<ResetTicketResponse> {
    return apiClient<ResetTicketResponse>('/auth/verify-reset-otp', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuthRefresh: true,
    });
  },

  async resetPassword(data: {
    resetTicket: string;
    password: string;
  }): Promise<{ message: string }> {
    return apiClient<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuthRefresh: true,
    });
  },

  async logout(): Promise<{ message: string }> {
    return apiClient<{ message: string }>('/auth/logout', {
      method: 'POST',
      skipAuthRefresh: true,
    });
  },

  getGoogleAuthUrl(): string {
    return `${API_BASE_URL}/auth/google`;
  },
};

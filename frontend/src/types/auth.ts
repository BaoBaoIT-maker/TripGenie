export type UserRole = 'ADMIN' | 'USER';

export interface UserCapabilities {
  hasVerifiedEmail: boolean;
  hasGoogleEmailLink: boolean;
  canResetPasswordByEmail: boolean;
}

export interface AuthUser {
  id: string;
  username?: string | null;
  email?: string | null;
  fullName: string;
  avatarUrl?: string | null;
  role: UserRole;
  isVerified: boolean;
  authMethods?: ('LOCAL' | 'GOOGLE')[];
  capabilities?: UserCapabilities;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens?: AuthTokens;
}

export interface RegisterDto {
  username: string;
  fullName: string;
  password: string;
}

export interface LoginDto {
  identifier: string;
  password: string;
}

export interface ReauthenticateDto {
  password: string;
}

export interface StartGoogleLinkDto {
  grantToken: string;
  returnUrl?: string;
}

export interface OtpChallengeResponse {
  message: string;
  expiresIn: number;
  retryAfter: number;
}

export interface ResetTicketResponse {
  resetTicket: string;
  expiresIn: number;
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

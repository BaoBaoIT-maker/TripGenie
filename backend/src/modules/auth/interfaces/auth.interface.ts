import { UserRole } from '@prisma/client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserCapabilities {
  hasVerifiedEmail: boolean;
  hasGoogleEmailLink: boolean;
  canResetPasswordByEmail: boolean;
}

export interface UserResponse {
  id: string;
  username?: string | null;
  email?: string | null;
  fullName: string;
  avatarUrl?: string | null;
  role: UserRole;
  isVerified: boolean;
  authMethods: ('LOCAL' | 'GOOGLE')[];
  capabilities: UserCapabilities;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

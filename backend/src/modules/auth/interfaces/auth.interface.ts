import { UserRole } from '@prisma/client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  role: UserRole;
  isVerified: boolean;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

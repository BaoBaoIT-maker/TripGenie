import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  username?: string | null;
  email?: string | null;
  role: UserRole;
  authVersion?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}

/** Authenticated user object attached to req.user by JwtStrategy */
export interface AuthenticatedUser {
  id: string;
  username?: string | null;
  email?: string | null;
  role: UserRole;
  fullName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  authVersion: number;
  /** JWT ID — used to revoke this specific token on logout */
  jti: string;
  /** Token expiry unix timestamp — used to compute Redis TTL */
  exp: number;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

export interface ApiResponse<T = any> {
  statusCode: number;
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, any>;
}

import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export interface ApiResponse<T = any> {
  statusCode: number;
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, any>;
}

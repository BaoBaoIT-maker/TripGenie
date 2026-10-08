import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  otpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  reauthenticateSchema,
} from '@/features/auth/schemas/auth.schema';

describe('Auth Zod Schemas', () => {
  describe('loginSchema', () => {
    it('chấp nhận identifier (username hoặc email) và password hợp lệ', () => {
      expect(
        loginSchema.safeParse({
          identifier: 'user123',
          password: 'password123456789',
        }).success,
      ).toBe(true);

      expect(
        loginSchema.safeParse({
          identifier: 'user@example.com',
          password: 'password123456789',
        }).success,
      ).toBe(true);
    });

    it('từ chối khi thiếu identifier hoặc password', () => {
      expect(loginSchema.safeParse({ identifier: '', password: '123' }).success).toBe(false);
      expect(loginSchema.safeParse({ identifier: 'user123', password: '' }).success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('chấp nhận đăng ký hợp lệ bằng username và mật khẩu >= 15 ký tự', () => {
      const result = registerSchema.safeParse({
        username: 'traveler_01',
        fullName: 'Nguyễn Văn A',
        password: 'Password123456789!',
        confirmPassword: 'Password123456789!',
        agreeTerms: true,
      });
      expect(result.success).toBe(true);
    });

    it('từ chối username chứa ký tự @ hoặc ký tự không hợp lệ', () => {
      const result = registerSchema.safeParse({
        username: 'user@domain.com',
        fullName: 'Nguyễn Văn A',
        password: 'Password123456789!',
        confirmPassword: 'Password123456789!',
        agreeTerms: true,
      });
      expect(result.success).toBe(false);
    });

    it('từ chối username ngắn hơn 3 ký tự hoặc dài hơn 32 ký tự', () => {
      expect(
        registerSchema.safeParse({
          username: 'ab',
          fullName: 'Nguyễn Văn A',
          password: 'Password123456789!',
          confirmPassword: 'Password123456789!',
          agreeTerms: true,
        }).success,
      ).toBe(false);
    });

    it('từ chối mật khẩu dưới 15 ký tự', () => {
      const result = registerSchema.safeParse({
        username: 'traveler_01',
        fullName: 'Nguyễn Văn A',
        password: 'ShortPass123',
        confirmPassword: 'ShortPass123',
        agreeTerms: true,
      });
      expect(result.success).toBe(false);
    });

    it('từ chối nếu confirmPassword không khớp', () => {
      const result = registerSchema.safeParse({
        username: 'traveler_01',
        fullName: 'Nguyễn Văn A',
        password: 'Password123456789!',
        confirmPassword: 'DifferentPassword123!',
        agreeTerms: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('otpSchema', () => {
    it('chấp nhận đúng 6 chữ số', () => {
      const result = otpSchema.safeParse({ otp: '123456' });
      expect(result.success).toBe(true);
    });

    it('từ chối chuỗi có chữ hoặc ít hơn 6 ký tự', () => {
      expect(otpSchema.safeParse({ otp: '12345' }).success).toBe(false);
      expect(otpSchema.safeParse({ otp: '12345a' }).success).toBe(false);
    });
  });

  describe('forgotPasswordSchema & resetPasswordSchema', () => {
    it('forgotPasswordSchema kiểm tra email', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'valid@gmail.com' }).success).toBe(true);
      expect(forgotPasswordSchema.safeParse({ email: 'invalid' }).success).toBe(false);
    });

    it('resetPasswordSchema kiểm tra mật khẩu mới >= 15 ký tự và xác nhận', () => {
      expect(
        resetPasswordSchema.safeParse({
          password: 'NewStrongPassword12345',
          confirmPassword: 'NewStrongPassword12345',
        }).success,
      ).toBe(true);

      expect(
        resetPasswordSchema.safeParse({
          password: 'short',
          confirmPassword: 'short',
        }).success,
      ).toBe(false);
    });
  });

  describe('reauthenticateSchema', () => {
    it('kiểm tra mật khẩu xác nhận không được để trống', () => {
      expect(reauthenticateSchema.safeParse({ password: 'Password123' }).success).toBe(true);
      expect(reauthenticateSchema.safeParse({ password: '' }).success).toBe(false);
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  otpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/features/auth/schemas/auth.schema';

describe('Auth Zod Schemas', () => {
  describe('loginSchema', () => {
    it('chấp nhận identifier (email hoặc tên đăng nhập) và password hợp lệ', () => {
      expect(
        loginSchema.safeParse({
          identifier: 'user123',
          password: 'password123',
        }).success,
      ).toBe(true);

      expect(
        loginSchema.safeParse({
          identifier: 'user@example.com',
          password: 'password123',
        }).success,
      ).toBe(true);
    });

    it('từ chối khi thiếu identifier hoặc password', () => {
      expect(loginSchema.safeParse({ identifier: '', password: '123' }).success).toBe(false);
      expect(loginSchema.safeParse({ identifier: 'user123', password: '' }).success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('chấp nhận đăng ký hợp lệ bằng email và mật khẩu >= 8 ký tự', () => {
      const result = registerSchema.safeParse({
        email: 'traveler@example.com',
        fullName: 'Nguyễn Văn A',
        password: 'Password1!',
        confirmPassword: 'Password1!',
        agreeTerms: true,
      });
      expect(result.success).toBe(true);
    });

    it('từ chối email không hợp lệ', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        fullName: 'Nguyễn Văn A',
        password: 'Password1!',
        confirmPassword: 'Password1!',
        agreeTerms: true,
      });
      expect(result.success).toBe(false);
    });

    it('từ chối mật khẩu dưới 8 ký tự (7 ký tự fail, 8 ký tự pass)', () => {
      const fail7 = registerSchema.safeParse({
        email: 'traveler@example.com',
        fullName: 'Nguyễn Văn A',
        password: '1234567',
        confirmPassword: '1234567',
        agreeTerms: true,
      });
      expect(fail7.success).toBe(false);

      const pass8 = registerSchema.safeParse({
        email: 'traveler@example.com',
        fullName: 'Nguyễn Văn A',
        password: '12345678',
        confirmPassword: '12345678',
        agreeTerms: true,
      });
      expect(pass8.success).toBe(true);
    });

    it('từ chối mật khẩu vượt quá 72 UTF-8 bytes', () => {
      const longPassword = 'a'.repeat(73);
      const result = registerSchema.safeParse({
        email: 'traveler@example.com',
        fullName: 'Nguyễn Văn A',
        password: longPassword,
        confirmPassword: longPassword,
        agreeTerms: true,
      });
      expect(result.success).toBe(false);
    });

    it('từ chối nếu confirmPassword không khớp', () => {
      const result = registerSchema.safeParse({
        email: 'traveler@example.com',
        fullName: 'Nguyễn Văn A',
        password: 'Password1!',
        confirmPassword: 'DifferentPassword1!',
        agreeTerms: true,
      });
      expect(result.success).toBe(false);
    });

    it('từ chối nếu chưa đồng ý điều khoản', () => {
      const result = registerSchema.safeParse({
        email: 'traveler@example.com',
        fullName: 'Nguyễn Văn A',
        password: 'Password1!',
        confirmPassword: 'Password1!',
        agreeTerms: false,
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

    it('resetPasswordSchema kiểm tra mật khẩu mới >= 8 ký tự và xác nhận', () => {
      expect(
        resetPasswordSchema.safeParse({
          password: 'Password88',
          confirmPassword: 'Password88',
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
});

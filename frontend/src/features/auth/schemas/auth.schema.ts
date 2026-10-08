import { z } from 'zod';

const getUtf8BytesLength = (str: string) => new TextEncoder().encode(str).length;

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên đăng nhập hoặc email'),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu'),
  rememberMe: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
      .max(32, 'Tên đăng nhập không được vượt quá 32 ký tự')
      .regex(
        /^[a-zA-Z0-9._-]+$/,
        'Tên đăng nhập chỉ gồm chữ cái, số, dấu chấm (.), gạch dưới (_) hoặc gạch ngang (-) và không chứa @',
      ),
    fullName: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập họ và tên')
      .min(2, 'Họ tên phải có ít nhất 2 ký tự')
      .max(100, 'Họ tên không được vượt quá 100 ký tự'),
    password: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu')
      .min(15, 'Mật khẩu phải có tối thiểu 15 ký tự')
      .refine((val) => getUtf8BytesLength(val) <= 72, {
        message: 'Mật khẩu không được vượt quá 72 bytes UTF-8',
      }),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: 'Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách bảo mật',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'Mã OTP phải có đúng 6 chữ số')
    .regex(/^\d{6}$/, 'Mã OTP chỉ bao gồm chữ số'),
});

export type OtpFormData = z.infer<typeof otpSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập địa chỉ email')
    .email('Địa chỉ email không hợp lệ'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu mới')
      .min(15, 'Mật khẩu phải có tối thiểu 15 ký tự')
      .refine((val) => getUtf8BytesLength(val) <= 72, {
        message: 'Mật khẩu không được vượt quá 72 bytes UTF-8',
      }),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận lại mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const reauthenticateSchema = z.object({
  password: z.string().min(1, 'Vui lòng nhập mật khẩu để xác nhận'),
});

export type ReauthenticateFormData = z.infer<typeof reauthenticateSchema>;

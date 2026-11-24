import { z } from 'zod';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n';

const getUtf8BytesLength = (str: string) => new TextEncoder().encode(str).length;

export function createLoginSchema(locale: Locale = DEFAULT_LOCALE) {
  const v = getMessages(locale).auth.validation;
  return z.object({
    identifier: z.string().trim().min(1, v.identifierRequired),
    password: z.string().min(1, v.passwordRequired),
    rememberMe: z.boolean().optional(),
  });
}

export const loginSchema = createLoginSchema(DEFAULT_LOCALE);
export type LoginFormData = z.infer<typeof loginSchema>;

export function createRegisterSchema(locale: Locale = DEFAULT_LOCALE) {
  const v = getMessages(locale).auth.validation;
  return z
    .object({
      email: z.string().trim().min(1, v.emailRequired).email(v.emailInvalid),
      fullName: z
        .string()
        .trim()
        .min(1, v.fullNameRequired)
        .min(2, v.fullNameMin)
        .max(100, v.fullNameMax),
      password: z
        .string()
        .min(1, v.passwordRequired)
        .min(8, v.passwordMin)
        .refine((val) => getUtf8BytesLength(val) <= 72, {
          message: v.passwordMaxBytes,
        }),
      confirmPassword: z.string().min(1, v.confirmPasswordRequired),
      agreeTerms: z.boolean().refine((val) => val === true, {
        message: v.agreeTermsRequired,
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: v.passwordMismatch,
      path: ['confirmPassword'],
    });
}

export const registerSchema = createRegisterSchema(DEFAULT_LOCALE);
export type RegisterFormData = z.infer<typeof registerSchema>;

export function createOtpSchema(locale: Locale = DEFAULT_LOCALE) {
  const v = getMessages(locale).auth.validation;
  return z.object({
    otp: z
      .string()
      .length(6, v.otpLength)
      .regex(/^\d{6}$/, v.otpDigitsOnly),
  });
}

export const otpSchema = createOtpSchema(DEFAULT_LOCALE);
export type OtpFormData = z.infer<typeof otpSchema>;

export function createForgotPasswordSchema(locale: Locale = DEFAULT_LOCALE) {
  const v = getMessages(locale).auth.validation;
  return z.object({
    email: z.string().trim().min(1, v.emailRequired).email(v.emailInvalid),
  });
}

export const forgotPasswordSchema = createForgotPasswordSchema(DEFAULT_LOCALE);
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function createResetPasswordSchema(locale: Locale = DEFAULT_LOCALE) {
  const v = getMessages(locale).auth.validation;
  return z
    .object({
      password: z
        .string()
        .min(1, v.newPasswordRequired)
        .min(8, v.passwordMin)
        .refine((val) => getUtf8BytesLength(val) <= 72, {
          message: v.passwordMaxBytes,
        }),
      confirmPassword: z.string().min(1, v.confirmPasswordRequired),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: v.passwordMismatch,
      path: ['confirmPassword'],
    });
}

export const resetPasswordSchema = createResetPasswordSchema(DEFAULT_LOCALE);
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

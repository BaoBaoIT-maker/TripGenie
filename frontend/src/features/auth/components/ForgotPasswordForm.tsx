'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  createForgotPasswordSchema,
  ForgotPasswordFormData,
} from '../schemas/auth.schema';
import { useAuth } from '../hooks/use-auth';
import { useI18n } from '@/i18n/LocaleProvider';

export function ForgotPasswordForm() {
  const router = useRouter();
  const { locale, messages } = useI18n();
  const a = messages.auth;
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { forgotPassword, isSubmittingForgotPassword } = useAuth();
  const resolver = React.useMemo(
    () => zodResolver(createForgotPasswordSchema(locale)),
    [locale],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver,
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);
    try {
      await forgotPassword({
        email: data.email,
      });

      toast.success(a.messages.otpSent);

      const query = new URLSearchParams({
        email: data.email,
        purpose: 'password-reset',
      });
      router.push(`/verify-otp?${query.toString()}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : a.messages.otpSendFailed;
      setServerError(message);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground leading-relaxed">
        {a.messages.forgotDescription}
      </p>

      {serverError && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm leading-relaxed animate-in fade-in">
          <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            {a.fields.emailLabel}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder={a.fields.emailPlaceholder}
              className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmittingForgotPassword}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-2"
        >
          {isSubmittingForgotPassword ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>{a.actions.sendingOtp}</span>
            </>
          ) : (
            <span>{a.actions.sendOtp}</span>
          )}
        </button>
      </form>

      {/* Return to Login */}
      <div className="text-center pt-2 border-t border-border/60">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          <span>{a.actions.backToLoginPage}</span>
        </Link>
      </div>
    </div>
  );
}

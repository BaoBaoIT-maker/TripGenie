'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createResetPasswordSchema,
  ResetPasswordFormData,
} from '../schemas/auth.schema';
import { useAuth } from '../hooks/use-auth';
import { useI18n } from '@/i18n';

export function ResetPasswordForm() {
  const router = useRouter();
  const { locale, messages } = useI18n();
  const a = messages.auth;
  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [resetTicket] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('tripgenie:reset_ticket');
    }
    return null;
  });
  const [isSuccess, setIsSuccess] = React.useState(false);

  const { resetPassword, isResettingPassword } = useAuth();
  const resolver = React.useMemo(
    () => zodResolver(createResetPasswordSchema(locale)),
    [locale],
  );

  React.useEffect(() => {
    if (typeof window !== 'undefined' && !resetTicket) {
      toast.error(a.messages.resetTicketMissing);
      router.push('/forgot-password');
    }
  }, [resetTicket, router, a.messages.resetTicketMissing]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver,
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!resetTicket) {
      toast.error(a.messages.resetTicketInvalid);
      router.push('/forgot-password');
      return;
    }

    setServerError(null);

    try {
      await resetPassword({
        resetTicket,
        password: data.password,
      });

      setIsSuccess(true);
      toast.success(a.messages.resetSuccess);

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('tripgenie:reset_ticket');
      }

      setTimeout(() => {
        router.push('/login');
      }, 1200);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : a.messages.resetFailed;
      setServerError(message);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground leading-relaxed">
        {a.messages.resetDescription}
      </p>

      {serverError && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm leading-relaxed animate-in fade-in">
          <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {isSuccess && (
        <div className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="size-4.5" />
          <span>{a.messages.resetUpdatedRedirecting}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* New Password Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            {a.fields.newPasswordLabel}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={a.fields.passwordPlaceholder}
              className="w-full h-10 pl-9 pr-10 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
              aria-label={showPassword ? a.hidePassword : a.showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            {a.fields.confirmNewPasswordLabel}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={a.fields.confirmNewPasswordPlaceholder}
              className="w-full h-10 pl-9 pr-10 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
              aria-label={showPassword ? a.hidePassword : a.showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isResettingPassword || isSuccess}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-2"
        >
          {isResettingPassword ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>{a.actions.updatingPassword}</span>
            </>
          ) : (
            <span>{a.actions.updatePassword}</span>
          )}
        </button>
      </form>

      {/* Cancel Link */}
      <div className="text-center pt-2 border-t border-border/60">
        <Link
          href="/login"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium"
        >
          {a.actions.cancelBackToLogin}
        </Link>
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { createRegisterSchema, RegisterFormData } from '../schemas/auth.schema';
import { useAuth } from '../hooks/use-auth';
import { authService } from '@/services/auth.service';
import { GoogleAuthButton } from './GoogleAuthButton';
import { getSafeRedirectUrl } from '@/lib/safe-redirect';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/LocaleProvider';

export function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { locale, t, messages } = useI18n();
  const a = messages.auth;
  const nextParam = getSafeRedirectUrl(searchParams.get('next'), '/');

  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Verification pending state
  const [pendingRegistration, setPendingRegistration] = React.useState<{
    email: string;
    registrationId: string;
    retryAfter: number;
  } | null>(null);

  const [countdown, setCountdown] = React.useState<number>(0);

  const {
    register: registerUser,
    isRegistering,
    resendVerificationEmail,
    isResendingVerificationEmail,
  } = useAuth();

  const resolver = React.useMemo(
    () => zodResolver(createRegisterSchema(locale)),
    [locale],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver,
    defaultValues: {
      email: '',
      fullName: '',
      password: '',
      confirmPassword: '',
      agreeTerms: true,
    },
  });

  // Countdown timer effect
  React.useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Cross-tab and Cross-device auto-login effect:
  // 1. BroadcastChannel: 0ms instant trigger when verified on another tab in the same browser
  // 2. Short-polling (2.5s): Auto-redirects when verified on another device (e.g. mobile phone)
  React.useEffect(() => {
    if (!pendingRegistration) return;

    let isHandled = false;

    const handleSuccess = () => {
      if (isHandled) return;
      isHandled = true;
      toast.success(a.messages.accountActivated);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.push(nextParam || '/');
    };

    // 1. BroadcastChannel (Same browser)
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('tripgenie_auth_channel');
        channel.onmessage = (event) => {
          if (event.data?.type === 'EMAIL_VERIFIED') {
            handleSuccess();
          }
        };
      } catch {
        // BroadcastChannel unsupported
      }
    }

    // 2. Short-polling (Cross-device, e.g. clicked magic link on phone)
    const pollInterval = setInterval(async () => {
      if (isHandled) return;
      try {
        const res = await authService.checkRegistrationStatus(pendingRegistration.registrationId);
        if (res.verified) {
          handleSuccess();
        }
      } catch {
        // Silently ignore transient network blips
      }
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      channel?.close();
    };
  }, [pendingRegistration, nextParam, router, queryClient, a.messages.accountActivated]);

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      const res = await registerUser({
        email: data.email,
        fullName: data.fullName,
        password: data.password,
      });

      setPendingRegistration({
        email: data.email,
        registrationId: res.registrationId,
        retryAfter: res.retryAfter || 60,
      });
      setCountdown(res.retryAfter || 60);
      toast.success(a.messages.verificationEmailSent);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : a.messages.registerFailed;
      setServerError(message);
    }
  };

  const handleResend = async () => {
    if (!pendingRegistration || countdown > 0) return;
    try {
      const res = await resendVerificationEmail(pendingRegistration.registrationId);
      setCountdown(res.retryAfter || 60);
      toast.success(a.messages.activationEmailResent);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : a.messages.resendFailed;
      toast.error(message);
    }
  };

  const handleResetRegistration = () => {
    setPendingRegistration(null);
    setCountdown(0);
    setServerError(null);
    reset();
  };

  // Mask email for display: e.g. "th*****@gmail.com"
  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.slice(0, 2)}${'*'.repeat(Math.min(name.length - 2, 5))}@${domain}`;
  };

  // State: Waiting for user to click verification email link
  if (pendingRegistration) {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
            <Mail className="size-8" />
          </div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            {a.messages.checkEmailTitle}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
            {a.messages.activationLinkSentTo}
          </p>
          <div className="px-3.5 py-1.5 rounded-xl bg-muted/60 border border-border text-foreground font-semibold text-sm">
            {maskEmail(pendingRegistration.email)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2 text-xs text-muted-foreground leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            <span>{a.messages.activationGuideTitle}</span>
          </div>
          <p>{a.messages.activationGuideStep1}</p>
          <p>{a.messages.activationGuideStep2}</p>
          <p>{a.messages.activationGuideStep3}</p>
        </div>

        <div className="space-y-3 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={countdown > 0 || isResendingVerificationEmail}
            className="w-full h-10.5 rounded-xl font-semibold text-xs gap-2 cursor-pointer"
          >
            {isResendingVerificationEmail ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{a.actions.resending}</span>
              </>
            ) : countdown > 0 ? (
              <>
                <RotateCw className="size-4 text-muted-foreground" />
                <span>{t('auth.actions.resendEmailAfter', { seconds: countdown })}</span>
              </>
            ) : (
              <>
                <RotateCw className="size-4" />
                <span>{a.actions.resendActivation}</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleResetRegistration}
            className="w-full h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>{a.actions.registerOtherEmail}</span>
          </Button>
        </div>

        <div className="border-t border-border/80 pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            {a.actions.alreadyActivated}{' '}
            <Link
              href={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login'}
              className="text-primary font-semibold hover:underline"
            >
              {a.actions.signInNow}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
              autoCapitalize="none"
              autoComplete="email"
              placeholder={a.fields.emailPlaceholder}
              className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {errors.email ? (
            <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {a.fields.emailHint}
            </p>
          )}
        </div>

        {/* Full Name Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            {a.fields.fullNameLabel}
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('fullName')}
              type="text"
              autoComplete="name"
              placeholder={a.fields.fullNamePlaceholder}
              className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {errors.fullName && (
            <p className="text-xs text-destructive mt-1">{errors.fullName.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            {a.fields.passwordLabel}
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
          {errors.password ? (
            <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {a.fields.passwordHint}
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            {a.fields.confirmPasswordLabel}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={a.fields.confirmPasswordPlaceholder}
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

        {/* Agree Terms Checkbox */}
        <div className="flex items-start gap-2 pt-1">
          <input
            {...register('agreeTerms')}
            type="checkbox"
            id="agreeTerms"
            className="size-4 mt-0.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
          />
          <label htmlFor="agreeTerms" className="text-xs text-muted-foreground cursor-pointer select-none leading-relaxed">
            {a.fields.agreeTermsPrefix}{' '}
            <Link href="/" className="text-primary hover:underline font-medium">
              {a.fields.termsOfService}
            </Link>{' '}
            {a.fields.and}{' '}
            <Link href="/" className="text-primary hover:underline font-medium">
              {a.fields.privacyPolicy}
            </Link>
          </label>
        </div>
        {errors.agreeTerms && (
          <p className="text-xs text-destructive">{errors.agreeTerms.message}</p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isRegistering}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
        >
          {isRegistering ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>{a.actions.submittingRegister}</span>
            </>
          ) : (
            <span>{a.actions.createAccount}</span>
          )}
        </button>
      </form>

      {/* Social Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/80" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground font-medium">
            {a.orContinueWith}
          </span>
        </div>
      </div>

      {/* Google Auth Button */}
      <GoogleAuthButton label={a.signUpWithGoogle} />

      {/* Switch to Login */}
      <p className="text-center text-xs text-muted-foreground">
        {a.actions.alreadyHaveAccount}{' '}
        <Link
          href={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login'}
          className="text-primary font-semibold hover:underline"
        >
          {a.actions.signIn}
        </Link>
      </p>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { loginSchema, LoginFormData } from '../schemas/auth.schema';
import { useAuth } from '../hooks/use-auth';
import { GoogleAuthButton } from './GoogleAuthButton';
import { getSafeRedirectUrl } from '@/lib/safe-redirect';
import { ApiClientError } from '@/lib/api-client';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = getSafeRedirectUrl(searchParams.get('next'));
  const errorParam = searchParams.get('error');

  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isUnverified, setIsUnverified] = React.useState(false);

  const initialOAuthError = React.useMemo(() => {
    if (errorParam === 'oauth_failed') {
      return 'Đăng nhập với Google thất bại. Vui lòng thử lại.';
    }
    if (errorParam === 'account_collision') {
      return 'Email này đã thuộc về một tài khoản khác. Vui lòng đăng nhập bằng mật khẩu.';
    }
    return null;
  }, [errorParam]);

  const displayError = formError || initialOAuthError;

  const { login, isLoggingIn } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setFormError(null);
    setIsUnverified(false);
    try {
      await login({
        identifier: data.identifier,
        password: data.password,
      });
      toast.success('Đăng nhập thành công!');
      router.push(nextUrl);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === 'EMAIL_NOT_VERIFIED') {
        setIsUnverified(true);
        setFormError('Tài khoản chưa được kích hoạt qua email. Vui lòng kiểm tra hộp thư đến để nhấn vào liên kết xác thực.');
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Tài khoản/email hoặc mật khẩu không chính xác';
      setFormError(message);
    }
  };

  return (
    <div className="space-y-6">
      {displayError && (
        <div
          className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm leading-relaxed animate-in fade-in ${
            isUnverified
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}
        >
          {isUnverified ? (
            <Info className="size-4.5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-semibold">{displayError}</p>
            {isUnverified && (
              <p className="text-xs text-muted-foreground">
                Nếu bạn không tìm thấy thư kích hoạt, hãy kiểm tra thư mục Spam hoặc thực hiện đăng ký lại để nhận liên kết mới.
              </p>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Identifier Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            Địa chỉ Email hoặc Tên đăng nhập
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('identifier')}
              type="text"
              autoComplete="username"
              placeholder="vd: traveler@example.com"
              className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {errors.identifier && (
            <p className="text-xs text-destructive mt-1">{errors.identifier.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground tracking-wide">
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline font-medium"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Tối thiểu 8 ký tự"
              className="w-full h-10 pl-9 pr-10 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 transition-colors cursor-pointer"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2 pt-1">
          <input
            {...register('rememberMe')}
            type="checkbox"
            id="rememberMe"
            className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
          />
          <label htmlFor="rememberMe" className="text-xs text-muted-foreground cursor-pointer select-none">
            Ghi nhớ phiên đăng nhập trên thiết bị này
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoggingIn}
          className="w-full h-10.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-2"
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Đang đăng nhập...</span>
            </>
          ) : (
            <span>Đăng nhập</span>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/80" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground font-medium tracking-wider">
            hoặc
          </span>
        </div>
      </div>

      {/* Google OAuth Button */}
      <GoogleAuthButton label="Đăng nhập bằng Google" />

      {/* Switch to Register */}
      <p className="text-center text-xs text-muted-foreground pt-2">
        Chưa có tài khoản?{' '}
        <Link
          href={`/register${nextUrl !== '/explore' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`}
          className="text-primary font-semibold hover:underline"
        >
          Đăng ký tài khoản mới
        </Link>
      </p>
    </div>
  );
}

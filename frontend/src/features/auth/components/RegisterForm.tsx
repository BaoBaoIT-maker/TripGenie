'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, AtSign, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { registerSchema, RegisterFormData } from '../schemas/auth.schema';
import { useAuth } from '../hooks/use-auth';
import { GoogleAuthButton } from './GoogleAuthButton';
import { getSafeRedirectUrl } from '@/lib/safe-redirect';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = getSafeRedirectUrl(searchParams.get('next'));

  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { register: registerUser, isRegistering } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      fullName: '',
      password: '',
      confirmPassword: '',
      agreeTerms: true,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      await registerUser({
        username: data.username,
        fullName: data.fullName,
        password: data.password,
      });

      toast.success('Đăng ký tài khoản thành công! Chào mừng bạn đến với TripGenie.');
      router.push(nextParam);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Đăng ký không thành công. Vui lòng thử lại.';
      setServerError(message);
    }
  };

  return (
    <div className="space-y-6">
      {serverError && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm leading-relaxed animate-in fade-in">
          <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Username Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            Tên đăng nhập
          </label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('username')}
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              placeholder="vd: traveler_01"
              className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {errors.username ? (
            <p className="text-xs text-destructive mt-1">{errors.username.message}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              3-32 ký tự, gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang (không chứa @)
            </p>
          )}
        </div>

        {/* Full Name Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            Họ và tên
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('fullName')}
              type="text"
              autoComplete="name"
              placeholder="vd: Nguyễn Văn A"
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
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Tối thiểu 15 ký tự"
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
          {errors.password ? (
            <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Mật khẩu an toàn tối thiểu 15 ký tự (chuẩn NIST SP 800-63B), tối đa 72 bytes
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              className="w-full h-10 pl-9 pr-10 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
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
            Tôi đồng ý với{' '}
            <Link href="/" className="text-primary hover:underline font-medium">
              Điều khoản
            </Link>{' '}
            và{' '}
            <Link href="/" className="text-primary hover:underline font-medium">
              Chính sách quyền riêng tư
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
              <span>Đang tạo tài khoản...</span>
            </>
          ) : (
            <span>Tạo tài khoản</span>
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
            Hoặc tiếp tục với
          </span>
        </div>
      </div>

      {/* Google Auth Button */}
      <GoogleAuthButton label="Đăng ký bằng Google" />

      {/* Switch to Login */}
      <p className="text-center text-xs text-muted-foreground">
        Đã có tài khoản?{' '}
        <Link
          href={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login'}
          className="text-primary font-semibold hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}

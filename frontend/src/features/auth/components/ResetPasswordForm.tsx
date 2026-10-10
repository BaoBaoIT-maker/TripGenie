'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  resetPasswordSchema,
  ResetPasswordFormData,
} from '../schemas/auth.schema';
import { useAuth } from '../hooks/use-auth';

export function ResetPasswordForm() {
  const router = useRouter();
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

  React.useEffect(() => {
    if (typeof window !== 'undefined' && !resetTicket) {
      toast.error('Vé xác thực đặt lại mật khẩu đã hết hạn hoặc không tồn tại.');
      router.push('/forgot-password');
    }
  }, [resetTicket, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!resetTicket) {
      toast.error('Vé xác thực không hợp lệ. Vui lòng thử lại.');
      router.push('/forgot-password');
      return;
    }

    setServerError(null);

    try {
      const response = await resetPassword({
        resetTicket,
        password: data.password,
      });

      setIsSuccess(true);
      toast.success(response.message || 'Đặt lại mật khẩu thành công!');

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('tripgenie:reset_ticket');
      }

      setTimeout(() => {
        router.push('/login');
      }, 1200);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Không thể đặt lại mật khẩu. Vui lòng thử lại từ đầu.';
      setServerError(message);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Tạo mật khẩu mới cho tài khoản của bạn. Mật khẩu phải có tối thiểu 8 ký tự (tối đa 72 bytes) để bảo đảm an toàn.
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
          <span>Mật khẩu đã được cập nhật! Đang chuyển hướng...</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* New Password Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            Mật khẩu mới
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
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

        {/* Confirm Password Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground tracking-wide">
            Xác nhận mật khẩu mới
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              {...register('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              className="w-full h-10 pl-9 pr-10 rounded-xl border border-input bg-background/50 text-sm placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
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
          className="w-full h-10.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-2"
        >
          {isResettingPassword ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Đang lưu mật khẩu mới...</span>
            </>
          ) : (
            <span>Cập nhật mật khẩu</span>
          )}
        </button>
      </form>

      {/* Cancel Link */}
      <div className="text-center pt-2 border-t border-border/60">
        <Link
          href="/login"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium"
        >
          Hủy bỏ và quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
}

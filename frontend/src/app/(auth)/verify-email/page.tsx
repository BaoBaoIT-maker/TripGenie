'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MailCheck,
  ShieldAlert,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { getSafeRedirectUrl } from '@/lib/safe-redirect';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = getSafeRedirectUrl(searchParams.get('next'));

  const [token, setToken] = React.useState<string | null>(null);
  const [hasCheckedToken, setHasCheckedToken] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const { verifyEmail, isVerifyingEmail } = useAuth();

  React.useEffect(() => {
    const rawToken = searchParams.get('token');
    if (rawToken) {
      setToken(rawToken);
      // Strip token from browser address bar immediately to prevent leaking via shoulder surfing or referrer
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    setHasCheckedToken(true);
  }, [searchParams]);

  const handleConfirmVerification = async () => {
    if (!token) return;
    setErrorMessage(null);

    try {
      await verifyEmail(token);
      setIsSuccess(true);
      toast.success('Xác thực email thành công! Chào mừng bạn đến với TripGenie.');
      setTimeout(() => {
        router.push(nextParam || '/explore');
      }, 1200);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thử đăng ký lại.';
      setErrorMessage(message);
    }
  };

  if (!hasCheckedToken) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải thông tin xác thực...</p>
      </div>
    );
  }

  // Success State
  if (isSuccess) {
    return (
      <div className="text-center space-y-5 animate-in fade-in zoom-in-95">
        <div className="size-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
          <CheckCircle2 className="size-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold font-heading text-foreground">
            Kích hoạt tài khoản thành công!
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Hệ thống đang chuyển hướng bạn đến bảng khám phá địa điểm du lịch...
          </p>
        </div>
        <div className="pt-2">
          <Link href={nextParam || '/explore'}>
            <Button className="w-full h-10.5 rounded-xl font-semibold text-xs gap-2 cursor-pointer">
              <span>Khám phá ngay</span>
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Error or Missing Token State
  if (!token) {
    return (
      <div className="text-center space-y-5 animate-in fade-in">
        <div className="size-16 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive mx-auto flex items-center justify-center">
          <ShieldAlert className="size-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold font-heading text-foreground">
            Không tìm thấy mã xác thực
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Đường dẫn xác thực có thể đã hết hạn hoặc đã được sử dụng trước đó. Vui lòng mở lại email từ TripGenie hoặc đăng ký lại để nhận liên kết mới.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link href="/register">
            <Button variant="outline" className="w-full h-10 rounded-xl text-xs font-semibold cursor-pointer">
              Đăng ký lại
            </Button>
          </Link>
          <Link href="/login">
            <Button className="w-full h-10 rounded-xl text-xs font-semibold cursor-pointer">
              Đăng nhập
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Token Available: Ready to Confirm
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
          <MailCheck className="size-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-heading text-foreground">
            Xác nhận kích hoạt tài khoản
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
            Nhấn vào nút bên dưới để hoàn tất việc xác thực email và đăng nhập vào TripGenie.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed space-y-1">
          <p className="font-semibold">{errorMessage}</p>
          <p className="text-muted-foreground">
            Nếu liên kết đã quá 30 phút, vui lòng đăng ký lại để nhận email kích hoạt mới.
          </p>
        </div>
      )}

      <div className="space-y-3 pt-2">
        <Button
          type="button"
          onClick={handleConfirmVerification}
          disabled={isVerifyingEmail}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow"
        >
          {isVerifyingEmail ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Đang kích hoạt tài khoản...</span>
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              <span>Xác thực và tiếp tục</span>
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Đã kích hoạt trước đó?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Kích hoạt tài khoản"
      subtitle="Xác thực quyền sở hữu email để hoàn tất kích hoạt tài khoản TripGenie."
    >
      <React.Suspense
        fallback={
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        }
      >
        <VerifyEmailContent />
      </React.Suspense>
    </AuthShell>
  );
}

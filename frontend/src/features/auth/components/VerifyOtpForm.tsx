'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft, RotateCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/use-auth';

import { getSafeRedirectUrl } from '@/lib/safe-redirect';

export function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const purpose = (searchParams.get('purpose') as 'email-verification' | 'password-reset') || 'email-verification';
  const nextUrl = getSafeRedirectUrl(searchParams.get('next'));

  const [otp, setOtp] = React.useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = React.useState(60);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const {
    verifyOtp,
    isVerifyingOtp,
    verifyResetOtp,
    isVerifyingResetOtp,
    resendOtp,
    isResendingOtp,
  } = useAuth();

  const isSubmitting = isVerifyingOtp || isVerifyingResetOtp;

  // Countdown timer for resend
  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Focus first input on mount
  React.useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInputChange = (index: number, value: string) => {
    // Only accept digits
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const nextOtp = [...otp];
      nextOtp[index] = '';
      setOtp(nextOtp);
      return;
    }

    if (cleaned.length === 1) {
      const nextOtp = [...otp];
      nextOtp[index] = cleaned;
      setOtp(nextOtp);

      // Move focus to next input
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (cleaned.length === 6) {
      // Pasted 6 digits
      const digits = cleaned.split('').slice(0, 6);
      setOtp(digits);
      inputRefs.current[5]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split('');
      setOtp(digits);
      inputRefs.current[5]?.focus();
    }
  };

  const fullOtp = otp.join('');
  const isComplete = fullOtp.length === 6;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isComplete || isSubmitting) return;

    setServerError(null);

    try {
      if (purpose === 'password-reset') {
        const result = await verifyResetOtp({
          email,
          otp: fullOtp,
        });

        setIsSuccess(true);
        toast.success('Xác thực OTP thành công!');

        // Store reset ticket securely in sessionStorage for next step
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('tripgenie:reset_ticket', result.resetTicket);
        }

        setTimeout(() => {
          router.push('/reset-password');
        }, 800);
      } else {
        await verifyOtp({
          email,
          otp: fullOtp,
        });

        setIsSuccess(true);
        toast.success('Xác thực tài khoản thành công!');

        setTimeout(() => {
          router.push(nextUrl);
          router.refresh();
        }, 800);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Mã OTP không chính xác hoặc đã hết hạn';
      setServerError(message);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResendingOtp) return;
    setServerError(null);

    try {
      const result = await resendOtp({
        email,
        purpose,
      });

      toast.success(result.message || 'Mã OTP mới đã được gửi tới email!');
      setCountdown(result.retryAfter || 60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.';
      setServerError(message);
    }
  };

  if (!email) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive">
          Không tìm thấy thông tin email cần xác thực.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          <span>Quay lại trang đăng nhập</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email badge preview */}
      <div className="rounded-2xl bg-muted/50 border border-border/80 p-3.5 text-center space-y-1">
        <span className="text-xs text-muted-foreground">Mã OTP đã được gửi đến:</span>
        <div className="font-semibold text-sm text-foreground break-all">{email}</div>
      </div>

      {serverError && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm leading-relaxed animate-in fade-in">
          <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {isSuccess && (
        <div className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="size-4.5" />
          <span>Xác thực thành công! Đang chuyển hướng...</span>
        </div>
      )}

      {/* 6 Digit Input Boxes */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between items-center gap-2 sm:gap-3">
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete={idx === 0 ? 'one-time-code' : 'off'}
              value={digit}
              onChange={(e) => handleInputChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              className={`size-11 sm:size-12 text-center text-xl font-bold font-mono rounded-xl border bg-background/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                digit
                  ? 'border-primary text-primary shadow-xs'
                  : 'border-input text-foreground'
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={!isComplete || isSubmitting || isSuccess}
          className="w-full h-10.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Đang kiểm tra mã...</span>
            </>
          ) : (
            <span>Xác nhận mã OTP</span>
          )}
        </button>
      </form>

      {/* Resend & Change Email Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground border-t border-border/60">
        <div>
          {countdown > 0 ? (
            <span>
              Gửi lại mã sau <strong className="text-foreground">{countdown}s</strong>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResendingOtp}
              className="inline-flex items-center gap-1 text-primary font-semibold hover:underline cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`size-3 ${isResendingOtp ? 'animate-spin' : ''}`} />
              <span>Gửi lại mã OTP</span>
            </button>
          )}
        </div>

        <Link
          href={purpose === 'password-reset' ? '/forgot-password' : '/register'}
          className="hover:text-foreground hover:underline transition-colors font-medium"
        >
          Đổi địa chỉ email khác
        </Link>
      </div>
    </div>
  );
}

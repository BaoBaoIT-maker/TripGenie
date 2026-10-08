import * as React from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { VerifyOtpForm } from '@/features/auth/components/VerifyOtpForm';

export const metadata: Metadata = {
  title: 'Xác thực mã OTP | TripGenie',
  description: 'Nhập mã xác thực 6 chữ số được gửi tới email của bạn để bảo mật tài khoản.',
};

export default function VerifyOtpPage() {
  return (
    <AuthShell
      title="Xác thực bảo mật OTP"
      subtitle="Nhập mã xác nhận gồm 6 chữ số được gửi tới hộp thư email của bạn."
    >
      <React.Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Đang tải...</div>}>
        <VerifyOtpForm />
      </React.Suspense>
    </AuthShell>
  );
}

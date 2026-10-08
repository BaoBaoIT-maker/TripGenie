import * as React from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Quên mật khẩu | TripGenie',
  description: 'Yêu cầu mã xác thực OTP qua email để khôi phục quyền truy cập tài khoản TripGenie.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Khôi phục mật khẩu"
      subtitle="Chúng tôi sẽ gửi mã OTP bảo mật tới email của bạn để thiết lập lại mật khẩu."
    >
      <React.Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Đang tải...</div>}>
        <ForgotPasswordForm />
      </React.Suspense>
    </AuthShell>
  );
}

import * as React from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Đặt lại mật khẩu mới | TripGenie',
  description: 'Tạo mật khẩu đăng nhập mới an toàn cho tài khoản TripGenie của bạn.',
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Thiết lập mật khẩu mới"
      subtitle="Nhập mật khẩu mới an toàn cho tài khoản của bạn để hoàn tất khôi phục."
    >
      <React.Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Đang tải...</div>}>
        <ResetPasswordForm />
      </React.Suspense>
    </AuthShell>
  );
}

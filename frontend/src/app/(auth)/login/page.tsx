import * as React from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata: Metadata = {
  title: 'Đăng nhập | TripGenie',
  description: 'Đăng nhập vào tài khoản TripGenie để quản lý lịch trình và khám phá các địa điểm du lịch.',
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Chào mừng bạn trở lại"
      subtitle="Đăng nhập để tiếp tục khám phá và quản lý các chuyến đi của bạn."
    >
      <React.Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Đang tải...</div>}>
        <LoginForm />
      </React.Suspense>
    </AuthShell>
  );
}

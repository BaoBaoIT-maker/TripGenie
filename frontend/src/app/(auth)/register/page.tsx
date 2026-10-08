import * as React from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { RegisterForm } from '@/features/auth/components/RegisterForm';

export const metadata: Metadata = {
  title: 'Đăng ký tài khoản | TripGenie',
  description: 'Tạo tài khoản TripGenie miễn phí để nhận gợi ý lịch trình du lịch thông minh bằng AI.',
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Bắt đầu hành trình mới"
      subtitle="Tạo tài khoản TripGenie miễn phí để tối ưu hóa trải nghiệm du lịch cá nhân hóa."
    >
      <React.Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Đang tải...</div>}>
        <RegisterForm />
      </React.Suspense>
    </AuthShell>
  );
}

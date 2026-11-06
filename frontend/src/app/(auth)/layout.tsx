import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Xác thực tài khoản | TripGenie',
  description: 'Đăng nhập, đăng ký và quản lý bảo mật tài khoản TripGenie',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

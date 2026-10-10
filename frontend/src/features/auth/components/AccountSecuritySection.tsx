'use client';

import * as React from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  CheckCircle2,
  KeyRound,
  User,
  Shield,
} from 'lucide-react';
import { useAuth } from '../hooks/use-auth';

export function AccountSecuritySection() {
  const { user } = useAuth();

  const isGoogleAuth = user?.authMethods?.includes('GOOGLE');
  const hasLocalPassword = user?.authMethods?.includes('LOCAL');

  return (
    <div className="space-y-6">
      {/* Account Info Card */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary tracking-wider">
              <ShieldCheck className="size-4" />
              <span>Bảo mật & Phương thức đăng nhập</span>
            </div>
            <h2 className="text-xl font-bold font-heading text-foreground">
              Thông tin tài khoản
            </h2>
            <p className="text-xs text-muted-foreground">
              Quản lý tài khoản đăng nhập và phương thức xác thực bảo mật của bạn.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" />
                Địa chỉ Email
              </span>
              {user?.isVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="size-3" />
                  Đã xác thực
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground">
              {user?.email || (
                <span className="text-muted-foreground italic font-normal">Chưa có email</span>
              )}
            </p>
          </div>

          {/* Full Name Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="size-3.5 text-primary" />
              Họ và tên
            </span>
            <p className="text-sm font-bold text-foreground">
              {user?.fullName}
            </p>
          </div>

          {/* Auth Method Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-primary" />
              Phương thức đăng nhập
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {hasLocalPassword && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <Lock className="size-3" />
                  Mật khẩu tài khoản
                </span>
              )}
              {isGoogleAuth && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  <Mail className="size-3" />
                  Google OAuth
                </span>
              )}
            </div>
          </div>

          {/* Account Role Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Shield className="size-3.5 text-primary" />
              Vai trò tài khoản
            </span>
            <p className="text-sm font-bold text-foreground">
              {user?.role === 'ADMIN' ? 'Quản trị viên (Admin)' : 'Thành viên du lịch (User)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

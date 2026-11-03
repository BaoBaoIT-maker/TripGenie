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
  Camera,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '../hooks/use-auth';
import { DEFAULT_AVATAR } from '@/config/avatars';
import { AvatarPickerModal } from './AvatarPickerModal';

interface AccountSecuritySectionProps {
  onOpenAvatarModal?: () => void;
}

export function AccountSecuritySection({ onOpenAvatarModal }: AccountSecuritySectionProps = {}) {
  const { user, logout } = useAuth();
  const [internalModalOpen, setInternalModalOpen] = React.useState(false);

  const isGoogleAuth = user?.authMethods?.includes('GOOGLE');
  const hasLocalPassword = user?.authMethods?.includes('LOCAL');

  const handleOpenModal = () => {
    if (onOpenAvatarModal) {
      onOpenAvatarModal();
    } else {
      setInternalModalOpen(true);
    }
  };

  const userInitials = React.useMemo(() => {
    if (!user?.fullName) return 'TG';
    return user.fullName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [user?.fullName]);

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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="text-xs rounded-xl h-9 px-4 gap-1.5 text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive self-start sm:self-auto cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>Đăng xuất</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Avatar Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleOpenModal}
                className="outline-none cursor-pointer rounded-full transition-transform hover:scale-105 active:scale-95 group shrink-0"
                title="Nhấn để đổi ảnh đại diện"
              >
                <Avatar className="size-12 border-2 border-primary/20 group-hover:border-primary transition-colors">
                  <AvatarImage
                    src={user?.avatarUrl || DEFAULT_AVATAR}
                    alt={user?.fullName || 'Avatar'}
                  />
                  <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Camera className="size-3.5 text-primary" />
                  Ảnh đại diện
                </span>
                <p className="text-xs font-bold text-foreground truncate">
                  {user?.avatarUrl?.startsWith('data:')
                    ? 'Ảnh tự tải lên'
                    : user?.avatarUrl?.includes('avatar-')
                    ? 'Ảnh đã chọn'
                    : user?.avatarUrl?.includes('default-2')
                    ? 'Mặc định (Nữ)'
                    : 'Mặc định (Nam)'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenModal}
              className="text-xs rounded-xl h-8 px-3 shrink-0 cursor-pointer"
            >
              Đổi ảnh
            </Button>
          </div>

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
            <p className="text-sm font-bold text-foreground truncate">
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
            <p className="text-sm font-bold text-foreground truncate">
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

      {!onOpenAvatarModal && (
        <AvatarPickerModal
          open={internalModalOpen}
          onOpenChange={setInternalModalOpen}
          currentAvatarUrl={user?.avatarUrl}
          userFullName={user?.fullName}
        />
      )}
    </div>
  );
}

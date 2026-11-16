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
  Save,
  Loader2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '../hooks/use-auth';
import { useUpdateProfile } from '../hooks/use-update-profile';
import { DEFAULT_AVATAR } from '@/config/avatars';
import { AvatarPickerModal } from './AvatarPickerModal';

interface AccountSecuritySectionProps {
  onOpenAvatarModal?: () => void;
}

export function AccountSecuritySection({ onOpenAvatarModal }: AccountSecuritySectionProps = {}) {
  const { user, logout, isLoggingOut } = useAuth();
  const updateProfileMutation = useUpdateProfile();
  const [internalModalOpen, setInternalModalOpen] = React.useState(false);

  const [fullName, setFullName] = React.useState(user?.fullName || '');
  const [bio, setBio] = React.useState(user?.bio || '');

  React.useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setBio(user.bio || '');
    }
  }, [user?.id, user?.fullName, user?.bio]);

  const isGoogleAuth = user?.authMethods?.includes('GOOGLE');
  const hasLocalPassword = user?.authMethods?.includes('LOCAL');

  const handleOpenModal = () => {
    if (onOpenAvatarModal) {
      onOpenAvatarModal();
    } else {
      setInternalModalOpen(true);
    }
  };

  const isDirty =
    fullName.trim() !== (user?.fullName || '').trim() ||
    bio.trim() !== (user?.bio || '').trim();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      toast.error('Họ và tên phải có ít nhất 2 ký tự');
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        fullName: trimmedName,
        bio: bio.trim(),
      });
      toast.success('Cập nhật thông tin hồ sơ thành công');
    } catch {
      toast.error('Không thể cập nhật hồ sơ. Vui lòng thử lại.');
    }
  };

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'TG';

  return (
    <div className="space-y-6">
      {/* 1. Profile Information Card (Interactive Editing) */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-xs"
      >
        <div className="border-b border-border pb-4 space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary tracking-wider">
            <User className="size-4" />
            <span>Thông tin cá nhân</span>
          </div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            Hồ sơ người dùng
          </h2>
          <p className="text-xs text-muted-foreground">
            Chỉnh sửa họ tên và thông tin giới thiệu của bạn trên hệ thống TripGenie.
          </p>
        </div>

        <div className="space-y-5">
          {/* Avatar Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={handleOpenModal}
                className="outline-none cursor-pointer rounded-full transition-transform hover:scale-105 active:scale-95 group shrink-0"
                title="Nhấn để đổi ảnh đại diện"
              >
                <Avatar className="size-14 border-2 border-primary/20 group-hover:border-primary transition-colors">
                  <AvatarImage
                    src={user?.avatarUrl || DEFAULT_AVATAR}
                    alt={user?.fullName || 'Avatar'}
                  />
                  <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Camera className="size-3.5 text-primary" />
                  Ảnh đại diện
                </span>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">
                  {user?.avatarUrl?.startsWith('http') && user?.avatarUrl?.includes('cloudinary')
                    ? 'Ảnh tải lên Cloudinary'
                    : user?.avatarUrl?.startsWith('data:')
                    ? 'Ảnh tự tải lên'
                    : user?.avatarUrl?.includes('avatar-')
                    ? 'Ảnh có sẵn'
                    : 'Ảnh mặc định'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenModal}
              className="text-xs rounded-xl h-9 px-4 shrink-0 cursor-pointer self-start sm:self-center"
            >
              Đổi ảnh đại diện
            </Button>
          </div>

          {/* Full Name Input */}
          <div className="space-y-2">
            <label
              htmlFor="profile-full-name"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
            >
              <User className="size-3.5 text-primary" />
              <span>Họ và tên *</span>
            </label>
            <Input
              id="profile-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên hiển thị..."
              className="h-11 rounded-xl text-sm bg-background border-border/80 focus-visible:border-primary px-3.5"
              maxLength={100}
              required
            />
          </div>

          {/* Bio Textarea */}
          <div className="space-y-2">
            <label
              htmlFor="profile-bio"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
            >
              <FileText className="size-3.5 text-primary" />
              <span>Tiểu sử / Giới thiệu ngắn</span>
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Chia sẻ đôi nét về gu du lịch hoặc niềm đam mê khám phá của bạn..."
              className="w-full min-h-[88px] rounded-xl text-sm bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary p-3 outline-none transition-colors resize-none placeholder:text-muted-foreground"
              maxLength={250}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {bio.length}/250 ký tự
            </p>
          </div>
        </div>

        {/* Save Button Bar */}
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isDirty ? 'Bạn có thay đổi chưa lưu' : 'Thông tin hồ sơ đã được đồng bộ'}
          </p>
          <Button
            type="submit"
            disabled={!isDirty || updateProfileMutation.isPending}
            className="rounded-xl font-semibold text-xs h-10 px-5 gap-2 cursor-pointer shadow-xs disabled:cursor-not-allowed"
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>Lưu thay đổi</span>
          </Button>
        </div>
      </form>

      {/* 2. Security & Credentials Card */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="border-b border-border pb-4 space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary tracking-wider">
            <ShieldCheck className="size-4" />
            <span>Phương thức đăng nhập & Định danh</span>
          </div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            Bảo mật tài khoản
          </h2>
          <p className="text-xs text-muted-foreground">
            Phương thức xác thực dùng để đăng nhập vào TripGenie.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Auth Method Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-primary" />
              Phương thức xác thực
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {hasLocalPassword && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <Lock className="size-3" />
                  Mật khẩu
                </span>
              )}
              {isGoogleAuth && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
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
              Vai trò hệ thống
            </span>
            <p className="text-sm font-bold text-foreground">
              {user?.role === 'ADMIN' ? 'Quản trị viên (Admin)' : 'Thành viên du lịch'}
            </p>
          </div>
        </div>
      </div>

      {/* Standalone Logout Button */}
      <div className="pt-1 flex justify-start">
        <Button
          type="button"
          variant="outline"
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="text-xs font-semibold rounded-xl h-10 px-5 gap-2 text-destructive border-destructive/25 hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors"
        >
          {isLoggingOut ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <i className="fa-solid fa-arrow-right-from-bracket text-xs" aria-hidden="true" />
          )}
          <span>Đăng xuất tài khoản</span>
        </Button>
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

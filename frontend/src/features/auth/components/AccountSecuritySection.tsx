'use client';

import * as React from 'react';
import {
  ShieldCheck,
  Mail,
  AtSign,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  KeyRound,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/use-auth';
import { Button } from '@/components/ui/button';

export function AccountSecuritySection() {
  const {
    user,
    refetchUser,
    reauthenticate,
    isReauthenticating,
    startGoogleLink,
    isStartingGoogleLink,
    updateUsername,
    isUpdatingUsername,
  } = useAuth();

  const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);
  const [passwordInput, setPasswordInput] = React.useState('');
  const [modalError, setModalError] = React.useState<string | null>(null);

  const [isUsernameModalOpen, setIsUsernameModalOpen] = React.useState(false);
  const [newUsername, setNewUsername] = React.useState('');
  const [usernameError, setUsernameError] = React.useState<string | null>(null);

  const handleStartGoogleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!passwordInput) {
      setModalError('Vui lòng nhập mật khẩu hiện tại');
      return;
    }

    try {
      // 1. Reauthenticate to get one-time short-lived grant token
      const reauthRes = await reauthenticate(passwordInput);

      // 2. Start OAuth link flow with grant token
      const linkRes = await startGoogleLink({
        grantToken: reauthRes.grantToken,
        returnUrl: '/profile',
      });

      // 3. Redirect to Google Authorization
      window.location.href = linkRes.url;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Xác thực mật khẩu không thành công';
      setModalError(message);
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);

    const trimmed = newUsername.trim().toLowerCase();
    if (!trimmed) {
      setUsernameError('Vui lòng nhập tên tài khoản');
      return;
    }

    if (trimmed.length < 3 || trimmed.length > 32) {
      setUsernameError('Tên tài khoản phải từ 3 đến 32 ký tự');
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
      setUsernameError('Tên tài khoản chỉ gồm chữ cái, số, dấu chấm, gạch dưới hoặc gạch ngang');
      return;
    }

    try {
      await updateUsername(trimmed);
      toast.success('Cập nhật tên tài khoản thành công!');
      setIsUsernameModalOpen(false);
      refetchUser();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Không thể cập nhật tên tài khoản';
      setUsernameError(message);
    }
  };

  const isGoogleLinked = user?.capabilities?.hasGoogleEmailLink || (user?.email && user?.authMethods?.includes('GOOGLE'));
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
              Quản lý tên định danh, mật khẩu và liên kết tài khoản Gmail của bạn.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Username Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <AtSign className="size-3.5 text-primary" />
                Tên đăng nhập
              </span>
              {!user?.username && (
                <button
                  type="button"
                  onClick={() => setIsUsernameModalOpen(true)}
                  className="text-xs text-primary font-bold hover:underline cursor-pointer"
                >
                  + Thiết lập
                </button>
              )}
            </div>
            <p className="text-sm font-bold text-foreground">
              {user?.username ? `@${user.username}` : (
                <span className="text-muted-foreground italic font-normal">Chưa thiết lập (tài khoản cũ)</span>
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
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <Lock className="size-3" />
                  Mật khẩu tài khoản
                </span>
              )}
              {isGoogleLinked && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  <Mail className="size-3" />
                  Google OAuth
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Gmail Link Section */}
        <div className="pt-2 border-t border-border/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-background/50">
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${isGoogleLinked ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                {isGoogleLinked ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    Tài khoản Gmail
                  </h3>
                  {isGoogleLinked ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Đã liên kết
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Chưa liên kết
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
                  {isGoogleLinked ? (
                    <>
                      Địa chỉ: <strong className="text-foreground">{user?.email}</strong>. Được sử dụng để khôi phục mật khẩu và nhận thông báo quan trọng.
                    </>
                  ) : (
                    'Liên kết tài khoản Google để có thể khôi phục mật khẩu khi quên và nhận thông báo chuyến đi.'
                  )}
                </p>
              </div>
            </div>

            {!isGoogleLinked && hasLocalPassword && (
              <Button
                onClick={() => {
                  setPasswordInput('');
                  setModalError(null);
                  setIsLinkModalOpen(true);
                }}
                className="rounded-xl font-bold text-xs h-9.5 shrink-0 gap-1.5 cursor-pointer shadow-xs"
              >
                <Mail className="size-4" />
                <span>Liên kết Gmail</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Reauthenticate Modal to Link Gmail */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-xl space-y-5 animate-in zoom-in-95">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary tracking-wider">
                <Lock className="size-3.5" />
                <span>Xác nhận danh tính</span>
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Nhập mật khẩu để tiếp tục
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Để bảo vệ an toàn cho tài khoản của bạn, vui lòng xác nhận mật khẩu hiện tại trước khi liên kết với Gmail.
              </p>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleStartGoogleLink} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn"
                  className="w-full h-10 px-3.5 rounded-xl border border-input bg-background/50 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLinkModalOpen(false)}
                  disabled={isReauthenticating || isStartingGoogleLink}
                  className="rounded-xl text-xs h-9 cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isReauthenticating || isStartingGoogleLink || !passwordInput}
                  className="rounded-xl font-bold text-xs h-9 gap-1.5 cursor-pointer"
                >
                  {isReauthenticating || isStartingGoogleLink ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Đang xác thực...</span>
                    </>
                  ) : (
                    <>
                      <span>Tiếp tục tới Google</span>
                      <ExternalLink className="size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Setup Username for Legacy Users */}
      {isUsernameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-xl space-y-5 animate-in zoom-in-95">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary tracking-wider">
                <UserCheck className="size-3.5" />
                <span>Cập nhật định danh</span>
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Thiết lập tên đăng nhập
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tên đăng nhập giúp bạn đăng nhập nhanh chóng và bảo vệ tính riêng tư.
              </p>
            </div>

            {usernameError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {usernameError}
              </div>
            )}

            <form onSubmit={handleUpdateUsername} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Tên đăng nhập mới
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="vd: traveler_pro"
                    className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-input bg-background/50 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  3-32 ký tự, chỉ gồm chữ cái, số, dấu chấm, gạch dưới hoặc gạch ngang (không chứa @).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUsernameModalOpen(false)}
                  disabled={isUpdatingUsername}
                  className="rounded-xl text-xs h-9 cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdatingUsername || !newUsername.trim()}
                  className="rounded-xl font-bold text-xs h-9 gap-1.5 cursor-pointer"
                >
                  {isUpdatingUsername ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu tên đăng nhập</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

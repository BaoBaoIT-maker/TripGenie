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
import { useI18n } from '@/i18n';
import { AvatarPickerModal } from './AvatarPickerModal';

interface AccountSecuritySectionProps {
  onOpenAvatarModal?: () => void;
}

export function AccountSecuritySection({ onOpenAvatarModal }: AccountSecuritySectionProps = {}) {
  const { t } = useI18n();
  const { user, logout, isLoggingOut } = useAuth();
  const updateProfileMutation = useUpdateProfile();
  const [internalModalOpen, setInternalModalOpen] = React.useState(false);

  const [fullName, setFullName] = React.useState(user?.fullName || '');
  const [bio, setBio] = React.useState(user?.bio || '');

  const userSyncKey = `${user?.id ?? ''}|${user?.fullName ?? ''}|${user?.bio ?? ''}`;
  const [prevUserSyncKey, setPrevUserSyncKey] = React.useState(userSyncKey);
  if (user && userSyncKey !== prevUserSyncKey) {
    setPrevUserSyncKey(userSyncKey);
    setFullName(user.fullName || '');
    setBio(user.bio || '');
  }

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
      toast.error(t('profile.account.nameMinError'));
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        fullName: trimmedName,
        bio: bio.trim(),
      });
      toast.success(t('profile.account.updateSuccess'));
    } catch {
      toast.error(t('profile.account.updateError'));
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
            <span>{t('profile.account.eyebrow')}</span>
          </div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            {t('profile.account.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('profile.account.subtitle')}
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
                title={t('profile.changeAvatarTooltip')}
              >
                <Avatar className="size-14 border-2 border-primary/20 group-hover:border-primary transition-colors">
                  <AvatarImage
                    src={user?.avatarUrl || DEFAULT_AVATAR}
                    alt={user?.fullName || t('profile.avatarAlt')}
                  />
                  <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Camera className="size-3.5 text-primary" />
                  {t('profile.account.avatarLabel')}
                </span>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">
                  {user?.avatarUrl?.startsWith('http') && user?.avatarUrl?.includes('cloudinary')
                    ? t('profile.account.avatarCloudinary')
                    : user?.avatarUrl?.startsWith('data:')
                    ? t('profile.account.avatarUploaded')
                    : user?.avatarUrl?.includes('avatar-')
                    ? t('profile.account.avatarPreset')
                    : t('profile.account.avatarDefault')}
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
              {t('profile.account.changeAvatar')}
            </Button>
          </div>

          {/* Full Name Input */}
          <div className="space-y-2">
            <label
              htmlFor="profile-full-name"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
            >
              <User className="size-3.5 text-primary" />
              <span>{t('profile.account.fullNameLabel')}</span>
            </label>
            <Input
              id="profile-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('profile.account.fullNamePlaceholder')}
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
              <span>{t('profile.account.bioLabel')}</span>
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('profile.account.bioPlaceholder')}
              className="w-full min-h-[88px] rounded-xl text-sm bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary p-3 outline-none transition-colors resize-none placeholder:text-muted-foreground"
              maxLength={250}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {t('profile.account.bioCount', { count: bio.length })}
            </p>
          </div>
        </div>

        {/* Save Button Bar */}
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isDirty ? t('profile.account.unsavedChanges') : t('profile.account.syncedStatus')}
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
            <span>{t('profile.account.saveChanges')}</span>
          </Button>
        </div>
      </form>

      {/* 2. Security & Credentials Card */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="border-b border-border pb-4 space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary tracking-wider">
            <ShieldCheck className="size-4" />
            <span>{t('profile.account.securityEyebrow')}</span>
          </div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            {t('profile.account.securityTitle')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('profile.account.securitySubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Email Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" />
                {t('profile.account.emailLabel')}
              </span>
              {user?.isVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="size-3" />
                  {t('profile.account.verifiedBadge')}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground truncate">
              {user?.email || (
                <span className="text-muted-foreground italic font-normal">{t('profile.account.noEmail')}</span>
              )}
            </p>
          </div>

          {/* Auth Method Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-primary" />
              {t('profile.account.authMethodLabel')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {hasLocalPassword && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <Lock className="size-3" />
                  {t('profile.account.passwordMethod')}
                </span>
              )}
              {isGoogleAuth && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  <Mail className="size-3" />
                  {t('profile.account.googleMethod')}
                </span>
              )}
            </div>
          </div>

          {/* Account Role Item */}
          <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Shield className="size-3.5 text-primary" />
              {t('profile.account.roleLabel')}
            </span>
            <p className="text-sm font-bold text-foreground">
              {user?.role === 'ADMIN' ? t('profile.account.roleAdmin') : t('profile.account.roleMember')}
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
          <span>{t('profile.account.logoutButton')}</span>
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

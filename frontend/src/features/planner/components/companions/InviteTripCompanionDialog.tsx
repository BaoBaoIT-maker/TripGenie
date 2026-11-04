'use client';

import React, { useState } from 'react';
import { Mail, Loader2, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInviteCompanion } from '../../hooks/use-trip-companions';

interface InviteTripCompanionDialogProps {
  open: boolean;
  onClose: () => void;
  itineraryId: string;
}

export function InviteTripCompanionDialog({
  open,
  onClose,
  itineraryId,
}: InviteTripCompanionDialogProps) {
  const [email, setEmail] = useState('');
  const inviteMutation = useInviteCompanion(itineraryId);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    inviteMutation.mutate(trimmed, {
      onSuccess: () => {
        setEmail('');
        onClose();
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-companion-title"
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <UserPlus className="size-4 text-primary" />
            <h2 id="invite-companion-title" className="text-base font-bold font-heading">
              Mời bạn đồng hành
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="companion-email" className="block text-xs font-semibold text-foreground">
              Địa chỉ email tài khoản TripGenie
            </label>
            <div className="relative">
              <Mail className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="companion-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="banbe@gmail.com"
                disabled={inviteMutation.isPending}
                className="w-full h-11 pl-9 pr-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-50"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              Người được mời sẽ nhận thông báo trong ứng dụng với quyền <strong>Chỉ xem</strong>. Bạn có thể cấp quyền chỉnh sửa cho thành viên bất kỳ lúc nào sau khi họ tham gia.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={inviteMutation.isPending}
              className="h-10 px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={!email.trim() || inviteMutation.isPending}
              className="h-10 px-5 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
            >
              {inviteMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>Gửi lời mời</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

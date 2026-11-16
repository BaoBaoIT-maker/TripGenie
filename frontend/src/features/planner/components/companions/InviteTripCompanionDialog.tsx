'use client';

import React, { useState } from 'react';
import { AppModalPortal } from '@/components/common/AppModalPortal';
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
    <AppModalPortal
      open={open}
      onClose={onClose}
      ariaLabelledBy="invite-companion-title"
      maxWidthClass="max-w-md"
      disableClose={inviteMutation.isPending}
      mobileBottomSheet
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2.5 text-[#10243A] font-semibold">
          <div className="size-8 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center">
            <i className="fa-solid fa-user-plus text-xs" aria-hidden="true" />
          </div>
          <h2 id="invite-companion-title" className="text-sm font-bold">
            Mời bạn đồng hành
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={inviteMutation.isPending}
          aria-label="Đóng hộp thoại"
          className="size-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="companion-email" className="block text-xs font-semibold text-slate-800">
            Địa chỉ email tài khoản TripGenie
          </label>
          <div className="relative">
            <i
              className="fa-regular fa-envelope text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="companion-email"
              type="email"
              required
              autoComplete="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="banbe@gmail.com"
              disabled={inviteMutation.isPending}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3] transition-colors disabled:opacity-50"
            />
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
            Người được mời sẽ nhận thông báo trong ứng dụng với quyền <strong>Chỉ xem</strong> (có thể tham gia bình chọn ngay). Bạn có thể cấp quyền chỉnh sửa bất kỳ lúc nào.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={inviteMutation.isPending}
            className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!email.trim() || inviteMutation.isPending}
            className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {inviteMutation.isPending && (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
            )}
            <span>Gửi lời mời</span>
          </button>
        </div>
      </form>
    </AppModalPortal>
  );
}

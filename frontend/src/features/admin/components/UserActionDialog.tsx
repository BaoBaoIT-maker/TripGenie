"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { AppModalPortal } from "@/components/common/AppModalPortal";
import type { AdminUserItem } from "@/types/admin";
import { ADMIN_UI_CONSTANTS } from "../admin.constants";
import { useBanAdminUser, usePromoteAdminUser } from "../hooks/use-admin";

export interface UserActionDialogState {
  user: AdminUserItem;
  mode: "BAN" | "PROMOTE";
}

interface UserActionDialogProps {
  target: UserActionDialogState | null;
  onClose: () => void;
}

export function UserActionDialog({ target, onClose }: UserActionDialogProps) {
  const [reason, setReason] = useState("");
  const banMutation = useBanAdminUser();
  const promoteMutation = usePromoteAdminUser();

  const isPending = banMutation.isPending || promoteMutation.isPending;

  useEffect(() => {
    setReason("");
  }, [target]);

  const handleClose = useCallback(() => {
    if (!isPending) {
      setReason("");
      onClose();
    }
  }, [isPending, onClose]);

  if (!target) return null;

  const { user, mode } = target;
  const isBan = mode === "BAN";
  const trimmedReason = reason.trim();
  const canSubmit = isBan
    ? trimmedReason.length >= ADMIN_UI_CONSTANTS.MIN_BAN_REASON_LENGTH
    : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (isBan) {
      await banMutation.mutateAsync({
        userId: user.id,
        reason: trimmedReason,
      });
    } else {
      await promoteMutation.mutateAsync({
        userId: user.id,
        notes: trimmedReason || undefined,
      });
    }
    handleClose();
  };

  return (
    <AppModalPortal
      open={Boolean(target)}
      onClose={handleClose}
      ariaLabelledBy="user-action-modal-title"
      maxWidthClass="max-w-md"
    >
      {/* Community-style Popup Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className={`size-9 rounded-[10px] text-white flex items-center justify-center text-sm ${
              isBan
                ? "bg-rose-500"
                : "bg-[#0194F3] shadow-[0_2px_6px_rgba(1,148,243,0.25)]"
            }`}
          >
            <i
              className={
                isBan ? "fa-solid fa-lock" : "fa-solid fa-user-shield"
              }
              aria-hidden="true"
            />
          </div>
          <div>
            <h3
              id="user-action-modal-title"
              className="text-sm font-bold text-slate-900"
            >
              {isBan
                ? "Khóa Tài khoản Người dùng"
                : "Thăng quyền Quản trị viên"}
            </h3>
            <p className="text-[11px] text-[#64748B]">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isPending}
          aria-label="Đóng hộp thoại"
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
        <p className="text-slate-600 leading-relaxed">
          {isBan ? (
            <>
              Khóa tài khoản <b>{user.fullName}</b> ({user.email}) và thu hồi
              tức thì toàn bộ phiên đăng nhập hiện tại.
            </>
          ) : (
            <>
              Thăng cấp một chiều tài khoản <b>{user.fullName}</b> (
              {user.email}) lên quyền <b>ADMIN</b>.
            </>
          )}
        </p>

        <div className="space-y-1.5">
          <label
            htmlFor="user-action-reason-input"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            {isBan ? (
              <>
                Lý do khóa tài khoản <span className="text-rose-500">*</span>
              </>
            ) : (
              "Ghi chú bổ nhiệm (Tùy chọn)"
            )}
          </label>
          <input
            id="user-action-reason-input"
            type="text"
            required={isBan}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isBan
                ? "Nhập lý do vi phạm (tối thiểu 3 ký tự)..."
                : "VD: Bổ nhiệm quản trị viên nội dung..."
            }
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="h-9 px-4 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#334155] transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            className={`h-9 px-4 rounded-[10px] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${
              isBan
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-[#0194F3] hover:bg-[#007FE3]"
            }`}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>
              {isBan ? "Xác nhận Khóa" : "Xác nhận Thăng Admin"}
            </span>
          </button>
        </div>
      </form>
    </AppModalPortal>
  );
}

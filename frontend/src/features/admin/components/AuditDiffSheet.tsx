"use client";

import { X } from "lucide-react";
import { AppModalPortal } from "@/components/common/AppModalPortal";
import type { AdminAuditLogItem } from "@/types/admin";
import {
  ADMIN_AUDIT_ACTION_STYLES,
  formatAdminDateTime,
} from "../admin.constants";

interface AuditDiffSheetProps {
  log: AdminAuditLogItem | null;
  onClose: () => void;
}

export function AuditDiffSheet({ log, onClose }: AuditDiffSheetProps) {
  if (!log) return null;

  const actionMeta = ADMIN_AUDIT_ACTION_STYLES[log.action] ?? {
    label: log.action,
    badgeClass: "bg-slate-100 text-slate-700",
  };

  return (
    <AppModalPortal
      open={Boolean(log)}
      onClose={onClose}
      ariaLabelledBy="audit-diff-modal-title"
      maxWidthClass="max-w-lg"
    >
      {/* Community-style Popup Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-[10px] bg-[#0194F3] text-white flex items-center justify-center text-sm shadow-[0_2px_6px_rgba(1,148,243,0.25)]">
            <i className="fa-solid fa-code-compare" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="audit-diff-modal-title"
              className="text-sm font-bold text-slate-900"
            >
              Chi tiết Nhật ký Kiểm toán
            </h3>
            <p className="text-[11px] text-[#64748B]">
              {actionMeta.label} • {formatAdminDateTime(log.createdAt)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng hộp thoại"
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4 overflow-y-auto text-xs">
        <div className="p-4 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#64748B]">Quản trị viên:</span>
            <span className="font-bold text-[#0F172A]">
              {log.actor?.email || log.actor?.fullName || "Hệ thống"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#64748B]">Đối tượng:</span>
            <span className="font-bold text-[#0F172A]">
              {log.targetLabel || log.targetType}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#64748B]">Địa chỉ IP:</span>
            <span className="font-bold text-[#0194F3]">
              {log.ipAddress || "127.0.0.1"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#64748B]">Thiết bị:</span>
            <span className="font-medium text-slate-700 truncate max-w-[260px]">
              {log.userAgent || "Trình duyệt quản trị"}
            </span>
          </div>
          {log.notes && (
            <div className="pt-1.5 border-t border-slate-200/70 flex items-start justify-between gap-2">
              <span className="text-[#64748B] shrink-0">Ghi chú:</span>
              <span className="font-semibold text-[#0F172A] text-right">
                {log.notes}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="font-extrabold text-[#0F172A]">
            Dữ liệu trước thao tác:
          </div>
          <pre className="p-3.5 rounded-[14px] bg-slate-900 text-slate-200 text-xs overflow-x-auto max-h-44">
            {JSON.stringify(log.beforeData ?? null, null, 2)}
          </pre>
        </div>

        <div className="space-y-1.5">
          <div className="font-extrabold text-emerald-700">
            Dữ liệu sau thao tác:
          </div>
          <pre className="p-3.5 rounded-[14px] bg-emerald-950 text-emerald-200 text-xs overflow-x-auto max-h-44">
            {JSON.stringify(log.afterData ?? null, null, 2)}
          </pre>
        </div>

        <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#334155] transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </AppModalPortal>
  );
}

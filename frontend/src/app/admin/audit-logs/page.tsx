"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADMIN_AUDIT_ACTION_STYLES,
  ADMIN_UI_CONSTANTS,
  formatAdminDateTime,
} from "@/features/admin/admin.constants";
import { AuditDiffSheet } from "@/features/admin/components/AuditDiffSheet";
import { useAdminAuditLogs } from "@/features/admin/hooks/use-admin";
import type { AdminAuditAction, AdminAuditLogItem } from "@/types/admin";

export default function AdminAuditLogsPage() {
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogItem | null>(
    null
  );

  const { data, isLoading } = useAdminAuditLogs({
    page,
    limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
    action:
      actionFilter !== "ALL" ? (actionFilter as AdminAuditAction) : undefined,
  });

  const logs = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const totalCount = data?.meta.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Audit Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Tổng bản ghi kiểm toán
          </div>
          <div className="text-2xl font-extrabold text-[#10243A] mt-2">
            {totalCount.toLocaleString("vi-VN")}
          </div>
        </div>
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Trang hiện tại
          </div>
          <div className="text-2xl font-extrabold text-[#0194F3] mt-2">
            {page} / {totalPages}
          </div>
        </div>
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Chế độ ghi nhận
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">
            IP & JSON Diff
          </div>
        </div>
      </div>

      {/* Audit Logs Table Card */}
      <div className="bg-white rounded-[24px] p-6 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo hành động kiểm toán"
            className="h-10 px-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0194F3]"
          >
            <option value="ALL">Tất cả hành động</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="BAN">BAN</option>
            <option value="UNBAN">UNBAN</option>
            <option value="APPROVE">APPROVE</option>
            <option value="REJECT">REJECT</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pr-4">Thời gian</th>
                <th className="py-3.5 px-4">Quản trị viên</th>
                <th className="py-3.5 px-4">Hành động</th>
                <th className="py-3.5 px-4">Đối tượng</th>
                <th className="py-3.5 px-4">Ghi chú</th>
                <th className="py-3.5 pl-4 text-right w-14" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const actionStyle = ADMIN_AUDIT_ACTION_STYLES[log.action] ?? {
                    label: log.action,
                    badgeClass: "bg-slate-100 text-slate-700",
                  };
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                    >
                      <td className="py-4 pr-4 text-slate-500 font-medium whitespace-nowrap">
                        {formatAdminDateTime(log.createdAt)}
                      </td>
                      <td className="py-4 px-4 font-bold text-[#10243A]">
                        {log.actor?.email || log.actor?.fullName || "Admin"}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] ${actionStyle.badgeClass}`}
                        >
                          {actionStyle.label}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800 max-w-[240px] truncate">
                        {log.targetLabel || log.targetType}
                      </td>
                      <td className="py-4 px-4 text-slate-500 max-w-xs truncate">
                        {log.notes || "—"}
                      </td>
                      <td
                        className="py-4 pl-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Mở menu thao tác kiểm toán"
                            className="size-8 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-[#10243A] inline-flex items-center justify-center cursor-pointer outline-none"
                          >
                            <i
                              className="fa-solid fa-ellipsis text-sm"
                              aria-hidden="true"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 rounded-2xl p-1.5 border border-slate-200 bg-white shadow-xl"
                          >
                            <DropdownMenuItem
                              onClick={() => setSelectedLog(log)}
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
                            >
                              <i
                                className="fa-solid fa-code-compare text-[#0194F3] w-4"
                                aria-hidden="true"
                              />
                              <span>Xem chi tiết thay đổi</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-slate-400 font-semibold"
                  >
                    {isLoading
                      ? "Đang tải nhật ký kiểm toán..."
                      : "Không tìm thấy bản ghi kiểm toán nào."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Trang <b className="text-[#10243A]">{page}</b> /{" "}
              <b className="text-[#10243A]">{totalPages}</b>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      <AuditDiffSheet
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}

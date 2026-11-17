"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  PostReviewSheet,
  type ModerationReviewTarget,
} from "@/features/admin/components/PostReviewSheet";
import {
  useAdminAuditLogs,
  useAdminDashboardStats,
  useAdminModerationReports,
} from "@/features/admin/hooks/use-admin";
import type { AdminAuditLogItem } from "@/types/admin";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: stats } = useAdminDashboardStats();
  const { data: auditData } = useAdminAuditLogs({
    page: 1,
    limit: ADMIN_UI_CONSTANTS.DASHBOARD_AUDIT_LIMIT,
  });
  const { data: highPriorityReports } = useAdminModerationReports({
    page: 1,
    limit: 1,
    status: "PENDING",
    highPriorityOnly: true,
  });

  const [selectedAuditLog, setSelectedAuditLog] =
    useState<AdminAuditLogItem | null>(null);
  const [reviewTarget, setReviewTarget] =
    useState<ModerationReviewTarget | null>(null);

  const moderationQueueTotal =
    (stats?.moderation.pendingPosts ?? 0) +
    (stats?.moderation.flaggedPosts ?? 0) +
    (stats?.moderation.highPriorityReportAlerts ?? 0);

  const categoryChartItems = useMemo(() => {
    const raw = stats?.places.byCategory ?? [];
    if (raw.length === 0) return [];
    const topCategories = raw.slice(0, 6);
    const maxCount = Math.max(...topCategories.map((c) => c.placeCount), 1);
    let peakIndex = 0;
    topCategories.forEach((c, idx) => {
      if (c.placeCount > topCategories[peakIndex].placeCount) {
        peakIndex = idx;
      }
    });
    return topCategories.map((c, idx) => ({
      ...c,
      isPeak: idx === peakIndex && c.placeCount > 0,
      heightPercent: Math.max(18, Math.round((c.placeCount / maxCount) * 92)),
    }));
  }, [stats?.places.byCategory]);

  const topReportAlert = highPriorityReports?.items?.[0] ?? null;
  const recentAuditLogs = auditData?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Row 1: 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Priority Card: Moderation Queue */}
        <div
          onClick={() => router.push("/admin/moderation")}
          className="bg-white rounded-[24px] p-5 border border-sky-100 shadow-[0_14px_34px_rgba(1,148,243,0.10)] cursor-pointer transition-transform hover:-translate-y-0.5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Hàng đợi kiểm duyệt
            </span>
            <div className="size-10 rounded-full bg-[#E8F4FD] text-[#0194F3] flex items-center justify-center">
              <i
                className="fa-solid fa-shield-halved text-sm"
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="my-3 flex items-baseline gap-2.5">
            <span className="text-3xl font-extrabold tracking-tight text-[#10243A]">
              {moderationQueueTotal.toLocaleString("vi-VN")}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600">
              <i className="fa-solid fa-fire text-[10px]" aria-hidden="true" />
              {(stats?.moderation.pendingReports ?? 0).toLocaleString("vi-VN")}{" "}
              Reports
            </span>
          </div>
          <div className="text-[11px] font-medium text-slate-400">
            Chờ duyệt:{" "}
            <b className="text-slate-700">
              {stats?.moderation.pendingPosts ?? 0} bài
            </b>{" "}
            • AI gắn cờ:{" "}
            <b className="text-amber-600">
              {stats?.moderation.flaggedPosts ?? 0} bài
            </b>
          </div>
        </div>

        {/* Card 2: Users */}
        <div
          onClick={() => router.push("/admin/users")}
          className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)] cursor-pointer hover:border-slate-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Người dùng hệ thống
            </span>
            <div className="size-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
              <i className="fa-solid fa-users text-sm" aria-hidden="true" />
            </div>
          </div>
          <div className="my-3 flex items-baseline gap-2.5">
            <span className="text-3xl font-extrabold tracking-tight text-[#10243A]">
              {(stats?.users.total ?? 0).toLocaleString("vi-VN")}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600">
              {(stats?.users.active ?? 0).toLocaleString("vi-VN")} hoạt động
            </span>
          </div>
          <div className="text-[11px] font-medium text-slate-400">
            Đang bị khóa:{" "}
            <b className="text-rose-600">
              {stats?.users.banned ?? 0} tài khoản
            </b>
          </div>
        </div>

        {/* Card 3: Places */}
        <div
          onClick={() => router.push("/admin/places")}
          className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)] cursor-pointer hover:border-slate-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Địa điểm du lịch
            </span>
            <div className="size-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
              <i
                className="fa-solid fa-map-location-dot text-sm"
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="my-3 flex items-baseline gap-2.5">
            <span className="text-3xl font-extrabold tracking-tight text-[#10243A]">
              {(stats?.places.total ?? 0).toLocaleString("vi-VN")}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-[#0194F3]">
              {stats?.places.byCategory.length ?? 0} danh mục
            </span>
          </div>
          <div className="text-[11px] font-medium text-slate-400">
            Đang hiển thị:{" "}
            <b className="text-slate-700">
              {(stats?.places.active ?? 0).toLocaleString("vi-VN")}
            </b>{" "}
            • Đã ẩn:{" "}
            <b className="text-slate-600">
              {(stats?.places.inactive ?? 0).toLocaleString("vi-VN")}
            </b>
          </div>
        </div>

        {/* Card 4: Community */}
        <div
          onClick={() => router.push("/admin/community")}
          className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)] cursor-pointer hover:border-slate-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Bài viết & Chủ đề
            </span>
            <div className="size-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
              <i
                className="fa-solid fa-layer-group text-sm"
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="my-3 flex items-baseline gap-2.5">
            <span className="text-3xl font-extrabold tracking-tight text-[#10243A]">
              {(stats?.community.approvedPosts ?? 0).toLocaleString("vi-VN")}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600">
              {stats?.community.activeGroups ?? 0} chủ đề mở
            </span>
          </div>
          <div className="text-[11px] font-medium text-slate-400">
            Tổng bình luận:{" "}
            <b className="text-slate-700">
              {(stats?.community.totalComments ?? 0).toLocaleString("vi-VN")}
            </b>
          </div>
        </div>
      </div>

      {/* Row 2: Category Pill Bar Chart + Dark Navy Spotlight Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-[24px] p-6 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#10243A]">
              Phân bổ Địa điểm theo Danh mục
            </h2>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
              {(stats?.places.active ?? 0).toLocaleString("vi-VN")} địa điểm
            </span>
          </div>

          <div className="mt-8 pt-6 pb-2 px-2">
            {categoryChartItems.length > 0 ? (
              <>
                <div
                  className="grid gap-4 items-end h-48 border-b border-slate-100 pb-3"
                  style={{
                    gridTemplateColumns: `repeat(${categoryChartItems.length}, minmax(0, 1fr))`,
                  }}
                >
                  {categoryChartItems.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex flex-col items-center gap-2 h-full justify-end relative"
                    >
                      {cat.isPeak ? (
                        <div className="absolute -top-9 px-2.5 py-1 rounded-xl bg-[#FF5E1A] text-white text-[11px] font-extrabold shadow-md whitespace-nowrap">
                          {cat.placeCount.toLocaleString("vi-VN")} địa điểm
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500">
                          {cat.placeCount.toLocaleString("vi-VN")}
                        </span>
                      )}
                      <div
                        className={`w-10 sm:w-12 rounded-t-full transition-all ${
                          cat.isPeak
                            ? "bg-[#0194F3] ring-4 ring-sky-100"
                            : "bg-slate-200/90"
                        }`}
                        style={{ height: `${cat.heightPercent}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  className="grid gap-4 pt-3 text-center text-xs font-bold text-slate-500"
                  style={{
                    gridTemplateColumns: `repeat(${categoryChartItems.length}, minmax(0, 1fr))`,
                  }}
                >
                  {categoryChartItems.map((cat) => (
                    <div
                      key={cat.id}
                      className={`truncate ${
                        cat.isPeak ? "text-[#0194F3]" : ""
                      }`}
                    >
                      {cat.nameVi || cat.name}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs font-semibold text-slate-400">
                Chưa có dữ liệu phân bổ danh mục.
              </div>
            )}
          </div>
        </div>

        {/* Dark Navy Spotlight Card for >= 20 Reports */}
        <div className="lg:col-span-5 bg-[#10243A] text-white rounded-[24px] p-6 shadow-[0_14px_34px_rgba(16,36,58,0.18)] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h2 className="text-base font-extrabold">
                Báo cáo khẩn cấp (&ge;{" "}
                {stats?.moderation.highPriorityReportThreshold ?? 20} lượt)
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold border border-rose-400/30">
              Chống công kích hội đồng
            </span>
          </div>

          <div className="my-4 relative">
            {topReportAlert ? (
              <>
                <div className="bg-white text-[#10243A] rounded-2xl p-4 shadow-lg relative z-10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[11px] font-extrabold">
                        {topReportAlert.targetReportCount} lượt báo cáo
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                        Vẫn đang hiển thị
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {formatAdminDateTime(topReportAlert.createdAt)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#10243A] line-clamp-1">
                      {topReportAlert.targetPost?.title ||
                        `Nội dung #${topReportAlert.targetId.slice(0, 8)}`}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      Tác giả:{" "}
                      {topReportAlert.targetPost?.user?.fullName ||
                        "Thành viên"}{" "}
                      • Nhóm:{" "}
                      {topReportAlert.targetPost?.group?.name ||
                        "Cộng đồng chung"}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">
                      <i
                        className="fa-solid fa-comments text-[#0194F3] mr-1"
                        aria-hidden="true"
                      />
                      {topReportAlert.targetPost?.commentCount ?? 0} bình luận
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setReviewTarget({
                          kind: "REPORT",
                          report: topReportAlert,
                        })
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Phân xử ngay{" "}
                      <i
                        className="fa-solid fa-arrow-right ml-1"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
                <div className="h-3 mx-4 bg-white/20 rounded-b-2xl" />
              </>
            ) : (
              <div className="bg-white/10 border border-white/15 rounded-2xl p-5 text-center space-y-1.5">
                <div className="text-sm font-extrabold text-white">
                  Không có báo cáo khẩn cấp (&ge; 20 lượt)
                </div>
                <p className="text-xs text-slate-300">
                  Mọi bài viết trên bảng tin Cộng đồng đang hoạt động ổn định.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Bài đã duyệt không tự động ẩn khi bị report hàng loạt</span>
            <Link
              href="/admin/moderation"
              className="font-bold text-sky-400 hover:underline"
            >
              Mở hàng đợi &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Audit Logs Table */}
      <div className="bg-white rounded-[24px] p-6 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-[#10243A]">
            Nhật ký Kiểm toán Gần nhất
          </h2>
          <Link
            href="/admin/audit-logs"
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
          >
            Xem tất cả
          </Link>
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
              {recentAuditLogs.length > 0 ? (
                recentAuditLogs.map((log) => {
                  const actionStyle = ADMIN_AUDIT_ACTION_STYLES[log.action] ?? {
                    label: log.action,
                    badgeClass: "bg-slate-100 text-slate-700",
                  };
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedAuditLog(log)}
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
                      <td className="py-4 px-4 font-bold text-slate-800 max-w-[220px] truncate">
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
                            aria-label="Mở menu thao tác"
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
                              onClick={() => setSelectedAuditLog(log)}
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
                    className="py-10 text-center text-slate-400 font-semibold"
                  >
                    Chưa có bản ghi kiểm toán nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Isolated Community-style Modals */}
      <AuditDiffSheet
        log={selectedAuditLog}
        onClose={() => setSelectedAuditLog(null)}
      />
      <PostReviewSheet
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
      />
    </div>
  );
}

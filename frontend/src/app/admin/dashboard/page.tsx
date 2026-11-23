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
import { Skeleton } from "@/components/ui/skeleton";
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
  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    refetch: refetchStats,
  } = useAdminDashboardStats();
  const { data: auditData, isLoading: isAuditLoading } = useAdminAuditLogs({
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

  const pendingReviewPosts =
    (stats?.moderation.pendingPosts ?? 0) +
    (stats?.moderation.flaggedPosts ?? 0);
  const pendingReportsCount = stats?.moderation.pendingReports ?? 0;
  const moderationQueueTotal = pendingReviewPosts + pendingReportsCount;
  const pendingPhotosCount = stats?.places.pendingPhotos ?? 0;
  const highPriorityAlertCount =
    stats?.moderation.highPriorityReportAlerts ?? 0;

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
      heightPercent: Math.max(16, Math.round((c.placeCount / maxCount) * 90)),
    }));
  }, [stats?.places.byCategory]);

  const topReportAlert = highPriorityReports?.items?.[0] ?? null;
  const recentAuditLogs = auditData?.items ?? [];

  return (
    <div className="space-y-4">
      {isStatsError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-800">
          <span className="font-semibold">
            Không thể tải số liệu tổng quan bảng điều khiển.
          </span>
          <button
            type="button"
            onClick={() => void refetchStats()}
            className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Row 1: 4 Clean Light KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Moderation Queue */}
        <button
          type="button"
          onClick={() => router.push("/admin/moderation")}
          className={`text-left bg-white rounded-2xl p-5 border shadow-2xs cursor-pointer transition-colors hover:border-[#0194F3]/50 flex flex-col justify-between ${
            moderationQueueTotal > 0 ? "border-[#0194F3]/35" : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">
              Hàng đợi kiểm duyệt
            </span>
            <div className="size-9 rounded-xl bg-[#E8F4FD] text-[#0194F3] flex items-center justify-center">
              <i className="fa-solid fa-shield-halved text-sm" aria-hidden="true" />
            </div>
          </div>
          {isStatsLoading ? (
            <div className="space-y-2 my-3">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-3.5 w-36 rounded-md" />
            </div>
          ) : (
            <>
              <div className="my-2.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-extrabold tracking-tight text-[#10243A] tabular-nums">
                  {moderationQueueTotal.toLocaleString("vi-VN")}
                </span>
                {pendingReportsCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200/70">
                    {pendingReportsCount.toLocaleString("vi-VN")} báo cáo
                  </span>
                )}
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                Bài chờ duyệt:{" "}
                <b className="text-[#10243A]">{pendingReviewPosts}</b> • Đã gỡ:{" "}
                <b className="text-slate-700">
                  {stats?.moderation.rejectedPosts ?? 0}
                </b>
              </div>
            </>
          )}
        </button>

        {/* Card 2: Users */}
        <button
          type="button"
          onClick={() => router.push("/admin/users")}
          className="text-left bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs cursor-pointer transition-colors hover:border-slate-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">
              Người dùng hệ thống
            </span>
            <div className="size-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <i className="fa-solid fa-users text-sm" aria-hidden="true" />
            </div>
          </div>
          {isStatsLoading ? (
            <div className="space-y-2 my-3">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-3.5 w-32 rounded-md" />
            </div>
          ) : (
            <>
              <div className="my-2.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-extrabold tracking-tight text-[#10243A] tabular-nums">
                  {(stats?.users.total ?? 0).toLocaleString("vi-VN")}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  {(stats?.users.active ?? 0).toLocaleString("vi-VN")} hoạt động
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                Đang bị khóa:{" "}
                <b className="text-rose-600">{stats?.users.banned ?? 0}</b> tài khoản
              </div>
            </>
          )}
        </button>

        {/* Card 3: Places + Photo Contributions */}
        <button
          type="button"
          onClick={() =>
            router.push(
              pendingPhotosCount > 0 ? "/admin/places?tab=photos" : "/admin/places"
            )
          }
          className="text-left bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs cursor-pointer transition-colors hover:border-slate-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">
              Địa điểm du lịch
            </span>
            <div className="size-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <i
                className="fa-solid fa-map-location-dot text-sm"
                aria-hidden="true"
              />
            </div>
          </div>
          {isStatsLoading ? (
            <div className="space-y-2 my-3">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-3.5 w-36 rounded-md" />
            </div>
          ) : (
            <>
              <div className="my-2.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-extrabold tracking-tight text-[#10243A] tabular-nums">
                  {(stats?.places.total ?? 0).toLocaleString("vi-VN")}
                </span>
                {pendingPhotosCount > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                    {pendingPhotosCount} ảnh chờ duyệt
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F4FD] text-[#0194F3]">
                    {stats?.places.byCategory.length ?? 0} danh mục
                  </span>
                )}
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                Hiển thị:{" "}
                <b className="text-[#10243A]">
                  {(stats?.places.active ?? 0).toLocaleString("vi-VN")}
                </b>{" "}
                • Đã ẩn:{" "}
                <b className="text-slate-700">
                  {(stats?.places.inactive ?? 0).toLocaleString("vi-VN")}
                </b>
              </div>
            </>
          )}
        </button>

        {/* Card 4: Community */}
        <button
          type="button"
          onClick={() => router.push("/admin/community")}
          className="text-left bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs cursor-pointer transition-colors hover:border-slate-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500">
              Bài viết & Chủ đề
            </span>
            <div className="size-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <i className="fa-solid fa-layer-group text-sm" aria-hidden="true" />
            </div>
          </div>
          {isStatsLoading ? (
            <div className="space-y-2 my-3">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-3.5 w-32 rounded-md" />
            </div>
          ) : (
            <>
              <div className="my-2.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-extrabold tracking-tight text-[#10243A] tabular-nums">
                  {(stats?.community.approvedPosts ?? 0).toLocaleString("vi-VN")}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  {stats?.community.activeGroups ?? 0} chủ đề mở
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                Tổng bình luận:{" "}
                <b className="text-[#10243A]">
                  {(stats?.community.totalComments ?? 0).toLocaleString("vi-VN")}
                </b>
              </div>
            </>
          )}
        </button>
      </div>

      {/* Row 2: Category Distribution (8 cols) + Compact Light Alert & Operations Card (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-[#10243A]">
                Phân bổ Địa điểm theo Danh mục
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                6 nhóm địa điểm có số lượng hiển thị lớn nhất trên hệ thống
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-slate-200/80 text-slate-700 text-xs font-bold tabular-nums">
              {(stats?.places.active ?? 0).toLocaleString("vi-VN")} địa điểm
            </span>
          </div>

          <div className="mt-6 pt-4 pb-1 px-2">
            {isStatsLoading ? (
              <div className="grid grid-cols-6 gap-4 items-end h-44">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton
                    key={idx}
                    className="w-full rounded-t-xl"
                    style={{ height: `${35 + ((idx * 17) % 55)}%` }}
                  />
                ))}
              </div>
            ) : categoryChartItems.length > 0 ? (
              <>
                <div
                  className="grid gap-4 items-end h-44 border-b border-slate-100 pb-3"
                  style={{
                    gridTemplateColumns: `repeat(${categoryChartItems.length}, minmax(0, 1fr))`,
                  }}
                >
                  {categoryChartItems.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex flex-col items-center gap-1.5 h-full justify-end"
                    >
                      <span
                        className={`text-[11px] font-bold tabular-nums ${
                          cat.isPeak ? "text-[#0194F3]" : "text-slate-500"
                        }`}
                      >
                        {cat.placeCount.toLocaleString("vi-VN")}
                      </span>
                      <div
                        className={`w-10 sm:w-12 rounded-t-xl transition-colors ${
                          cat.isPeak ? "bg-[#0194F3]" : "bg-slate-200"
                        }`}
                        style={{ height: `${cat.heightPercent}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  className="grid gap-4 pt-2.5 text-center text-[11px] font-semibold text-slate-600"
                  style={{
                    gridTemplateColumns: `repeat(${categoryChartItems.length}, minmax(0, 1fr))`,
                  }}
                >
                  {categoryChartItems.map((cat) => (
                    <div
                      key={cat.id}
                      title={cat.nameVi || cat.name}
                      className={`truncate ${
                        cat.isPeak ? "text-[#0194F3] font-bold" : ""
                      }`}
                    >
                      {cat.nameVi || cat.name}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs font-medium text-slate-400">
                Chưa có dữ liệu phân bổ danh mục.
              </div>
            )}
          </div>
        </div>

        {/* Compact Light Surface Card: Priority Alert + Quick Operational Tasks */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#10243A]">
                Cảnh báo & Tác vụ nhanh
              </h2>
              {highPriorityAlertCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold">
                  {highPriorityAlertCount} ưu tiên cao
                </span>
              )}
            </div>

            {topReportAlert ? (
              <div className="rounded-xl border border-rose-200/80 border-l-4 border-l-rose-500 bg-rose-50/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-rose-700">
                    Báo cáo ưu tiên cao · {topReportAlert.targetReportCount} lượt
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">
                    {formatAdminDateTime(topReportAlert.createdAt)}
                  </span>
                </div>
                <div className="text-xs font-bold text-[#10243A] line-clamp-1">
                  {topReportAlert.targetPost?.title ||
                    `Nội dung #${topReportAlert.targetId.slice(0, 8)}`}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-600 truncate">
                    {topReportAlert.targetPost?.user?.fullName || "Thành viên"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setReviewTarget({
                        kind: "REPORT",
                        report: topReportAlert,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-[#0194F3] hover:bg-[#0084DE] text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Phân xử ngay
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3.5 py-3 flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-circle-check text-sm" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-950">
                    Cộng đồng ổn định
                  </div>
                  <p className="text-[11px] text-emerald-800/80">
                    Không có báo cáo ưu tiên cao cần phân xử khẩn.
                  </p>
                </div>
              </div>
            )}

            {/* Real actionable operational shortcuts */}
            <div className="space-y-2 pt-1">
              <Link
                href="/admin/places?tab=photos"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F0F7FF] border border-slate-200/70 transition-colors group"
              >
                <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 group-hover:text-[#0194F3]">
                  <i
                    className="fa-regular fa-images text-slate-400 group-hover:text-[#0194F3]"
                    aria-hidden="true"
                  />
                  <span>Ảnh địa điểm chờ duyệt</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                    pendingPhotosCount > 0
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-200/70 text-slate-600"
                  }`}
                >
                  {pendingPhotosCount}
                </span>
              </Link>

              <Link
                href="/admin/moderation"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F0F7FF] border border-slate-200/70 transition-colors group"
              >
                <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 group-hover:text-[#0194F3]">
                  <i
                    className="fa-solid fa-shield-halved text-slate-400 group-hover:text-[#0194F3]"
                    aria-hidden="true"
                  />
                  <span>Bài viết chờ kiểm duyệt</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                    pendingReviewPosts > 0
                      ? "bg-[#E8F4FD] text-[#0194F3]"
                      : "bg-slate-200/70 text-slate-600"
                  }`}
                >
                  {pendingReviewPosts}
                </span>
              </Link>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Tự động cập nhật mỗi 20 giây</span>
            <Link
              href="/admin/moderation"
              className="font-bold text-[#0194F3] hover:underline"
            >
              Mở kiểm duyệt
            </Link>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Audit Logs Table */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold text-[#10243A]">
            Nhật ký Kiểm toán Gần nhất
          </h2>
          <Link
            href="/admin/audit-logs"
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#0194F3]/30 text-xs font-bold text-slate-700 transition-colors"
          >
            Xem tất cả
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 pr-4">Thời gian</th>
                <th className="py-3 px-4">Quản trị viên</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Đối tượng</th>
                <th className="py-3 px-4">Ghi chú</th>
                <th className="py-3 pl-4 text-right w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isAuditLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="py-3.5 pr-4">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="py-3.5 px-4">
                      <Skeleton className="h-4 w-36" />
                    </td>
                    <td className="py-3.5 px-4">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="py-3.5 px-4">
                      <Skeleton className="h-4 w-44" />
                    </td>
                    <td className="py-3.5 pl-4" />
                  </tr>
                ))
              ) : recentAuditLogs.length > 0 ? (
                recentAuditLogs.map((log) => {
                  const actionStyle = ADMIN_AUDIT_ACTION_STYLES[log.action] ?? {
                    label: log.action,
                    badgeClass: "bg-slate-100 text-slate-700",
                  };
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedAuditLog(log)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 pr-4 text-slate-500 font-medium whitespace-nowrap tabular-nums">
                        {formatAdminDateTime(log.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#10243A]">
                        {log.actor?.email || log.actor?.fullName || "Admin"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${actionStyle.badgeClass}`}
                        >
                          {actionStyle.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-[220px] truncate">
                        {log.targetLabel || log.targetType}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                        {log.notes || "—"}
                      </td>
                      <td
                        className="py-3.5 pl-4 text-right whitespace-nowrap"
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
                            className="w-48 rounded-xl p-1.5 border border-slate-200 bg-white shadow-xl"
                          >
                            <DropdownMenuItem
                              onClick={() => setSelectedAuditLog(log)}
                              className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
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
                    className="py-10 text-center text-slate-400 font-medium"
                  >
                    Chưa có bản ghi kiểm toán nào. Các thao tác quản trị sẽ được tự động lưu tại đây.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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

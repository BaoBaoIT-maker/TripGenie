"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_AVATAR } from "@/config/avatars";
import {
  ADMIN_UI_CONSTANTS,
  formatAdminDateTime,
} from "@/features/admin/admin.constants";
import type { AdminContentReportItem } from "@/types/admin";

interface AdminModerationReportsTableProps {
  reports: AdminContentReportItem[];
  isLoading: boolean;
  highPriorityOnly: boolean;
  onSelectReport: (report: AdminContentReportItem) => void;
  onDismissReport: (reportId: string) => void;
  onResolveAndRejectPost: (reportId: string) => void;
}

export function AdminModerationReportsTable({
  reports,
  isLoading,
  highPriorityOnly,
  onSelectReport,
  onDismissReport,
  onResolveAndRejectPost,
}: AdminModerationReportsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <th className="py-3 pr-4">Bài viết & Chủ đề</th>
            <th className="py-3 px-4">Tác giả</th>
            <th className="py-3 px-4">Trạng thái</th>
            <th className="py-3 px-4">Nội dung báo cáo</th>
            <th className="py-3 pl-4 text-right w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <tr key={idx}>
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-xl shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="py-4 px-4">
                  <Skeleton className="h-6 w-24 rounded-full" />
                </td>
                <td className="py-4 px-4">
                  <Skeleton className="h-4 w-48" />
                </td>
                <td className="py-4 pl-4" />
              </tr>
            ))
          ) : reports.length > 0 ? (
            reports.map((report) => {
              const post = report.targetPost;
              const cover =
                post?.mediaUrls?.[0] || ADMIN_UI_CONSTANTS.FALLBACK_PLACE_IMAGE;
              const authorName =
                post?.user?.fullName ||
                report.reporter?.fullName ||
                "Thành viên";
              const authorEmail =
                post?.user?.email || report.reporter?.email || "";
              const authorAvatar = post?.user?.avatarUrl || DEFAULT_AVATAR;

              return (
                <tr
                  key={report.id}
                  onClick={() => onSelectReport(report)}
                  className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-10 rounded-xl object-cover shrink-0 border border-slate-200"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-[#10243A] line-clamp-1">
                          {post?.title ||
                            `Nội dung #${report.targetId.slice(0, 8)}`}
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {post?.group?.name || "Cộng đồng chung"} •{" "}
                          {formatAdminDateTime(report.createdAt)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={authorAvatar}
                        alt=""
                        loading="lazy"
                        className="size-7 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-bold text-slate-800">
                          {authorName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {authorEmail}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {report.isHighPriorityAlert && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[10px]">
                          Ưu tiên cao
                        </span>
                      )}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px] tabular-nums">
                        {report.targetReportCount} lượt báo cáo
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                    <p className="line-clamp-2 text-xs">
                      {report.description ||
                        `Báo cáo loại ${report.reportType} từ cộng đồng.`}
                    </p>
                  </td>
                  <td
                    className="py-3.5 pl-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="Mở menu xử lý báo cáo"
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
                          onClick={() => onSelectReport(report)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
                        >
                          <i
                            className="fa-regular fa-eye w-4 text-slate-400"
                            aria-hidden="true"
                          />
                          <span>Xem chi tiết & Phân xử</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDismissReport(report.id)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 cursor-pointer flex items-center gap-2.5"
                        >
                          <i
                            className="fa-solid fa-check w-4"
                            aria-hidden="true"
                          />
                          <span>Bác bỏ báo cáo</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onResolveAndRejectPost(report.id)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 cursor-pointer flex items-center gap-2.5"
                        >
                          <i
                            className="fa-solid fa-ban w-4"
                            aria-hidden="true"
                          />
                          <span>Xác nhận vi phạm & Gỡ bài</span>
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
                colSpan={5}
                className="py-12 text-center text-slate-500 font-medium"
              >
                {highPriorityOnly
                  ? "Không có báo cáo ưu tiên cao nào. Bấm tắt bộ lọc để xem toàn bộ báo cáo."
                  : "Không có báo cáo vi phạm nào đang chờ xử lý."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

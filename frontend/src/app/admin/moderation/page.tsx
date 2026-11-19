"use client";

import { useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_AVATAR } from "@/config/avatars";
import { ADMIN_UI_CONSTANTS } from "@/features/admin/admin.constants";
import { AdminDebouncedSearch } from "@/features/admin/components/AdminDebouncedSearch";
import { AdminBannedWordsSection } from "@/features/admin/components/AdminBannedWordsSection";
import {
  PostReviewSheet,
  type ModerationReviewTarget,
} from "@/features/admin/components/PostReviewSheet";
import {
  useAdminDashboardStats,
  useAdminModerationConfig,
  useAdminModerationPosts,
  useAdminModerationReports,
  useApproveAdminPost,
  useRejectAdminPost,
  useResolveAdminReport,
  useUpdateAdminModerationConfig,
} from "@/features/admin/hooks/use-admin";

type ModerationTabFilter =
  | "ALL"
  | "HIGH_REPORT"
  | "FLAGGED"
  | "PENDING"
  | "BANNED_WORDS";

export default function AdminModerationPage() {
  const [activeFilter, setActiveFilter] = useState<ModerationTabFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reviewTarget, setReviewTarget] =
    useState<ModerationReviewTarget | null>(null);

  const { data: stats } = useAdminDashboardStats();
  const { data: modConfig } = useAdminModerationConfig();
  const updateConfigMutation = useUpdateAdminModerationConfig();

  const approvePostMutation = useApproveAdminPost();
  const rejectPostMutation = useRejectAdminPost();
  const resolveReportMutation = useResolveAdminReport();

  const isReportView = activeFilter === "HIGH_REPORT";

  const { data: postsData, isLoading: isPostsLoading } =
    useAdminModerationPosts({
      page,
      limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
      status:
        activeFilter === "FLAGGED"
          ? "FLAGGED"
          : activeFilter === "PENDING"
            ? "PENDING"
            : undefined,
      search: search || undefined,
    });

  const { data: reportsData, isLoading: isReportsLoading } =
    useAdminModerationReports({
      page,
      limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
      status: "PENDING",
      highPriorityOnly: activeFilter === "HIGH_REPORT" ? true : undefined,
    });

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const handleFilterChange = (next: ModerationTabFilter) => {
    setActiveFilter(next);
    setPage(1);
  };

  const aiEnabled = modConfig?.aiModerationEnabled ?? true;

  const handleToggleAi = () => {
    if (updateConfigMutation.isPending) return;
    updateConfigMutation.mutate(!aiEnabled);
  };

  const pendingPostsCount = stats?.moderation.pendingPosts ?? 0;
  const flaggedPostsCount = stats?.moderation.flaggedPosts ?? 0;
  const highReportCount = stats?.moderation.highPriorityReportAlerts ?? 0;
  const totalModCount = pendingPostsCount + flaggedPostsCount + highReportCount;

  const postItems =
    activeFilter === "ALL"
      ? (postsData?.items ?? []).filter(
          (p) =>
            p.moderationStatus === "PENDING" || p.moderationStatus === "FLAGGED"
        )
      : (postsData?.items ?? []);

  const reportItems = reportsData?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Row 1: Summary Cards + AI Auto-Moderation Control Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Báo cáo khẩn cấp (&ge; 20)
          </div>
          <div className="text-2xl font-extrabold text-rose-600 mt-2">
            {highReportCount.toLocaleString("vi-VN")} mục
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Cần Admin phân xử thủ công
          </div>
        </div>

        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            AI gắn cờ nghi vấn
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2">
            {flaggedPostsCount.toLocaleString("vi-VN")} bài viết
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Phát hiện từ khóa nhạy cảm
          </div>
        </div>

        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Bài viết chờ duyệt
          </div>
          <div className="text-2xl font-extrabold text-[#0194F3] mt-2">
            {pendingPostsCount.toLocaleString("vi-VN")} bài viết
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Chưa hiển thị trên Cộng đồng
          </div>
        </div>

        {/* AI Auto-Moderation Toggle Switch Card (Exclusively in Moderation Tab) */}
        <div className="bg-white rounded-[24px] p-5 border border-sky-200 shadow-[0_4px_20px_rgba(1,148,243,0.06)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#10243A] flex items-center gap-1.5">
              <i
                className="fa-solid fa-robot text-[#0194F3]"
                aria-hidden="true"
              />
              <span>AI Auto-Moderation</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={aiEnabled}
              aria-label="Bật hoặc tắt AI Auto-Moderation"
              disabled={updateConfigMutation.isPending}
              onClick={handleToggleAi}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 ${
                aiEnabled ? "bg-[#0194F3]" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                  aiEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                aiEnabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {aiEnabled
                ? "Đang bật duyệt tự động 3 tầng"
                : "Đang tắt — Duyệt thủ công 100%"}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {aiEnabled
              ? "Tự động lọc từ cấm & chấm điểm bài mới"
              : "Mọi bài viết mới sẽ vào hàng đợi Chờ duyệt"}
          </div>
        </div>
      </div>

      {/* Row 2: Moderation Queue & Reports Table */}
      <div className="bg-white rounded-[24px] p-6 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-2xl bg-[#F4F7FB] border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleFilterChange("ALL")}
              className={`px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                activeFilter === "ALL"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả ({totalModCount})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("HIGH_REPORT")}
              className={`px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                activeFilter === "HIGH_REPORT"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              &ge; 20 Reports ({highReportCount})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("FLAGGED")}
              className={`px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                activeFilter === "FLAGGED"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              AI Nghi vấn ({flaggedPostsCount})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("PENDING")}
              className={`px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                activeFilter === "PENDING"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              Chờ duyệt ({pendingPostsCount})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("BANNED_WORDS")}
              className={`px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeFilter === "BANNED_WORDS"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              <i
                className="fa-solid fa-shield-halved text-[11px]"
                aria-hidden="true"
              />
              <span>Từ khóa cấm</span>
            </button>
          </div>

          {activeFilter !== "BANNED_WORDS" && (
            <AdminDebouncedSearch
              placeholder="Tìm tiêu đề, nội dung bài viết..."
              onSearchChange={handleSearchChange}
            />
          )}
        </div>

        {activeFilter === "BANNED_WORDS" ? (
          <AdminBannedWordsSection />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pr-4">Bài viết & Chủ đề</th>
                <th className="py-3.5 px-4">Tác giả</th>
                <th className="py-3.5 px-4">Phân loại</th>
                <th className="py-3.5 px-4">Chẩn đoán</th>
                <th className="py-3.5 pl-4 text-right w-14" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isReportView ? (
                reportItems.length > 0 ? (
                  reportItems.map((report) => {
                    const post = report.targetPost;
                    const cover =
                      post?.mediaUrls?.[0] ||
                      ADMIN_UI_CONSTANTS.FALLBACK_PLACE_IMAGE;
                    const authorName =
                      post?.user?.fullName ||
                      report.reporter?.fullName ||
                      "Thành viên";
                    const authorEmail =
                      post?.user?.email || report.reporter?.email || "";
                    const authorAvatar =
                      post?.user?.avatarUrl || DEFAULT_AVATAR;

                    return (
                      <tr
                        key={report.id}
                        onClick={() =>
                          setReviewTarget({ kind: "REPORT", report })
                        }
                        className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                      >
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={cover}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="size-11 rounded-2xl object-cover shrink-0 border border-slate-200"
                            />
                            <div>
                              <div className="font-bold text-[#10243A] line-clamp-1">
                                {post?.title ||
                                  `Báo cáo #${report.targetId.slice(0, 8)}`}
                              </div>
                              <span className="text-[11px] font-medium text-slate-400">
                                {post?.group?.name || "Cộng đồng chung"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
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
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-bold text-[11px]">
                            <i className="fa-solid fa-fire" aria-hidden="true" />
                            <span>{report.targetReportCount} Reports</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-600 max-w-xs">
                          <p className="line-clamp-2 text-xs">
                            {report.description ||
                              `Báo cáo ${report.reportType} — Hệ thống giữ hiển thị chống công kích hội đồng.`}
                          </p>
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
                                onClick={() =>
                                  setReviewTarget({ kind: "REPORT", report })
                                }
                                className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
                              >
                                <i
                                  className="fa-regular fa-eye w-4 text-slate-400"
                                  aria-hidden="true"
                                />
                                <span>Xem chi tiết & Phân xử</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  resolveReportMutation.mutate({
                                    reportId: report.id,
                                    action: "DISMISS",
                                  })
                                }
                                className="rounded-xl px-3 py-2 text-xs font-semibold text-emerald-600 cursor-pointer flex items-center gap-2.5"
                              >
                                <i
                                  className="fa-solid fa-check w-4"
                                  aria-hidden="true"
                                />
                                <span>Bác bỏ Report ảo</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  resolveReportMutation.mutate({
                                    reportId: report.id,
                                    action: "RESOLVE",
                                    rejectTargetPost: true,
                                  })
                                }
                                className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 cursor-pointer flex items-center gap-2.5"
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
                      className="py-12 text-center text-slate-400 font-semibold"
                    >
                      {isReportsLoading
                        ? "Đang tải danh sách báo cáo..."
                        : "Không có báo cáo khẩn cấp nào cần xử lý."}
                    </td>
                  </tr>
                )
              ) : postItems.length > 0 ? (
                postItems.map((post) => {
                  const cover =
                    post.mediaUrls?.[0] ||
                    ADMIN_UI_CONSTANTS.FALLBACK_PLACE_IMAGE;
                  return (
                    <tr
                      key={post.id}
                      onClick={() => setReviewTarget({ kind: "POST", post })}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                    >
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cover}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-11 rounded-2xl object-cover shrink-0 border border-slate-200"
                          />
                          <div>
                            <div className="font-bold text-[#10243A] line-clamp-1">
                              {post.title}
                            </div>
                            <span className="text-[11px] font-medium text-slate-400">
                              {post.group?.name || "Cộng đồng chung"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.user?.avatarUrl || DEFAULT_AVATAR}
                            alt=""
                            loading="lazy"
                            className="size-7 rounded-full object-cover"
                          />
                          <div>
                            <div className="font-bold text-slate-800">
                              {post.user?.fullName || "Thành viên"}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {post.user?.email || ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        {post.moderationStatus === "FLAGGED" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px]">
                            <i
                              className="fa-solid fa-triangle-exclamation"
                              aria-hidden="true"
                            />
                            <span>AI Nghi vấn</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-[#0194F3] border border-sky-200 font-bold text-[11px]">
                            <i
                              className="fa-regular fa-clock"
                              aria-hidden="true"
                            />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-600 max-w-xs">
                        <p className="line-clamp-2 text-xs">
                          {post.moderationNote ||
                            (post.moderationStatus === "FLAGGED"
                              ? "Phễu AI phát hiện từ nhạy cảm cần kiểm tra ngữ cảnh."
                              : "Bài viết mới ở trạng thái chờ duyệt thủ công.")}
                        </p>
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
                              onClick={() =>
                                setReviewTarget({ kind: "POST", post })
                              }
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
                            >
                              <i
                                className="fa-regular fa-eye w-4 text-slate-400"
                                aria-hidden="true"
                              />
                              <span>Xem chi tiết & Phân xử</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                approvePostMutation.mutate({
                                  postId: post.id,
                                })
                              }
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-emerald-600 cursor-pointer flex items-center gap-2.5"
                            >
                              <i
                                className="fa-solid fa-check w-4"
                                aria-hidden="true"
                              />
                              <span>Phê duyệt nhanh</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                rejectPostMutation.mutate({
                                  postId: post.id,
                                })
                              }
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 cursor-pointer flex items-center gap-2.5"
                            >
                              <i
                                className="fa-solid fa-ban w-4"
                                aria-hidden="true"
                              />
                              <span>Từ chối / Gỡ bài</span>
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
                    className="py-12 text-center text-slate-400 font-semibold"
                  >
                    {isPostsLoading
                      ? "Đang tải hàng đợi kiểm duyệt..."
                      : "Hàng đợi kiểm duyệt trống."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <PostReviewSheet
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
      />
    </div>
  );
}

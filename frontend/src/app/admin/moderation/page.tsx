"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ADMIN_MODERATION_QUEUE_STATUSES,
  ADMIN_ROUTES,
  ADMIN_TAB_QUERY_PARAMS,
  ADMIN_UI_CONSTANTS,
} from "@/features/admin/admin.constants";
import { AdminDebouncedSearch } from "@/features/admin/components/AdminDebouncedSearch";
import { AdminBannedWordsSection } from "@/features/admin/components/AdminBannedWordsSection";
import { AdminModerationPostsTable } from "@/features/admin/components/AdminModerationPostsTable";
import { AdminModerationReportsTable } from "@/features/admin/components/AdminModerationReportsTable";
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

type ModerationTab = "QUEUE" | "REPORTS" | "REJECTED" | "BANNED_WORDS";
type QueueSubFilter = "ALL" | "FLAGGED" | "PENDING";

function resolveTabFromQuery(tabParam: string | null): ModerationTab {
  switch (tabParam) {
    case ADMIN_TAB_QUERY_PARAMS.MODERATION_REPORTS:
      return "REPORTS";
    case ADMIN_TAB_QUERY_PARAMS.MODERATION_REJECTED:
      return "REJECTED";
    case ADMIN_TAB_QUERY_PARAMS.MODERATION_BANNED_WORDS:
      return "BANNED_WORDS";
    default:
      return "QUEUE";
  }
}

function resolveRouteForTab(tab: ModerationTab): string {
  switch (tab) {
    case "REPORTS":
      return ADMIN_ROUTES.MODERATION_REPORTS;
    case "REJECTED":
      return `${ADMIN_ROUTES.MODERATION}?${ADMIN_TAB_QUERY_PARAMS.KEY}=${ADMIN_TAB_QUERY_PARAMS.MODERATION_REJECTED}`;
    case "BANNED_WORDS":
      return `${ADMIN_ROUTES.MODERATION}?${ADMIN_TAB_QUERY_PARAMS.KEY}=${ADMIN_TAB_QUERY_PARAMS.MODERATION_BANNED_WORDS}`;
    default:
      return ADMIN_ROUTES.MODERATION;
  }
}

function AdminModerationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get(ADMIN_TAB_QUERY_PARAMS.KEY);
  const activeTab = resolveTabFromQuery(tabParam);

  const [queueSubFilter, setQueueSubFilter] = useState<QueueSubFilter>("ALL");
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);
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

  const isPostsTab = activeTab === "QUEUE" || activeTab === "REJECTED";
  const isReportsTab = activeTab === "REPORTS";

  const postsQueryParams =
    activeTab === "REJECTED"
      ? {
          page,
          limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
          status: "REJECTED" as const,
          search: search || undefined,
        }
      : {
          page,
          limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
          ...(queueSubFilter === "ALL"
            ? { statuses: ADMIN_MODERATION_QUEUE_STATUSES }
            : { status: queueSubFilter }),
          search: search || undefined,
        };

  const {
    data: postsData,
    isLoading: isPostsLoading,
    isError: isPostsError,
    refetch: refetchPosts,
  } = useAdminModerationPosts(postsQueryParams, { enabled: isPostsTab });

  const {
    data: reportsData,
    isLoading: isReportsLoading,
    isError: isReportsError,
    refetch: refetchReports,
  } = useAdminModerationReports(
    {
      page,
      limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
      status: "PENDING",
      highPriorityOnly: highPriorityOnly ? true : undefined,
    },
    { enabled: isReportsTab }
  );

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const handleTabChange = useCallback(
    (next: ModerationTab) => {
      router.replace(resolveRouteForTab(next), { scroll: false });
      setPage(1);
    },
    [router]
  );

  const aiEnabled = modConfig?.aiModerationEnabled ?? true;

  const handleToggleAi = () => {
    if (updateConfigMutation.isPending) return;
    updateConfigMutation.mutate(!aiEnabled);
  };

  const pendingPostsCount = stats?.moderation.pendingPosts ?? 0;
  const flaggedPostsCount = stats?.moderation.flaggedPosts ?? 0;
  const queueTotalCount = pendingPostsCount + flaggedPostsCount;
  const pendingReportsCount = stats?.moderation.pendingReports ?? 0;
  const highPriorityAlertCount =
    stats?.moderation.highPriorityReportAlerts ?? 0;
  const rejectedPostsCount = stats?.moderation.rejectedPosts ?? 0;

  const postItems = postsData?.items ?? [];
  const reportItems = reportsData?.items ?? [];
  const activeMeta = isReportsTab ? reportsData?.meta : postsData?.meta;
  const totalPages = activeMeta?.totalPages ?? 1;
  const totalItems = activeMeta?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Row 1: 4 Summary Cards + Optimistic AI Auto-Moderation Control */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => handleTabChange("QUEUE")}
          className={`text-left bg-white rounded-2xl p-5 border shadow-2xs transition-colors cursor-pointer ${
            activeTab === "QUEUE"
              ? "border-[#0194F3]/50"
              : "border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">
            Chờ kiểm duyệt
          </div>
          <div className="text-2xl font-extrabold text-[#10243A] mt-2 tabular-nums">
            {queueTotalCount.toLocaleString("vi-VN")} bài viết
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            AI gắn cờ: <b className="text-amber-700">{flaggedPostsCount}</b> • Thủ công:{" "}
            <b className="text-[#0194F3]">{pendingPostsCount}</b>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("REPORTS")}
          className={`text-left bg-white rounded-2xl p-5 border shadow-2xs transition-colors cursor-pointer ${
            activeTab === "REPORTS"
              ? "border-[#0194F3]/50"
              : "border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">
            Báo cáo vi phạm
          </div>
          <div className="text-2xl font-extrabold text-rose-600 mt-2 tabular-nums">
            {pendingReportsCount.toLocaleString("vi-VN")} báo cáo
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {highPriorityAlertCount > 0 ? (
              <>
                <b className="text-rose-600">{highPriorityAlertCount} mục</b> ưu tiên cao cần phân xử
              </>
            ) : (
              "Không có cảnh báo ưu tiên cao"
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("REJECTED")}
          className={`text-left bg-white rounded-2xl p-5 border shadow-2xs transition-colors cursor-pointer ${
            activeTab === "REJECTED"
              ? "border-[#0194F3]/50"
              : "border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">
            Đã gỡ / Từ chối
          </div>
          <div className="text-2xl font-extrabold text-slate-700 mt-2 tabular-nums">
            {rejectedPostsCount.toLocaleString("vi-VN")} bài viết
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Có thể xem lý do & khôi phục nếu nhầm
          </div>
        </button>

        {/* AI Auto-Moderation Toggle Switch Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#10243A] flex items-center gap-1.5">
              <i
                className="fa-solid fa-shield-halved text-[#0194F3]"
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
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-60 ${
                aiEnabled ? "bg-[#0194F3]" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-xs transition duration-200 ${
                  aiEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="mt-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                aiEnabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                  : "bg-amber-50 text-amber-800 border-amber-200/80"
              }`}
            >
              {aiEnabled
                ? "Đang bật duyệt tự động"
                : "Đang tắt — Duyệt thủ công 100%"}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {aiEnabled
              ? "Bài nghi vấn sẽ tự động gắn cờ về hàng đợi"
              : "Mọi bài đăng mới đều chờ Quản trị viên duyệt"}
          </div>
        </div>
      </div>

      {/* Row 2: 4 Clean Tabs + Contextual Sub-filters + Dedicated Table Component */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Phân loại kiểm duyệt nội dung"
            className="inline-flex flex-wrap p-1 rounded-xl bg-[#F5F9FF] border border-slate-200/70 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "QUEUE"}
              onClick={() => handleTabChange("QUEUE")}
              className={`px-3.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                activeTab === "QUEUE"
                  ? "font-bold bg-[#0194F3] text-white shadow-2xs"
                  : "font-semibold text-slate-600 hover:text-[#10243A]"
              }`}
            >
              Chờ duyệt ({queueTotalCount})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "REPORTS"}
              onClick={() => handleTabChange("REPORTS")}
              className={`px-3.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                activeTab === "REPORTS"
                  ? "font-bold bg-[#0194F3] text-white shadow-2xs"
                  : "font-semibold text-slate-600 hover:text-[#10243A]"
              }`}
            >
              Báo cáo vi phạm ({pendingReportsCount})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "REJECTED"}
              onClick={() => handleTabChange("REJECTED")}
              className={`px-3.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                activeTab === "REJECTED"
                  ? "font-bold bg-[#0194F3] text-white shadow-2xs"
                  : "font-semibold text-slate-600 hover:text-[#10243A]"
              }`}
            >
              Đã gỡ / Từ chối ({rejectedPostsCount})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "BANNED_WORDS"}
              onClick={() => handleTabChange("BANNED_WORDS")}
              className={`px-3.5 py-2 rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === "BANNED_WORDS"
                  ? "font-bold bg-[#0194F3] text-white shadow-2xs"
                  : "font-semibold text-slate-600 hover:text-[#10243A]"
              }`}
            >
              <i
                className="fa-solid fa-ban text-[11px]"
                aria-hidden="true"
              />
              <span>Từ khóa cấm</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "QUEUE" && (
              <div className="inline-flex items-center gap-1 bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-1">
                {(
                  [
                    { id: "ALL", label: "Tất cả" },
                    { id: "FLAGGED", label: `AI gắn cờ (${flaggedPostsCount})` },
                    { id: "PENDING", label: `Thủ công (${pendingPostsCount})` },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setQueueSubFilter(chip.id);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      queueSubFilter === chip.id
                        ? "bg-white text-[#0194F3] shadow-2xs border border-slate-200/80"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === "REPORTS" && (
              <button
                type="button"
                onClick={() => {
                  setHighPriorityOnly((prev) => !prev);
                  setPage(1);
                }}
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                  highPriorityOnly
                    ? "bg-rose-50 text-rose-700 border-rose-300"
                    : "bg-[#F8FAFC] text-slate-600 border-slate-200 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-filter text-[11px]" aria-hidden="true" />
                <span>Chỉ ưu tiên cao ({highPriorityAlertCount})</span>
              </button>
            )}

            {isPostsTab && (
              <AdminDebouncedSearch
                placeholder="Tìm tiêu đề, nội dung bài viết..."
                onSearchChange={handleSearchChange}
              />
            )}
          </div>
        </div>

        {activeTab === "BANNED_WORDS" ? (
          <AdminBannedWordsSection />
        ) : (
          <>
            {(isPostsTab && isPostsError) || (isReportsTab && isReportsError) ? (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-center justify-between text-xs text-rose-800">
                <span className="font-semibold">
                  Không thể tải dữ liệu kiểm duyệt. Vui lòng thử lại.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void (isReportsTab ? refetchReports() : refetchPosts())
                  }
                  className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            ) : isReportsTab ? (
              <AdminModerationReportsTable
                reports={reportItems}
                isLoading={isReportsLoading}
                highPriorityOnly={highPriorityOnly}
                onSelectReport={(report) =>
                  setReviewTarget({ kind: "REPORT", report })
                }
                onDismissReport={(reportId) =>
                  resolveReportMutation.mutate({ reportId, action: "DISMISS" })
                }
                onResolveAndRejectPost={(reportId) =>
                  resolveReportMutation.mutate({
                    reportId,
                    action: "RESOLVE",
                    rejectTargetPost: true,
                  })
                }
              />
            ) : (
              <AdminModerationPostsTable
                posts={postItems}
                isLoading={isPostsLoading}
                isRejectedTab={activeTab === "REJECTED"}
                onSelectPost={(post) => setReviewTarget({ kind: "POST", post })}
                onApprovePost={(postId) =>
                  approvePostMutation.mutate({ postId })
                }
                onRejectPost={(postId) => rejectPostMutation.mutate({ postId })}
              />
            )}

            {/* Pagination Footer */}
            {totalItems > 0 && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <div className="font-medium">
                  Trang <b className="text-[#10243A]">{page}</b> /{" "}
                  <b className="text-[#10243A]">{totalPages}</b> • Tổng{" "}
                  <b className="text-[#10243A] tabular-nums">
                    {totalItems.toLocaleString("vi-VN")}
                  </b>{" "}
                  mục
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
                  <span className="px-3 h-8 rounded-xl bg-[#0194F3] text-white font-bold text-xs inline-flex items-center justify-center tabular-nums">
                    {page}
                  </span>
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
          </>
        )}
      </div>

      <PostReviewSheet
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
      />
    </div>
  );
}

export default function AdminModerationPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <AdminModerationPageContent />
    </Suspense>
  );
}

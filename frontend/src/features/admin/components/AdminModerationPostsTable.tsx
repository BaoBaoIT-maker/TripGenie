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
import type { AdminModerationPostItem } from "@/types/admin";

interface AdminModerationPostsTableProps {
  posts: AdminModerationPostItem[];
  isLoading: boolean;
  isRejectedTab: boolean;
  onSelectPost: (post: AdminModerationPostItem) => void;
  onApprovePost: (postId: string) => void;
  onRejectPost: (postId: string) => void;
}

export function AdminModerationPostsTable({
  posts,
  isLoading,
  isRejectedTab,
  onSelectPost,
  onApprovePost,
  onRejectPost,
}: AdminModerationPostsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <th className="py-3 pr-4">Bài viết & Chủ đề</th>
            <th className="py-3 px-4">Tác giả</th>
            <th className="py-3 px-4">Trạng thái</th>
            <th className="py-3 px-4">
              {isRejectedTab ? "Lý do từ chối" : "Chẩn đoán"}
            </th>
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
          ) : posts.length > 0 ? (
            posts.map((post) => {
              const cover =
                post.mediaUrls?.[0] || ADMIN_UI_CONSTANTS.FALLBACK_PLACE_IMAGE;
              const isRejected = post.moderationStatus === "REJECTED";
              const isFlagged = post.moderationStatus === "FLAGGED";

              return (
                <tr
                  key={post.id}
                  onClick={() => onSelectPost(post)}
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
                          {post.title}
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {post.group?.name || "Cộng đồng chung"} •{" "}
                          {formatAdminDateTime(post.createdAt)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
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
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {isRejected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                        <i
                          className="fa-solid fa-ban text-[10px]"
                          aria-hidden="true"
                        />
                        <span>Đã gỡ / Từ chối</span>
                      </span>
                    ) : isFlagged ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px]">
                        <i
                          className="fa-solid fa-triangle-exclamation text-[10px]"
                          aria-hidden="true"
                        />
                        <span>AI gắn cờ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E8F4FD] text-[#0194F3] border border-sky-200 font-bold text-[11px]">
                        <i
                          className="fa-regular fa-clock text-[10px]"
                          aria-hidden="true"
                        />
                        <span>Chờ thủ công</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                    <p className="line-clamp-2 text-xs">
                      {post.moderationNote ||
                        (isRejected
                          ? "Bài viết bị từ chối do vi phạm tiêu chuẩn cộng đồng."
                          : isFlagged
                            ? "AI gắn cờ cần kiểm tra ngữ cảnh."
                            : "Bài viết đang chờ Quản trị viên duyệt thủ công.")}
                    </p>
                  </td>
                  <td
                    className="py-3.5 pl-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="Mở menu kiểm duyệt bài viết"
                        className="size-8 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-[#10243A] inline-flex items-center justify-center cursor-pointer outline-none"
                      >
                        <i
                          className="fa-solid fa-ellipsis text-sm"
                          aria-hidden="true"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-52 rounded-xl p-1.5 border border-slate-200 bg-white shadow-xl"
                      >
                        <DropdownMenuItem
                          onClick={() => onSelectPost(post)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
                        >
                          <i
                            className="fa-regular fa-eye w-4 text-slate-400"
                            aria-hidden="true"
                          />
                          <span>Xem chi tiết & Phân xử</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onApprovePost(post.id)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 cursor-pointer flex items-center gap-2.5"
                        >
                          <i
                            className="fa-solid fa-check w-4"
                            aria-hidden="true"
                          />
                          <span>
                            {isRejected
                              ? "Khôi phục & Phê duyệt"
                              : "Phê duyệt nhanh"}
                          </span>
                        </DropdownMenuItem>
                        {!isRejected && (
                          <DropdownMenuItem
                            onClick={() => onRejectPost(post.id)}
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 cursor-pointer flex items-center gap-2.5"
                          >
                            <i
                              className="fa-solid fa-ban w-4"
                              aria-hidden="true"
                            />
                            <span>Từ chối / Gỡ bài</span>
                          </DropdownMenuItem>
                        )}
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
                {isRejectedTab
                  ? "Chưa có bài viết nào bị gỡ hoặc từ chối."
                  : "Hàng đợi chờ duyệt đang trống. Mọi bài viết đã được xử lý."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

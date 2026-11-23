"use client";

import { useState, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { AppModalPortal } from "@/components/common/AppModalPortal";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_AVATAR } from "@/config/avatars";
import {
  ADMIN_UI_CONSTANTS,
  PLACE_PHOTO_STATUS_META,
  formatAdminDateTime,
} from "@/features/admin/admin.constants";
import { AdminDebouncedSearch } from "@/features/admin/components/AdminDebouncedSearch";
import {
  useAdminPlacePhotoContributions,
  useApproveAdminPlacePhoto,
  useRejectAdminPlacePhoto,
} from "@/features/admin/hooks/use-admin";
import type {
  AdminPlaceImageStatus,
  AdminPlacePhotoContributionItem,
} from "@/types/admin";

interface AdminPlacePhotosSectionProps {
  pendingCount: number;
}

export function AdminPlacePhotosSection({
  pendingCount,
}: AdminPlacePhotosSectionProps) {
  const [statusFilter, setStatusFilter] =
    useState<AdminPlaceImageStatus>("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [previewItem, setPreviewItem] =
    useState<AdminPlacePhotoContributionItem | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data, isLoading, isError, refetch } = useAdminPlacePhotoContributions(
    {
      page,
      limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
      status: statusFilter,
      search: search || undefined,
    }
  );

  const approveMutation = useApproveAdminPlacePhoto();
  const rejectMutation = useRejectAdminPlacePhoto();

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const items = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const totalCount = data?.meta.total ?? 0;
  const isActing = approveMutation.isPending || rejectMutation.isPending;

  const openPreview = (item: AdminPlacePhotoContributionItem) => {
    setRejectNote(item.moderationNote || "");
    setPreviewItem(item);
  };

  const closePreview = () => {
    if (isActing) return;
    setPreviewItem(null);
    setRejectNote("");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: Status Filter Pills + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Lọc trạng thái ảnh đóng góp"
          className="inline-flex p-1 rounded-xl bg-[#F8FAFC] border border-slate-200/80 gap-1"
        >
          {(
            [
              {
                id: "PENDING" as const,
                label: `Chờ duyệt (${pendingCount})`,
              },
              { id: "APPROVED" as const, label: "Đã duyệt" },
              { id: "REJECTED" as const, label: "Đã từ chối" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                statusFilter === tab.id
                  ? "font-bold bg-white text-[#0194F3] shadow-2xs border border-slate-200/80"
                  : "font-semibold text-slate-600 hover:text-[#10243A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AdminDebouncedSearch
          placeholder="Tìm theo địa điểm, người gửi, mô tả..."
          onSearchChange={handleSearchChange}
          className="w-72"
        />
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-center justify-between text-xs text-rose-800">
          <span className="font-semibold">
            Không thể tải danh sách ảnh đóng góp. Vui lòng thử lại.
          </span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white p-3 space-y-3"
            >
              <Skeleton className="aspect-[16/10] w-full rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 flex-1 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => {
            const statusMeta = PLACE_PHOTO_STATUS_META[item.status];
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden flex flex-col justify-between transition-colors hover:border-slate-300"
              >
                <div>
                  {/* Image Preview (click to open Lightbox) */}
                  <button
                    type="button"
                    onClick={() => openPreview(item)}
                    className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 group block cursor-pointer"
                    aria-label={`Xem phóng to ảnh đóng góp cho ${item.place?.name || "địa điểm"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.caption || item.place?.name || "Ảnh đóng góp"}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                      {item.isPrimary && item.status === "APPROVED" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0194F3] text-white">
                          Ảnh chính
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Metadata */}
                  <div className="p-3.5 space-y-2">
                    <div>
                      <h3 className="text-xs font-extrabold text-[#10243A] line-clamp-1">
                        {item.place?.name || "Địa điểm"}
                      </h3>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {item.place?.area?.nameVi ||
                          item.place?.area?.name ||
                          item.place?.address ||
                          "—"}
                      </p>
                    </div>

                    {item.caption && (
                      <p className="text-xs text-slate-700 bg-[#F8FAFC] border border-slate-200/60 rounded-lg px-2.5 py-1.5 line-clamp-2">
                        &ldquo;{item.caption}&rdquo;
                      </p>
                    )}

                    {item.status === "REJECTED" && item.moderationNote && (
                      <p className="text-[11px] text-rose-700 bg-rose-50/70 border border-rose-200/70 rounded-lg px-2.5 py-1.5 line-clamp-2">
                        <b>Lý do:</b> {item.moderationNote}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.uploadedBy?.avatarUrl || DEFAULT_AVATAR}
                          alt=""
                          loading="lazy"
                          className="size-5 rounded-full object-cover shrink-0"
                        />
                        <span className="font-semibold text-slate-700 truncate">
                          {item.uploadedBy?.fullName || "Người dùng"}
                        </span>
                      </div>
                      <span className="shrink-0 tabular-nums">
                        {formatAdminDateTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                  {item.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          approveMutation.mutate({ imageId: item.id })
                        }
                        className="flex-1 h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Phê duyệt
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          approveMutation.mutate({
                            imageId: item.id,
                            setAsPrimary: true,
                          })
                        }
                        title="Phê duyệt và đặt làm ảnh bìa chính của địa điểm"
                        className="h-8 px-2.5 rounded-lg bg-[#E8F4FD] hover:bg-[#D9EDFF] text-[#0194F3] text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Làm ảnh chính
                      </button>
                      <button
                        type="button"
                        onClick={() => openPreview(item)}
                        className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Từ chối
                      </button>
                    </>
                  )}

                  {item.status === "REJECTED" && (
                    <button
                      type="button"
                      onClick={() =>
                        approveMutation.mutate({ imageId: item.id })
                      }
                      className="flex-1 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Khôi phục & Phê duyệt
                    </button>
                  )}

                  {item.status === "APPROVED" && (
                    <>
                      {!item.isPrimary && (
                        <button
                          type="button"
                          onClick={() =>
                            approveMutation.mutate({
                              imageId: item.id,
                              setAsPrimary: true,
                            })
                          }
                          className="flex-1 h-8 px-2.5 rounded-lg bg-[#E8F4FD] hover:bg-[#D9EDFF] text-[#0194F3] text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Đặt làm ảnh chính
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openPreview(item)}
                        className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Gỡ / Từ chối
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="py-14 text-center rounded-2xl border border-dashed border-slate-200 bg-[#F8FAFC]/60 space-y-1.5">
          <div className="text-sm font-bold text-[#10243A]">
            {statusFilter === "PENDING"
              ? "Không có ảnh đóng góp nào đang chờ duyệt"
              : statusFilter === "APPROVED"
                ? "Chưa có ảnh đóng góp nào được phê duyệt"
                : "Chưa có ảnh đóng góp nào bị từ chối"}
          </div>
          <p className="text-xs text-slate-500">
            Khi người dùng gửi ảnh thực tế từ trang chi tiết địa điểm, ảnh sẽ xuất hiện tại đây để Quản trị viên kiểm duyệt.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="font-medium">
            Trang <b className="text-[#10243A]">{page}</b> /{" "}
            <b className="text-[#10243A]">{totalPages}</b> • Tổng{" "}
            <b className="text-[#10243A] tabular-nums">
              {totalCount.toLocaleString("vi-VN")}
            </b>{" "}
            ảnh
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

      {/* Lightbox & Review Modal */}
      {previewItem && (
        <AppModalPortal
          open={Boolean(previewItem)}
          onClose={closePreview}
          ariaLabelledBy="place-photo-review-title"
          maxWidthClass="max-w-xl"
        >
          <div className="px-5 py-4 border-b border-slate-100 bg-[#F8FAFC] flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <h3
                id="place-photo-review-title"
                className="text-sm font-extrabold text-[#10243A] truncate"
              >
                Kiểm duyệt ảnh: {previewItem.place?.name || "Địa điểm"}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                Gửi bởi {previewItem.uploadedBy?.fullName || "Thành viên"} •{" "}
                {formatAdminDateTime(previewItem.createdAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={closePreview}
              disabled={isActing}
              aria-label="Đóng xem ảnh"
              className="size-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 inline-flex items-center justify-center text-slate-500 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto text-xs">
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 max-h-80 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewItem.imageUrl}
                alt={previewItem.caption || previewItem.place?.name || "Ảnh đóng góp"}
                className="max-h-80 w-auto object-contain"
              />
            </div>

            {previewItem.caption && (
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-slate-700">
                <span className="font-bold text-[#10243A]">Mô tả người gửi: </span>
                {previewItem.caption}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="place-photo-moderation-note"
                className="block text-xs font-extrabold text-[#10243A]"
              >
                Ghi chú kiểm duyệt / Lý do từ chối
              </label>
              <textarea
                id="place-photo-moderation-note"
                rows={2}
                value={rejectNote}
                spellCheck={false}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Ví dụ: Ảnh mờ, chụp sai địa điểm, dính chữ quảng cáo..."
                className="w-full p-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-[#10243A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
              {previewItem.status !== "REJECTED" && (
                <button
                  type="button"
                  disabled={isActing}
                  onClick={async () => {
                    await rejectMutation.mutateAsync({
                      imageId: previewItem.id,
                      reason: rejectNote.trim() || undefined,
                    });
                    closePreview();
                  }}
                  className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isActing && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Từ chối ảnh</span>
                </button>
              )}

              <button
                type="button"
                disabled={isActing}
                onClick={async () => {
                  await approveMutation.mutateAsync({
                    imageId: previewItem.id,
                    setAsPrimary: true,
                    note: rejectNote.trim() || undefined,
                  });
                  closePreview();
                }}
                className="h-9 px-4 rounded-xl bg-[#E8F4FD] hover:bg-[#D9EDFF] text-[#0194F3] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span>Duyệt & Đặt ảnh chính</span>
              </button>

              <button
                type="button"
                disabled={isActing}
                onClick={async () => {
                  await approveMutation.mutateAsync({
                    imageId: previewItem.id,
                    note: rejectNote.trim() || undefined,
                  });
                  closePreview();
                }}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isActing && <Loader2 className="size-3.5 animate-spin" />}
                <span>
                  {previewItem.status === "REJECTED"
                    ? "Khôi phục & Phê duyệt"
                    : "Phê duyệt hiển thị"}
                </span>
              </button>
            </div>
          </div>
        </AppModalPortal>
      )}
    </div>
  );
}

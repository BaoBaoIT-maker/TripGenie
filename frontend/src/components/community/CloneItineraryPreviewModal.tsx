"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import type { CommunityLinkedItinerarySummary } from "@/types/community";
import { useItineraryQuery } from "@/features/planner/hooks/use-itinerary-planner";
import { useCloneCommunityItinerary } from "@/features/community/hooks/use-community";
import { formatVnd } from "@/features/planner/model/itinerary-format";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { CommunityModalPortal } from "./CommunityModalPortal";
import { toast } from "sonner";

interface CloneItineraryPreviewModalProps {
  open: boolean;
  onClose: () => void;
  itinerarySummary: CommunityLinkedItinerarySummary | null;
  cloneCount?: number;
}

export function CloneItineraryPreviewModal({
  open,
  onClose,
  itinerarySummary,
  cloneCount,
}: CloneItineraryPreviewModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedDay, setSelectedDay] = useState<number | "all">("all");

  const itineraryId = open && itinerarySummary ? itinerarySummary.id : "";
  const {
    data: detail,
    isLoading,
    isError,
    refetch,
  } = useItineraryQuery(itineraryId);

  const cloneMutation = useCloneCommunityItinerary();

  const handleClose = useCallback(() => {
    if (cloneMutation.isPending) return;
    setSelectedDay("all");
    onClose();
  }, [cloneMutation.isPending, onClose]);

  if (!open || !itinerarySummary) return null;

  const destinationLabel =
    itinerarySummary.areaName ||
    itinerarySummary.destination ||
    detail?.destination ||
    "Việt Nam";

  const totalDays = detail?.days?.length || detail?.totalDays || 0;
  const totalPlaces =
    detail?.days?.reduce((acc, d) => acc + d.activities.length, 0) ??
    itinerarySummary.totalPlaces;

  const estimatedTotal =
    detail?.budgetBreakdown?.totalEstimated ||
    itinerarySummary.estimatedCost ||
    null;

  const visibleDays =
    detail?.days?.filter(
      (d) => selectedDay === "all" || d.dayNumber === selectedDay
    ) ?? [];

  const handleConfirmClone = async () => {
    if (!user) {
      toast.error(
        "Vui lòng đăng nhập để nhân bản lịch trình về tài khoản của bạn"
      );
      return;
    }
    const cloned = await cloneMutation.mutateAsync(itinerarySummary.id);
    if (cloned?.id) {
      handleClose();
      router.push(`/itineraries/${cloned.id}`);
    }
  };

  return (
    <CommunityModalPortal
      open={open}
      onClose={handleClose}
      ariaLabelledBy="clone-preview-modal-title"
      maxWidthClass="max-w-[540px]"
    >
      {/* Modal Header (matching community_redesign_demo.html lines 1292-1303) */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-[10px] bg-[#0194F3] text-white flex items-center justify-center text-base shrink-0 shadow-[0_2px_6px_rgba(1,148,243,0.25)]">
            <i className="fa-solid fa-clipboard-list" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3
              id="clone-preview-modal-title"
              className="text-[14px] font-black text-[#0F172A] truncate"
            >
              {detail?.title || itinerarySummary.title}
            </h3>
            <p className="text-[11px] text-[#64748B] truncate">
              {destinationLabel}
              {totalDays > 0 ? ` • ${totalDays} ngày` : ""} • {totalPlaces} điểm
              đến
              {estimatedTotal && estimatedTotal > 0
                ? ` • ~${formatVnd(estimatedTotal)}`
                : ""}
              {typeof cloneCount === "number" && cloneCount > 0
                ? ` • ${cloneCount} lượt nhân bản`
                : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={cloneMutation.isPending}
          aria-label="Đóng cửa sổ xem trước lịch trình"
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Day Filter Pills (when itinerary has > 1 day) */}
      {detail && detail.days.length > 1 && (
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-[#F1F5F9] bg-white overflow-x-auto shrink-0 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedDay("all")}
            className={`px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
              selectedDay === "all"
                ? "bg-[#0194F3] text-white"
                : "bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            Tất cả ({detail.days.length} ngày)
          </button>
          {detail.days.map((d) => (
            <button
              key={d.dayNumber}
              type="button"
              onClick={() => setSelectedDay(d.dayNumber)}
              className={`px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${
                selectedDay === d.dayNumber
                  ? "bg-[#0194F3] text-white"
                  : "bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Ngày {d.dayNumber} ({d.activities.length})
            </button>
          ))}
        </div>
      )}

      {/* Modal Body: Timeline Preview (matching community_redesign_demo.html lines 1306-1345) */}
      <div className="p-5 flex flex-col gap-4 max-h-[60vh] overflow-y-auto flex-1 custom-scroll">
        <div className="py-3 px-4 rounded-[14px] bg-[#F0F7FF] border border-[#BAE0FD] text-[12px] text-[#007FE3] leading-[1.5] font-medium">
          <i className="fa-regular fa-lightbulb mr-1.5" aria-hidden="true" />
          Khi nhân bản, lộ trình này sẽ được sao chép vào mục{" "}
          <strong>&ldquo;Lịch trình của tôi&rdquo;</strong> để bạn và nhóm bạn
          tự do chỉnh sửa ngày đi, giờ giấc và bổ sung quán ăn yêu thích.
        </div>

        {isLoading ? (
          <div className="space-y-3 py-1">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-16 rounded-[12px] bg-[#F1F5F9] animate-pulse"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center space-y-2.5">
            <p className="text-xs font-extrabold text-[#0F172A]">
              Không thể tải chi tiết lịch trình tóm gọn
            </p>
            <p className="text-[11px] text-[#64748B]">
              Bạn vẫn có thể xác nhận nhân bản ngay hoặc thử tải lại chi tiết
              các ngày.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="h-8 px-3.5 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[11px] font-bold text-[#334155] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="size-3" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : visibleDays.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center space-y-1">
            <p className="text-xs font-extrabold text-[#0F172A]">
              Lịch trình chưa có danh sách điểm dừng chi tiết
            </p>
            <p className="text-[11px] text-[#64748B]">
              Khi nhân bản về tài khoản, bạn có thể dùng AI Copilot để bổ sung
              địa điểm tự động.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleDays.map((day) => (
              <div key={day.dayNumber} className="flex flex-col gap-2">
                <div className="text-[12px] font-black uppercase tracking-[0.05em] text-[#1E293B] flex items-center gap-2">
                  <i
                    className="fa-solid fa-circle-dot text-[#0194F3] text-[12px]"
                    aria-hidden="true"
                  />
                  <span>
                    Ngày {day.dayNumber}:{" "}
                    {day.theme || `Khám phá ${destinationLabel}`}
                  </span>
                </div>

                {day.activities.length === 0 ? (
                  <p className="text-[11px] text-[#64748B] pl-5">
                    Chưa có hoạt động nào trong ngày này.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 pl-3.5 border-l-2 border-[#E2E8F0] text-[12px] text-[#475569] ml-[5px]">
                    {day.activities.map((act, idx) => (
                      <div
                        key={act.id || `${day.dayNumber}-${act.placeId}-${idx}`}
                        className="py-2 px-2.5 rounded-[10px] bg-[#F8FAFC] border border-[#F1F5F9] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <strong className="text-[#0F172A]">
                            {act.startTime || `#${idx + 1}`}:
                          </strong>{" "}
                          <span className="font-semibold text-[#1E293B]">
                            {act.placeName}
                          </span>
                          {act.categoryName && (
                            <span className="text-[11px] text-[#64748B]">
                              {" "}
                              ({act.categoryName})
                            </span>
                          )}
                        </div>
                        {act.estimatedCost && act.estimatedCost > 0 ? (
                          <span className="text-[11px] font-bold text-[#0194F3] shrink-0">
                            ~{formatVnd(act.estimatedCost)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Footer (matching community_redesign_demo.html lines 1348-1356) */}
      <div className="py-3.5 px-5 border-t border-[#F1F5F9] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <Link
          href={`/itineraries/${itinerarySummary.id}`}
          onClick={handleClose}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#64748B] hover:text-[#0194F3] transition-colors"
        >
          <ExternalLink className="size-3.5" />
          <span>Xem bản đồ đầy đủ</span>
        </Link>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleClose}
            disabled={cloneMutation.isPending}
            className="px-3.5 py-2 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[12px] font-bold text-[#334155] transition-colors cursor-pointer disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleConfirmClone}
            disabled={cloneMutation.isPending}
            className="px-4 py-2 rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-[12px] font-bold inline-flex items-center gap-1.5 shadow-[0_2px_6px_rgba(1,148,243,0.25)] transition-colors cursor-pointer disabled:opacity-60"
          >
            {cloneMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Đang nhân bản...</span>
              </>
            ) : (
              <>
                <i className="fa-regular fa-clone" aria-hidden="true" />
                <span>Nhân bản vào chuyến đi của tôi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </CommunityModalPortal>
  );
}

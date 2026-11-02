"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";
import type { CommunityLinkedItinerarySummary } from "@/types/community";
import { Button } from "@/components/ui/button";
import { useItineraryQuery } from "@/features/planner/hooks/use-itinerary-planner";
import { useCloneCommunityItinerary } from "@/features/community/hooks/use-community";
import { formatVnd } from "@/features/planner/model/itinerary-format";
import { useAuth } from "@/features/auth/hooks/use-auth";
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
    setSelectedDay("all");
    onClose();
  }, [onClose]);

  // Escape key & scroll lock for modal accessibility
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !cloneMutation.isPending) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, cloneMutation.isPending, handleClose]);

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clone-preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !cloneMutation.isPending) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl overflow-hidden my-auto flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <CalendarDays className="size-3.5 shrink-0" />
              <span>Xem trước & Xác nhận nhân bản lịch trình</span>
              {typeof cloneCount === "number" && cloneCount > 0 && (
                <span className="text-muted-foreground font-medium">
                  • Đã có {cloneCount} lượt nhân bản
                </span>
              )}
            </div>
            <h2
              id="clone-preview-modal-title"
              className="text-base sm:text-lg font-bold font-heading text-foreground truncate"
            >
              {detail?.title || itinerarySummary.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={cloneMutation.isPending}
            aria-label="Đóng cửa sổ xem trước lịch trình"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Summary Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 px-6 py-3 border-b border-border bg-secondary/25 shrink-0">
          <div className="space-y-0.5">
            <span className="text-[11px] text-muted-foreground block">
              Điểm đến
            </span>
            <span className="text-xs sm:text-sm font-bold text-foreground inline-flex items-center gap-1 truncate">
              <MapPin className="size-3.5 text-primary shrink-0" />
              <span className="truncate">{destinationLabel}</span>
            </span>
          </div>

          <div className="space-y-0.5 border-l border-border/70 pl-3">
            <span className="text-[11px] text-muted-foreground block">
              Quy mô hành trình
            </span>
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {totalDays > 0 ? `${totalDays} ngày • ` : ""}
              {totalPlaces} địa điểm
            </span>
          </div>

          <div className="space-y-0.5 border-l border-border/70 pl-3">
            <span className="text-[11px] text-muted-foreground block">
              Chi phí dự kiến
            </span>
            <span className="text-xs sm:text-sm font-bold text-primary">
              {estimatedTotal && estimatedTotal > 0
                ? `~${formatVnd(estimatedTotal)}`
                : "Linh hoạt"}
            </span>
          </div>
        </div>

        {/* Day Filter Pills */}
        {detail && detail.days.length > 1 && (
          <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-border bg-card overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDay("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                selectedDay === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({detail.days.length} ngày)
            </button>
            {detail.days.map((d) => (
              <button
                key={d.dayNumber}
                type="button"
                onClick={() => setSelectedDay(d.dayNumber)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  selectedDay === d.dayNumber
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                Ngày {d.dayNumber} ({d.activities.length})
              </button>
            ))}
          </div>
        )}

        {/* Body: 4 Resilience States (Loading, Error, Empty, Data) */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-20 rounded-xl bg-muted/60 animate-pulse"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-border bg-muted/20 p-8 text-center space-y-3">
              <p className="text-sm font-bold text-foreground">
                Không thể tải chi tiết lịch trình tóm gọn
              </p>
              <p className="text-xs text-muted-foreground">
                Bạn vẫn có thể xác nhận nhân bản ngay hoặc thử tải lại chi tiết các ngày.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="h-9 px-3.5 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                <span>Thử lại</span>
              </Button>
            </div>
          ) : visibleDays.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-1.5">
              <p className="text-sm font-bold text-foreground">
                Lịch trình chưa có danh sách điểm dừng chi tiết
              </p>
              <p className="text-xs text-muted-foreground">
                Khi nhân bản về tài khoản, bạn có thể dùng AI Copilot để bổ sung địa điểm tự động.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleDays.map((day) => (
                <div
                  key={day.dayNumber}
                  className="rounded-xl border border-border/80 bg-background p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2.5 py-0.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0">
                        Ngày {day.dayNumber}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {day.theme || `Hành trình ngày ${day.dayNumber}`}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {day.activities.length} điểm đến
                    </span>
                  </div>

                  {day.activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      Chưa có hoạt động nào trong ngày này.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {day.activities.map((act, idx) => (
                        <div
                          key={act.id || `${day.dayNumber}-${act.placeId}-${idx}`}
                          className="py-2 first:pt-0.5 last:pb-0.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono font-bold text-primary w-12 shrink-0">
                              {act.startTime || `#${idx + 1}`}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">
                                {act.placeName}
                              </p>
                              {(act.categoryName || act.address) && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {act.categoryName}
                                  {act.categoryName && act.address ? " • " : ""}
                                  {act.address}
                                </p>
                              )}
                            </div>
                          </div>

                          <span className="text-muted-foreground font-medium shrink-0">
                            {act.estimatedCost && act.estimatedCost > 0
                              ? `~${formatVnd(act.estimatedCost)}`
                              : "Miễn phí"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Explain What Cloning Does */}
          <div className="rounded-xl border border-primary/25 bg-secondary/35 p-3.5 text-xs text-foreground/90 leading-relaxed">
            <span className="font-bold text-primary">Lưu ý khi nhân bản:</span>{" "}
            Hệ thống sẽ tạo một <strong>bản sao độc lập</strong> trong mục{" "}
            <strong>Lịch trình của tôi</strong>. Bạn có thể tự do thêm/bớt địa điểm hoặc nhờ AI Copilot tinh chỉnh mà không ảnh hưởng tới bản gốc của tác giả.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <Link
            href={`/itineraries/${itinerarySummary.id}`}
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
          >
            <ExternalLink className="size-3.5" />
            <span>Mở xem bản đồ đầy đủ</span>
          </Link>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={cloneMutation.isPending}
              className="min-h-[42px] px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Để sau
            </Button>
            <Button
              type="button"
              onClick={handleConfirmClone}
              disabled={cloneMutation.isPending}
              className="min-h-[42px] px-4 rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
            >
              {cloneMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Đang nhân bản...</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Xác nhận nhân bản về tài khoản</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus,
  Calendar,
  MapPin,
  Check,
  Loader2,
  Camera,
  AlertCircle,
} from "lucide-react";
import {
  useItinerariesListQuery,
  useAddPlaceToItinerary,
} from "@/features/planner/hooks/use-itinerary-planner";
import {
  ITINERARY_SCHEDULE_CONSTANTS,
  ITINERARY_TIME_SLOTS,
  isSameDestinationArea,
  resolveDefaultTimeSlot,
  resolvePreviewTimeSlot,
  type AddablePlace,
  type ItineraryTimeSlotId,
} from "@/features/planner/utils/itinerary-schedule.util";
import type { ItineraryDetail } from "@/types/itinerary";

export {
  ITINERARY_TIME_SLOTS,
  isSameDestinationArea,
  resolveDefaultTimeSlot,
  resolvePreviewTimeSlot,
  type AddablePlace,
  type ItineraryTimeSlotId,
};

interface AddPlaceToItineraryModalProps {
  place: AddablePlace | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AddPlaceToItineraryModal({
  place,
  isOpen,
  onClose,
}: AddPlaceToItineraryModalProps) {
  const router = useRouter();
  const {
    data: itineraries = [],
    isLoading,
    isError,
    refetch,
  } = useItinerariesListQuery('OWNED', { enabled: isOpen && Boolean(place?.id) });
  const addPlaceMutation = useAddPlaceToItinerary();

  const sortedItineraries = useMemo(() => {
    if (!place) return itineraries;
    return [...itineraries].sort((a, b) => {
      const aMatch = isSameDestinationArea(a.destination, place) ? 1 : 0;
      const bMatch = isSameDestinationArea(b.destination, place) ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [itineraries, place]);

  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<ItineraryTimeSlotId>(() =>
    resolveDefaultTimeSlot(place?.category)
  );

  if (!place) return null;

  const activeItinerary: ItineraryDetail | undefined =
    sortedItineraries.find((it) => it.id === selectedItineraryId) ?? sortedItineraries[0];

  const totalDays = Math.max(1, activeItinerary?.totalDays ?? 1);
  const safeDay = selectedDay > totalDays ? 1 : selectedDay;

  const existingDaysWithPlace = new Set<number>(
    (activeItinerary?.days ?? [])
      .filter((d) => d.activities?.some((act) => act.placeId === place.id))
      .map((d) => d.dayNumber)
  );

  const selectedDayActivities =
    activeItinerary?.days?.find((d) => d.dayNumber === safeDay)?.activities ?? [];

  const activeSlotConfig =
    ITINERARY_TIME_SLOTS.find((s) => s.id === selectedTimeSlot) ?? ITINERARY_TIME_SLOTS[2];
  const activeSlotResolved = resolvePreviewTimeSlot(
    activeSlotConfig,
    selectedDayActivities
  );

  const isAlreadyInSelectedDay = existingDaysWithPlace.has(safeDay);
  const previewImage = place.coverImage || place.primaryImage || null;

  const handleConfirmAdd = () => {
    if (!activeItinerary || isAlreadyInSelectedDay || addPlaceMutation.isPending) return;

    addPlaceMutation.mutate(
      {
        itineraryId: activeItinerary.id,
        dayNumber: safeDay,
        placeId: place.id,
        placeName: place.name,
        timeSlot: selectedTimeSlot,
      },
      {
        onSuccess: (res) => {
          if (!res.success) {
            toast.error(res.message || "Không thể thêm địa điểm vào lịch trình.");
            return;
          }
          toast.success(
            res.message || `Đã thêm "${place.name}" vào Ngày ${safeDay} (${selectedTimeSlot})!`,
            {
              action: {
                label: "Xem lịch trình",
                onClick: () =>
                  router.push(
                    `${ITINERARY_SCHEDULE_CONSTANTS.ITINERARY_DETAIL_ROUTE_PREFIX}/${activeItinerary.id}`
                  ),
              },
            }
          );
          onClose();
        },
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : "Không thể thêm địa điểm vào lịch trình. Vui lòng thử lại."
          );
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-5 sm:p-6 gap-4 rounded-2xl overflow-hidden">
        <DialogHeader className="space-y-1 pr-6 min-w-0">
          <DialogTitle className="font-heading text-lg sm:text-xl flex items-center gap-2 min-w-0">
            <CalendarPlus className="size-5 text-primary shrink-0" aria-hidden="true" />
            <span className="truncate">Thêm vào lịch trình</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Chọn chuyến đi, ngày và khung giờ bạn muốn ghé thăm địa điểm này.
          </DialogDescription>
        </DialogHeader>

        {/* Place Summary Card */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/70 min-w-0 w-full overflow-hidden">
          <div className="relative size-11 rounded-xl overflow-hidden bg-muted shrink-0">
            {previewImage ? (
              <Image
                src={previewImage}
                alt={place.name}
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : (
              <div className="size-full flex items-center justify-center text-muted-foreground">
                <Camera className="size-5" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h4 className="text-xs font-bold text-foreground truncate">{place.name}</h4>
            <p className="text-[11px] text-muted-foreground truncate">
              {place.address ||
                place.city ||
                place.areaName ||
                ITINERARY_SCHEDULE_CONSTANTS.DEFAULT_FALLBACK_LOCATION}
            </p>
          </div>
        </div>

        {/* 4-State Content Area */}
        {isLoading ? (
          <div className="space-y-2.5 py-2 min-w-0" aria-label="Đang tải danh sách lịch trình">
            {Array.from(
              { length: ITINERARY_SCHEDULE_CONSTANTS.LOADING_SKELETON_COUNT },
              (_, i) => (
                <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
              )
            )}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center space-y-3 min-w-0">
            <div className="mx-auto size-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Không thể tải danh sách lịch trình
              </p>
              <p className="text-[11px] text-muted-foreground">
                Vui lòng kiểm tra kết nối mạng hoặc đăng nhập lại để tiếp tục.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="rounded-xl text-xs cursor-pointer"
            >
              Thử lại
            </Button>
          </div>
        ) : sortedItineraries.length === 0 ? (
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 text-center space-y-3 min-w-0">
            <div className="mx-auto size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">
                Bạn chưa có lịch trình nào
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Hãy khởi tạo một lịch trình chuyến đi trước, sau đó bạn có thể thêm bất kỳ địa điểm nào từ bản đồ vào từng ngày.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                onClose();
                router.push(ITINERARY_SCHEDULE_CONSTANTS.PLANNER_ROUTE);
              }}
              className="rounded-xl text-xs font-semibold cursor-pointer"
            >
              Đến trang Lịch trình
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5 min-w-0 w-full overflow-hidden">
            {/* Step 1: Select Itinerary */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-semibold text-foreground block">
                1. Chọn chuyến đi ({sortedItineraries.length})
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto overflow-x-hidden pr-1">
                {sortedItineraries.map((it) => {
                  const isSelected = activeItinerary?.id === it.id;
                  const isAreaMatch = isSameDestinationArea(it.destination, place);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setSelectedItineraryId(it.id);
                        setSelectedDay(1);
                      }}
                      className={`w-full min-w-0 overflow-hidden flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-2xs"
                          : "border-border/70 hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5 overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-foreground truncate">
                            {it.title}
                          </span>
                          {isAreaMatch && (
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground whitespace-nowrap">
                              Cùng điểm đến
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                          <span className="inline-flex items-center gap-1 min-w-0 truncate">
                            <MapPin className="size-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              {it.destination ||
                                ITINERARY_SCHEDULE_CONSTANTS.DEFAULT_FALLBACK_LOCATION}
                            </span>
                          </span>
                          <span className="shrink-0">•</span>
                          <span className="shrink-0 whitespace-nowrap">{it.totalDays} ngày</span>
                        </div>
                      </div>
                      <div
                        className={`size-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" aria-hidden="true" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select Day */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-semibold text-foreground block">
                2. Chọn ngày trong lịch trình
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {Array.from({ length: totalDays }, (_, idx) => {
                  const dayNum = idx + 1;
                  const isDaySelected = safeDay === dayNum;
                  const alreadyInThisDay = existingDaysWithPlace.has(dayNum);
                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => setSelectedDay(dayNum)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isDaySelected
                          ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                          : "border-border/80 bg-background hover:bg-muted text-foreground"
                      }`}
                    >
                      <span>Ngày {dayNum}</span>
                      {alreadyInThisDay && (
                        <Check
                          className={`size-3 shrink-0 ${
                            isDaySelected ? "text-primary-foreground" : "text-primary"
                          }`}
                          aria-label="Đã có trong ngày này"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Select Time Slot */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-semibold text-foreground block">
                3. Chọn buổi ghé thăm
              </label>
              <div className="grid grid-cols-2 gap-1.5 min-w-0">
                {ITINERARY_TIME_SLOTS.map((slot) => {
                  const Icon = slot.icon;
                  const isSlotSelected = selectedTimeSlot === slot.id;
                  const previewSlot = resolvePreviewTimeSlot(slot, selectedDayActivities);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedTimeSlot(slot.id)}
                      className={`min-w-0 overflow-hidden flex items-center gap-2 p-2 rounded-xl border text-left transition-all min-h-[42px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSlotSelected
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border/70 bg-background hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="text-xs leading-tight truncate">{slot.label}</div>
                        <div className="text-[10px] text-muted-foreground font-normal truncate">
                          {previewSlot.start} – {previewSlot.end}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {activeSlotResolved.shifted && !isAlreadyInSelectedDay && (
                <p className="text-[11px] text-primary bg-primary/5 border border-primary/20 rounded-xl px-2.5 py-1.5">
                  Khung giờ dự kiến: <strong>{activeSlotResolved.start} – {activeSlotResolved.end}</strong> (tự động xếp nối tiếp để không trùng lịch đã có trong Ngày {safeDay}).
                </p>
              )}
            </div>

            {isAlreadyInSelectedDay && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
                Địa điểm này đã có trong Ngày {safeDay} của chuyến đi. Hãy chọn một ngày khác.
              </p>
            )}

            {/* Submit CTA */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 min-w-0">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="rounded-xl text-xs cursor-pointer shrink-0"
              >
                Đóng
              </Button>
              <Button
                type="button"
                disabled={isAlreadyInSelectedDay || addPlaceMutation.isPending}
                onClick={handleConfirmAdd}
                className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer min-w-0 truncate"
              >
                {addPlaceMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden="true" />
                ) : (
                  <CalendarPlus className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">
                  {addPlaceMutation.isPending
                    ? "Đang thêm..."
                    : isAlreadyInSelectedDay
                      ? "Địa điểm đã có trong ngày này"
                      : `Thêm vào Ngày ${safeDay} (${selectedTimeSlot})`}
                </span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

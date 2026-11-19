'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { placeService } from '@/services/place.service';
import {
  useLodgingSuggestionsQuery,
  usePrefetchLodgingSuggestions,
  useUpdateLodging,
} from '../../hooks/use-itinerary-planner';
import { formatVnd } from '../../model/itinerary-format';
import type {
  ItineraryDay,
  ItineraryDayLodging,
  ItineraryLodgingSuggestionItem,
} from '@/types/itinerary';
import type { Place } from '@/types/place';

/** Slugs and name keywords that identify lodging places — mirrors backend ITINERARY_PLANNING_CONFIG.LODGING */
const LODGING_SLUGS = ['khach-san', 'homestay'] as const;
const LODGING_KEYWORDS = [
  'khách sạn',
  'khach san',
  'homestay',
  'resort',
  'lưu trú',
  'nha nghi',
  'villa',
  'hostel',
  'hotel',
] as const;
const EXCLUDED_SLUGS = ['spa'] as const;

function isLodgingPlace(place: Place): boolean {
  const cat = `${place.category || ''} ${place.categoryLabel || ''}`.toLowerCase();
  if (EXCLUDED_SLUGS.some((ex) => cat.includes(ex))) return false;
  if (LODGING_SLUGS.some((s) => cat.includes(s))) return true;
  const name = place.name.toLowerCase();
  return LODGING_KEYWORDS.some((kw) => cat.includes(kw) || name.includes(kw));
}

interface LodgingPickerDialogProps {
  open: boolean;
  onClose: () => void;
  itineraryId: string;
  initialNight: number;
  totalNights: number;
  budgetLevel?: string;
  destinationCity?: string | null;
  days?: ItineraryDay[];
}

type SuggestionGroupKey = 'nearest' | 'bestValue' | 'topRated';
type TargetSelectionMode = 'all' | number;

const GROUP_TABS: ReadonlyArray<{
  key: SuggestionGroupKey;
  label: string;
  icon: string;
  desc: string;
}> = [
  {
    key: 'nearest',
    label: 'Gần lịch trình nhất',
    icon: 'fa-solid fa-location-crosshairs',
    desc: 'Tối ưu quãng đường di chuyển tới các điểm trong ngày đang chọn',
  },
  {
    key: 'bestValue',
    label: 'Đáng tiền nhất',
    icon: 'fa-solid fa-scale-balanced',
    desc: 'Cân bằng giữa ngân sách, chất lượng và vị trí',
  },
  {
    key: 'topRated',
    label: 'Đánh giá cao',
    icon: 'fa-solid fa-award',
    desc: 'Điểm đánh giá thực tế và lượt nhận xét nổi bật',
  },
];

export function LodgingPickerDialog({
  open,
  onClose,
  itineraryId,
  initialNight,
  totalNights,
  budgetLevel = 'MEDIUM',
  destinationCity,
  days = [],
}: LodgingPickerDialogProps) {
  const rawTotalNights = Number(totalNights);
  const clampedTotalNights =
    Number.isFinite(rawTotalNights) && rawTotalNights >= 1
      ? Math.trunc(rawTotalNights)
      : 1;

  const rawInitialNight = Number(initialNight);
  const safeInitialNight =
    Number.isFinite(rawInitialNight) && rawInitialNight >= 1
      ? Math.max(1, Math.min(clampedTotalNights, Math.trunc(rawInitialNight)))
      : 1;

  const [selectedNight, setSelectedNight] = useState<number>(safeInitialNight);
  const [targetMode, setTargetMode] = useState<TargetSelectionMode>(
    clampedTotalNights > 1 ? safeInitialNight : 'all',
  );
  const [activeGroup, setActiveGroup] = useState<SuggestionGroupKey>('nearest');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const prefetchNight = usePrefetchLodgingSuggestions(itineraryId, budgetLevel);

  // Warm Night 1 cache in the background when viewing a multi-day itinerary
  useEffect(() => {
    if (days.length > 1) {
      prefetchNight(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryId, budgetLevel, days.length]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setActiveGroup('nearest');
      return;
    }
    setSelectedNight(safeInitialNight);
    setTargetMode(clampedTotalNights > 1 ? safeInitialNight : 'all');

    // Prefetch all remaining nights so switching tabs is instantaneous
    for (let n = 1; n <= clampedTotalNights; n++) {
      if (n !== safeInitialNight) {
        prefetchNight(n);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, safeInitialNight, clampedTotalNights]);

  const nightList = useMemo(
    () => Array.from({ length: clampedTotalNights }, (_, i) => i + 1),
    [clampedTotalNights],
  );

  const lodgingByNight = useMemo(() => {
    const map = new Map<number, ItineraryDayLodging>();
    for (const d of days) {
      if (d.lodging && !d.lodging.isCheckOutDay) {
        map.set(d.lodging.nightNumber, d.lodging);
      }
    }
    return map;
  }, [days]);

  const {
    data: suggestions,
    isLoading,
    isError,
    refetch,
  } = useLodgingSuggestionsQuery(
    itineraryId,
    open ? selectedNight : null,
    budgetLevel,
  );

  const updateLodgingMutation = useUpdateLodging(itineraryId);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!open || q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const keyword = destinationCity ? `${q} ${destinationCity}` : q;
        const places = await placeService.getPlaces({ keyword });
        if (active) {
          const filtered = (Array.isArray(places) ? places : []).filter(
            isLodgingPlace,
          );
          setSearchResults(filtered.length > 0 ? filtered : places.slice(0, 8));
        }
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, open, destinationCity]);

  const activeItems: ItineraryLodgingSuggestionItem[] = useMemo(() => {
    if (!suggestions) return [];
    return suggestions[activeGroup] ?? [];
  }, [suggestions, activeGroup]);

  const handleChooseNightButton = (nightNum: number) => {
    setSelectedNight(nightNum);
    setTargetMode(nightNum);
  };

  const handleChooseApplyAllMode = () => {
    setTargetMode('all');
  };

  const handleSelectPlace = async (
    target:
      | {
          id: string;
          name: string;
          address?: string | null;
          latitude?: number;
          longitude?: number;
          ratingAvg?: number | null;
          imageUrl?: string | null;
          pricePerNight?: number | null;
        }
      | {
          placeId: string;
          name: string;
          address?: string | null;
          latitude?: number;
          longitude?: number;
          ratingAvg?: number | null;
          imageUrl?: string | null;
          pricePerNight?: number | null;
        },
  ) => {
    if (updateLodgingMutation.isPending) return;
    const placeId = 'placeId' in target ? target.placeId : target.id;
    if (!placeId) return;

    setSelectingId(placeId);

    const rawSelected = Number(selectedNight);
    const validSelected =
      Number.isFinite(rawSelected) && rawSelected >= 1
        ? Math.max(1, Math.min(clampedTotalNights, Math.trunc(rawSelected)))
        : 1;

    const isAll = targetMode === 'all';
    const fromNight = isAll ? 1 : validSelected;
    const toNight = isAll ? clampedTotalNights : validSelected;

    try {
      await updateLodgingMutation.mutateAsync({
        placeId,
        fromNight,
        toNight,
        optimisticLodging: {
          name: target.name,
          address: target.address ?? null,
          latitude:
            target.latitude != null ? Number(target.latitude) : undefined,
          longitude:
            target.longitude != null ? Number(target.longitude) : undefined,
          ratingAvg: target.ratingAvg ?? null,
          pricePerNight: target.pricePerNight ?? null,
          imageUrl: target.imageUrl ?? null,
        },
      });

      if (isAll || clampedTotalNights === 1) {
        toast.success(
          `Đã áp dụng chỗ lưu trú cho toàn bộ chuyến đi (${clampedTotalNights} đêm) và tối ưu lại lộ trình!`,
        );
        onClose();
      } else {
        toast.success(
          `Đã cập nhật chỗ lưu trú cho Đêm ${validSelected} (Ngày ${validSelected}) và tối ưu lại lộ trình!`,
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật chỗ lưu trú. Vui lòng thử lại.',
      );
    } finally {
      setSelectingId(null);
    }
  };

  if (!open) return null;

  const isSearchMode = searchQuery.trim().length >= 2;
  const actionButtonLabel =
    targetMode === 'all' || clampedTotalNights === 1
      ? 'Áp dụng toàn bộ'
      : `Chọn cho Đêm ${selectedNight}`;

  return (
    <AppModalPortal
      open={open}
      onClose={() => {
        if (!updateLodgingMutation.isPending) onClose();
      }}
      ariaLabelledBy="lodging-picker-title"
      maxWidthClass="max-w-xl"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200/80 bg-[#F8FAFC] flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0194F3]">
            Chỗ lưu trú &amp; Điểm neo lộ trình
          </span>
          <h2
            id="lodging-picker-title"
            className="text-base font-black text-[#10243A] tracking-tight mt-0.5"
          >
            {targetMode === 'all'
              ? `Đổi khách sạn toàn chuyến (${clampedTotalNights} đêm)`
              : `Đổi khách sạn · Đêm ${selectedNight} (Ngày ${selectedNight}/${clampedTotalNights})`}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={updateLodgingMutation.isPending}
          aria-label="Đóng hộp thoại chọn chỗ ở"
          className="size-8 rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-[#10243A] flex items-center justify-center transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-[#10243A]">
        {/* Option 1: Per-Day / Per-Night Selector Bar + Apply-All Button */}
        {clampedTotalNights > 1 && (
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Chọn đêm lưu trú hoặc áp dụng toàn bộ
              </span>
              <button
                type="button"
                onClick={handleChooseApplyAllMode}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  targetMode === 'all'
                    ? 'bg-[#0194F3] text-white shadow-[0_2px_8px_rgba(1,148,243,0.25)]'
                    : 'bg-white text-[#0194F3] border border-[#D0E7FF] hover:border-[#0194F3]'
                }`}
              >
                <i
                  className="fa-solid fa-layer-group text-[11px]"
                  aria-hidden="true"
                />
                <span>Áp dụng toàn bộ (Đêm 1–{clampedTotalNights})</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {nightList.map((nightNum) => {
                const isNightSelected =
                  targetMode === nightNum ||
                  (targetMode === 'all' && selectedNight === nightNum);
                const isExplicitSingleNight = targetMode === nightNum;
                const assigned = lodgingByNight.get(nightNum);

                return (
                  <button
                    key={nightNum}
                    type="button"
                    onClick={() => handleChooseNightButton(nightNum)}
                    className={`px-3 py-2 rounded-xl text-left transition-all cursor-pointer border ${
                      isExplicitSingleNight
                        ? 'bg-[#E8F4FD] border-[#0194F3] ring-2 ring-[#0194F3]/15'
                        : isNightSelected
                          ? 'bg-white border-[#0194F3]/60'
                          : 'bg-white border-[#E2E8F0] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-extrabold ${
                          isExplicitSingleNight
                            ? 'text-[#0194F3]'
                            : 'text-[#10243A]'
                        }`}
                      >
                        Đêm {nightNum} · Ngày {nightNum}
                      </span>
                      {isExplicitSingleNight && (
                        <i
                          className="fa-solid fa-circle-check text-[11px] text-[#0194F3]"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {assigned ? assigned.name : 'Chưa chọn chỗ ở'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Free search input for pre-booked hotel */}
        <div className="relative">
          <i
            className="fa-solid fa-magnifying-glass text-xs text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm khách sạn/homestay bạn đã đặt trước..."
            className="w-full h-10 pl-9 pr-8 rounded-xl border border-[#CBD5E1] bg-white text-xs font-medium text-[#10243A] placeholder:text-slate-400 focus:outline-none focus:border-[#0194F3] focus:ring-2 focus:ring-[#0194F3]/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
            </button>
          )}
        </div>

        {isSearchMode ? (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-600">
              Kết quả tìm kiếm cho &ldquo;{searchQuery.trim()}&rdquo;
            </div>
            {isSearching ? (
              <div className="space-y-2">
                {[1, 2, 3].map((k) => (
                  <div
                    key={k}
                    className="h-20 rounded-2xl bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-xs text-slate-600">
                Không tìm thấy chỗ lưu trú phù hợp với từ khóa này.
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((place) => {
                  const isBusy = selectingId === place.id;
                  return (
                    <div
                      key={place.id}
                      className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 flex items-center justify-between gap-3 hover:border-[#0194F3]/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-sm font-bold text-[#10243A] truncate">
                          {place.name}
                        </div>
                        {place.address && (
                          <div className="text-xs text-slate-600 truncate">
                            {place.address}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={updateLodgingMutation.isPending}
                        onClick={() => handleSelectPlace(place)}
                        className="px-3.5 py-2 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] disabled:opacity-50 text-white text-xs font-bold shrink-0 cursor-pointer transition-colors"
                      >
                        {isBusy ? 'Đang lưu...' : actionButtonLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 3 Curated Group Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
              {GROUP_TABS.map((tab) => {
                const isSelected = activeGroup === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveGroup(tab.key)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-white text-[#0194F3] shadow-2xs border border-[#D0E7FF]'
                        : 'text-slate-600 hover:text-[#10243A]'
                    }`}
                  >
                    <i className={`${tab.icon} text-[11px]`} aria-hidden="true" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-slate-600">
              {GROUP_TABS.find((t) => t.key === activeGroup)?.desc} (tính từ tâm điểm dừng Ngày {selectedNight})
            </p>

            {/* 4-State Resilience: Loading, Error, Empty, Data */}
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-22 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
                  />
                ))}
              </div>
            ) : isError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-center space-y-2">
                <p className="text-xs font-semibold text-rose-800">
                  Không thể tải danh sách gợi ý chỗ lưu trú.
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-rose-300 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            ) : activeItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-xs text-slate-600">
                Chưa có gợi ý lưu trú khác trong khu vực này. Bạn có thể dùng ô tìm kiếm phía trên.
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeItems.map((item) => {
                  const isBusy = selectingId === item.placeId;
                  return (
                    <div
                      key={item.placeId}
                      className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 flex items-center justify-between gap-3 hover:border-[#0194F3]/50 transition-all shadow-2xs"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="size-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200/70">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <i
                              className="fa-solid fa-hotel text-slate-400 text-base"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-sm font-bold text-[#10243A] truncate">
                            {item.name}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {item.ratingAvg != null && item.ratingAvg > 0 && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700 tabular-nums">
                                <i
                                  className="fa-solid fa-star text-[10px] text-amber-500"
                                  aria-hidden="true"
                                />
                                <span>{item.ratingAvg.toFixed(1)}</span>
                                {item.reviewCount != null && item.reviewCount > 0 && (
                                  <span className="text-slate-500 font-normal">
                                    ({item.reviewCount})
                                  </span>
                                )}
                              </span>
                            )}
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-semibold text-[#0194F3] tabular-nums">
                              Cách tâm ngày {selectedNight} ~{item.distanceKm} km
                            </span>
                            {item.pricePerNight != null && item.pricePerNight > 0 && (
                              <>
                                <span className="text-slate-300" aria-hidden="true">
                                  ·
                                </span>
                                <span className="font-semibold text-slate-700 tabular-nums">
                                  ~{formatVnd(item.pricePerNight)}/đêm
                                </span>
                              </>
                            )}
                          </div>

                          {item.address && (
                            <div className="text-[11px] text-slate-500 truncate">
                              {item.address}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={updateLodgingMutation.isPending}
                        onClick={() => handleSelectPlace(item)}
                        className="px-3.5 py-2 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] disabled:opacity-50 text-white text-xs font-bold shrink-0 cursor-pointer transition-colors shadow-[0_2px_8px_rgba(1,148,243,0.25)]"
                      >
                        {isBusy ? 'Đang lưu...' : actionButtonLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppModalPortal>
  );
}

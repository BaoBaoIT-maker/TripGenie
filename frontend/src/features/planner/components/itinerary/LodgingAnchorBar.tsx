'use client';

import { memo } from 'react';
import { formatVnd } from '../../model/itinerary-format';
import type { ItineraryDayLodging } from '@/types/itinerary';

interface LodgingAnchorBarProps {
  dayNumber: number;
  lodging?: ItineraryDayLodging | null;
  canEdit?: boolean;
  isSelected?: boolean;
  onSelectLodging?: (placeId: string) => void;
  onHoverLodging?: (placeId: string | null) => void;
  onOpenPicker?: (nightNumber: number) => void;
}

export const LodgingAnchorBar = memo(function LodgingAnchorBar({
  dayNumber,
  lodging,
  canEdit = false,
  isSelected = false,
  onSelectLodging,
  onHoverLodging,
  onOpenPicker,
}: LodgingAnchorBarProps) {
  if (!lodging) return null;

  const badgeLabel = lodging.isCheckOutDay
    ? `Xuất phát & trả phòng sáng Ngày ${dayNumber}`
    : lodging.isAutoSuggested
      ? `Gợi ý chỗ ở · Đêm ${lodging.nightNumber}`
      : `Chỗ ở đã chọn · Đêm ${lodging.nightNumber}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectLodging?.(lodging.placeId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectLodging?.(lodging.placeId);
        }
      }}
      onMouseEnter={() => onHoverLodging?.(lodging.placeId)}
      onMouseLeave={() => onHoverLodging?.(null)}
      className={`rounded-2xl border px-3.5 py-2.5 transition-all cursor-pointer flex flex-wrap items-center justify-between gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0194F3] ${
        isSelected
          ? 'bg-[#E8F4FD] border-[#0194F3] ring-2 ring-[#0194F3]/15'
          : 'bg-[#F0F7FF]/90 border-[#D0E7FF] hover:border-[#0194F3]/50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="size-9 rounded-xl bg-white border border-[#D0E7FF] text-[#0194F3] flex items-center justify-center shrink-0 shadow-2xs">
          <i className="fa-solid fa-hotel text-sm" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-bold uppercase tracking-wider text-[#0194F3]">
              {badgeLabel}
            </span>
            {lodging.ratingAvg != null && lodging.ratingAvg > 0 && (
              <>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 tabular-nums">
                  <i
                    className="fa-solid fa-star text-[10px] text-amber-500"
                    aria-hidden="true"
                  />
                  <span>{lodging.ratingAvg.toFixed(1)}</span>
                </span>
              </>
            )}
            {lodging.pricePerNight != null && lodging.pricePerNight > 0 && (
              <>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-semibold text-slate-700 tabular-nums">
                  ~{formatVnd(lodging.pricePerNight)}/đêm
                </span>
              </>
            )}
            {lodging.distanceToFirstStopKm != null && (
              <>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-slate-600 tabular-nums">
                  <i
                    className="fa-solid fa-route text-[10px] text-[#0194F3]"
                    aria-hidden="true"
                  />
                  <span>
                    Cách điểm đầu ~{lodging.distanceToFirstStopKm} km
                  </span>
                </span>
              </>
            )}
          </div>

          <div className="text-sm font-bold text-[#10243A] truncate mt-0.5">
            {lodging.name}
          </div>
        </div>
      </div>

      {canEdit && onOpenPicker && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPicker(lodging.nightNumber);
          }}
          className="px-3 py-1.5 min-h-[34px] rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#D0E7FF] hover:border-[#0194F3] text-xs font-bold text-[#0194F3] transition-colors inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
        >
          <i className="fa-solid fa-arrows-rotate text-[11px]" aria-hidden="true" />
          <span>Đổi chỗ ở</span>
        </button>
      )}
    </div>
  );
});

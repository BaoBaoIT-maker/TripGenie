'use client';

import { memo, useState } from 'react';
import { useI18n } from '@/i18n';
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
  const { t } = useI18n();
  const [imageError, setImageError] = useState(false);

  if (!lodging) return null;

  const statusLabel = lodging.isCheckOutDay
    ? t('planner.lodging.checkoutLabel', { day: dayNumber })
    : lodging.isAutoSuggested
      ? t('planner.lodging.autoSuggested')
      : t('planner.lodging.selected');

  const hasValidImage = Boolean(lodging.imageUrl && !imageError);

  return (
    <article
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
      className={`group bg-white rounded-2xl border p-3.5 sm:p-4 transition-all cursor-pointer space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0194F3] ${
        isSelected
          ? 'border-[#0194F3] ring-2 ring-[#0194F3]/15 shadow-sm bg-[#F5F9FF]/40'
          : 'border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      {/* Top Row: Thumbnail (72px/84px) + Metadata & Hotel Info */}
      <div className="flex items-start gap-3 sm:gap-3.5">
        {/* Photo Thumbnail with Night Badge */}
        <div className="relative size-[72px] sm:size-[84px] rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center border border-slate-200/60">
          {hasValidImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lodging.imageUrl!}
              alt={lodging.name}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#F0F7FF] text-[#0194F3]">
              <i className="fa-solid fa-hotel text-xl" aria-hidden="true" />
            </div>
          )}
          <span className="absolute top-1.5 left-1.5 px-1.5 h-5 rounded-md text-white text-[10px] font-bold flex items-center justify-center shadow-xs bg-[#0194F3] tracking-tight">
            {t('planner.common.nightLabel', { n: lodging.nightNumber })}
          </span>
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Status Badge + Estimated Price per Night */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="px-2 py-0.5 rounded-md bg-[#F0F7FF] text-[#0194F3] text-[10px] font-bold uppercase tracking-wider shrink-0 border border-[#D0E7FF]/60">
                {statusLabel}
              </span>
            </div>

            {lodging.pricePerNight != null && lodging.pricePerNight > 0 && (
              <span className="shrink-0 tabular-nums font-semibold text-slate-800 text-xs sm:text-[13px]">
                ~{formatVnd(lodging.pricePerNight)}
                <span className="text-slate-500 font-normal text-[11px]">
                  {t('planner.common.perNight')}
                </span>
              </span>
            )}
          </div>

          {/* Hotel Name */}
          <h3 className="text-[14.5px] sm:text-[15px] font-bold text-slate-900 leading-snug group-hover:text-[#0194F3] transition-colors break-words">
            {lodging.name}
          </h3>

          {/* Rating, Distance to Stop 1, and Address */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            {lodging.ratingAvg != null && lodging.ratingAvg > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700 tabular-nums">
                <i className="fa-solid fa-star text-[10px] text-amber-500" aria-hidden="true" />
                <span>{lodging.ratingAvg.toFixed(1)}</span>
                {lodging.reviewCount != null && lodging.reviewCount > 0 && (
                  <span className="text-slate-400 font-normal text-[11px]">
                    ({lodging.reviewCount})
                  </span>
                )}
              </span>
            )}

            {lodging.distanceToFirstStopKm != null && (
              <>
                <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                  •
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-slate-600 tabular-nums">
                  <i className="fa-solid fa-route text-[10px] text-[#0194F3]" aria-hidden="true" />
                  <span>
                    {t('planner.lodging.distanceFirstStop', { km: lodging.distanceToFirstStopKm })}
                  </span>
                </span>
              </>
            )}

            {lodging.address && (
              <>
                <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                  •
                </span>
                <span className="text-slate-500 truncate max-w-xs">{lodging.address}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer: Đổi chỗ ở */}
      {canEdit && onOpenPicker && (
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-normal truncate hidden sm:inline">
            <i className="fa-solid fa-anchor text-[#0194F3] mr-1" aria-hidden="true" />
            {t('planner.lodging.anchorHint')}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPicker(lodging.nightNumber);
            }}
            className="h-8 px-3 rounded-lg border border-[#D0E7FF] bg-[#F5F9FF] hover:bg-[#F0F7FF] hover:border-[#0194F3] text-xs font-bold text-[#0194F3] transition-colors inline-flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer ml-auto"
          >
            <i className="fa-solid fa-arrows-rotate text-[11px]" aria-hidden="true" />
            <span>{t('planner.lodging.changeLodging')}</span>
          </button>
        </div>
      )}
    </article>
  );
});

'use client';

import { useEffect, useRef } from 'react';
import { useI18n } from '@/i18n';

export interface MobileItineraryStop {
  placeId: string;
  placeName: string;
  categoryLabel?: string;
  address?: string;
  imageUrl?: string | null;
  rating?: number | null;
  stopNumber?: string;
  stopColor?: string;
  timeSlot?: string;
  dayNumber?: number;
}

export interface MobileItineraryMapCarouselProps {
  stops: MobileItineraryStop[];
  selectedPlaceId: string | null;
  onSelectStop: (placeId: string) => void;
  onJumpToTimeline: (placeId: string) => void;
  onNavigateDetail?: (placeId: string) => void;
}

/**
 * Mobile map stop preview carousel for travel itineraries.
 * Provides touch-friendly, bottom-anchored stop cards matching Explore page standards.
 * Suppresses heavy DOM popup balloons and enables thumb-zone navigation.
 */
export function MobileItineraryMapCarousel({
  stops,
  selectedPlaceId,
  onSelectStop,
  onJumpToTimeline,
  onNavigateDetail,
}: MobileItineraryMapCarouselProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll selected card to center of carousel when selectedPlaceId changes
  useEffect(() => {
    if (!selectedPlaceId) return;
    const cardEl = document.getElementById(`mobile-itinerary-stop-${selectedPlaceId}`);
    if (cardEl) {
      isProgrammaticScrollRef.current = true;
      cardEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      const timer = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [selectedPlaceId]);

  // Synchronize map marker when user swipes through cards in carousel
  const handleScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      const containerCenter = container.getBoundingClientRect().left + container.clientWidth / 2;
      let closestStop: MobileItineraryStop | null = null;
      let minDistance = Infinity;

      for (const stop of stops) {
        const el = document.getElementById(`mobile-itinerary-stop-${stop.placeId}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const cardCenter = rect.left + rect.width / 2;
          const dist = Math.abs(cardCenter - containerCenter);
          if (dist < minDistance) {
            minDistance = dist;
            closestStop = stop;
          }
        }
      }

      if (closestStop && closestStop.placeId !== selectedPlaceId) {
        onSelectStop(closestStop.placeId);
      }
    }, 120);
  };

  if (!stops || stops.length === 0) return null;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory px-4 py-2 scrollbar-none pointer-events-auto"
      role="region"
      aria-label={t('planner.mobileCarousel.regionAria')}
    >
      {stops.map((stop) => {
        const isSelected = stop.placeId === selectedPlaceId;
        return (
          <div
            key={stop.placeId}
            id={`mobile-itinerary-stop-${stop.placeId}`}
            onClick={() => {
              if (!isSelected) {
                onSelectStop(stop.placeId);
              }
            }}
            className={`w-[290px] sm:w-[320px] shrink-0 snap-center rounded-2xl p-2.5 transition-all duration-200 cursor-pointer flex gap-3 items-center select-none ${
              isSelected
                ? 'bg-white shadow-xl border-2 border-[#0194F3] ring-2 ring-[#0194F3]/20 scale-[1.02]'
                : 'bg-white/95 backdrop-blur-md shadow-md border border-slate-200/90 hover:border-slate-300 opacity-95 hover:opacity-100'
            }`}
          >
            {/* Thumbnail + Stop Number Badge */}
            <div className="relative size-18 rounded-xl overflow-hidden bg-slate-100 shrink-0">
              {stop.imageUrl ? (
                <img
                  src={stop.imageUrl}
                  alt={stop.placeName}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="size-full flex items-center justify-center text-slate-400">
                  <i className="fa-solid fa-location-dot text-[#0194F3] text-lg" aria-hidden="true" />
                </div>
              )}
              {stop.stopNumber && (
                <span
                  className="absolute top-1 left-1 min-w-[20px] h-5 px-1 rounded-md text-white font-bold text-[10px] flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: stop.stopColor || '#0194F3' }}
                >
                  {stop.stopNumber}
                </span>
              )}
            </div>

            {/* Information */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-[#0194F3] uppercase tracking-wider truncate">
                  {stop.categoryLabel || t('planner.common.destinationFallback')}
                </span>
                {typeof stop.rating === 'number' && stop.rating > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0">
                    <i className="fa-solid fa-star text-amber-500 text-[10px]" aria-hidden="true" />
                    <span>{stop.rating.toFixed(1)}</span>
                  </span>
                )}
              </div>

              <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">
                {stop.placeName}
              </h4>

              {stop.timeSlot ? (
                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                  <i className="fa-regular fa-clock text-[10px] text-slate-400 shrink-0" aria-hidden="true" />
                  <span>{stop.timeSlot}</span>
                </p>
              ) : stop.address ? (
                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                  <i className="fa-solid fa-location-dot text-[10px] text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{stop.address}</span>
                </p>
              ) : null}

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJumpToTimeline(stop.placeId);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-[#0194F3] text-[10px] font-bold border border-sky-200 transition-colors cursor-pointer"
                  title={t('planner.mobileCarousel.viewTimelineTitle')}
                >
                  <i className="fa-solid fa-list text-[9px]" aria-hidden="true" />
                  <span>{t('planner.mobileCarousel.timelineBtn')}</span>
                </button>
                {onNavigateDetail && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateDetail(stop.placeId);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200 transition-colors cursor-pointer"
                    title={t('planner.mobileCarousel.viewDetailTitle')}
                  >
                    <span>{t('planner.mobileCarousel.detailBtn')}</span>
                    <i className="fa-solid fa-chevron-right text-[8px]" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MobileItineraryMapCarousel;

'use client';

import { memo, useEffect, useState } from 'react';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { useItineraryHoverStore } from '../../stores/itinerary-hover-store';
import { WEATHER_THEMES, getDayWeatherAdvice } from '../../constants/climate.constants';
import {
  TRANSIT_UI_CONFIG,
  cleanHubName,
  formatDuration,
  formatVnd,
  isDiningActivity,
} from '../../model/itinerary-format';
import { getDayColor } from '@/features/map/types';
import TransitRouteBreakdown from './TransitRouteBreakdown';
import { WeatherIcon } from './WeatherIcon';
import type {
  DayWeather,
  IntercityTransit,
  ItineraryActivity,
  ItineraryDay,
  MoveDirection,
  TransitMode,
  TripWeatherResponse,
  WeatherCondition,
} from '@/types/itinerary';

const WEATHER_ICON_COLOR: Record<WeatherCondition, string> = {
  SUNNY: 'text-amber-500',
  MILD: 'text-[#0194F3]',
  RAINY: 'text-sky-600',
  COLD: 'text-indigo-500',
};

interface Props {
  days: ItineraryDay[];
  transit?: IntercityTransit | null;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  selectedPlaceId?: string | null;
  onSelectPlace?: (placeId: string) => void;
  onHoverPlace?: (placeId: string | null) => void;
  onSwapPlace?: (placeId: string, activity?: ItineraryActivity) => void;
  onDeletePlace?: (placeId: string, activity?: ItineraryActivity) => void;
  onAddPlace?: (dayNumber: number) => void;
  onChangeTransitMode?: (newMode: TransitMode) => Promise<void> | void;
  isUpdatingTransitMode?: boolean;
  // Enhanced workspace v2 props (optional for standalone consumers/tests)
  weatherData?: TripWeatherResponse | null;
  isCollapsibleDays?: boolean;
  isMemberOrOwner?: boolean;
  onEditStop?: (activity: ItineraryActivity) => void;
  onMoveStop?: (destinationId: string, direction: MoveDirection) => Promise<void> | void;
  movingStopId?: string | null;
  onProposeSwap?: (placeId: string, activity?: ItineraryActivity) => void;
  onProposeNewForDay?: (dayNumber: number) => void;
  pendingProposalCountByStop?: Record<string, number>;
  onOpenVotingTab?: () => void;
}

const TRANSIT_MODE_OPTIONS: ReadonlyArray<{
  mode: TransitMode;
  title: string;
  desc: string;
  iconClass: string;
}> = [
  {
    mode: 'FLIGHT',
    title: 'Máy bay',
    desc: 'Nhanh nhất cho cự ly xa, đặt qua Google Flights & Traveloka',
    iconClass: 'fa-solid fa-plane',
  },
  {
    mode: 'TRAIN',
    title: 'Tàu hỏa (Đường sắt)',
    desc: 'Trải nghiệm ngắm cảnh, an toàn, đặt qua ĐSVN & VeXeRe',
    iconClass: 'fa-solid fa-train',
  },
  {
    mode: 'SLEEPER_BUS',
    title: 'Xe khách giường nằm',
    desc: 'Tiết kiệm chi phí, chạy ban đêm, đặt qua VeXeRe & Traveloka',
    iconClass: 'fa-solid fa-bus',
  },
  {
    mode: 'PERSONAL_CAR',
    title: 'Ô tô cá nhân / Thuê xe',
    desc: 'Chủ động hành trình, phù hợp đi cùng gia đình, nhóm bạn',
    iconClass: 'fa-solid fa-car',
  },
  {
    mode: 'PERSONAL_MOTORBIKE',
    title: 'Xe máy phượt',
    desc: 'Tự do trải nghiệm cung đường đèo ven biển, tiết kiệm tối đa',
    iconClass: 'fa-solid fa-motorcycle',
  },
];

function getTransitVisualMeta(transit: IntercityTransit) {
  switch (transit.mode) {
    case 'FLIGHT':
      return {
        iconClass: 'fa-solid fa-plane',
        label: 'Máy bay',
        summary: `~${formatDuration(
          Math.max(
            TRANSIT_UI_CONFIG.FLIGHT_MIN_DURATION_MINUTES,
            transit.durationMinutes || TRANSIT_UI_CONFIG.FLIGHT_DEFAULT_DURATION_MINUTES,
          ),
        )}`,
      };
    case 'TRAIN':
      return {
        iconClass: 'fa-solid fa-train',
        label: 'Tàu hỏa',
        summary: `~${Math.round(transit.distanceKm)} km · ~${Math.max(1, Math.round(transit.durationMinutes / 60))} giờ`,
      };
    case 'SLEEPER_BUS':
      return {
        iconClass: 'fa-solid fa-bus',
        label: 'Xe khách',
        summary: `~${Math.round(transit.distanceKm)} km · ~${Math.max(1, Math.round(transit.durationMinutes / 60))} giờ`,
      };
    case 'PERSONAL_CAR':
      return {
        iconClass: 'fa-solid fa-car',
        label: 'Ô tô',
        summary: `~${Math.round(transit.distanceKm)} km`,
      };
    case 'PERSONAL_MOTORBIKE':
      return {
        iconClass: 'fa-solid fa-motorcycle',
        label: 'Xe máy',
        summary: `~${Math.round(transit.distanceKm)} km`,
      };
    default:
      return {
        iconClass: 'fa-solid fa-route',
        label: 'Di chuyển liên tỉnh',
        summary: `~${Math.round(transit.distanceKm)} km`,
      };
  }
}

function numberStops(days: ItineraryDay[]) {
  let n = 0;
  return days.map((d) => ({
    ...d,
    activities: d.activities.map((a) => ({ ...a, stopNumber: ++n })),
  }));
}

function formatDayFullDate(isoString: string | null | undefined, dayIndex: number): string {
  if (!isoString) return `Ngày ${dayIndex + 1}`;
  try {
    const d = new Date(isoString);
    d.setDate(d.getDate() + dayIndex);
    return `${d.getDate()} Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  } catch {
    return `Ngày ${dayIndex + 1}`;
  }
}

function formatStopCostText(act: ItineraryActivity): {
  desktopPrefix?: string;
  main: string;
  desktopSuffix?: string;
  title?: string;
} | null {
  const isFree =
    act.estimatedCost === 0 ||
    (act.priceRange?.min === 0 && (act.priceRange?.max === 0 || act.priceRange?.max == null));

  if (isFree) {
    return {
      main: 'Miễn phí',
      desktopSuffix: ' vé',
      title: 'Địa điểm tham quan mở cửa tự do, không thu phí vé vào cổng',
    };
  }

  const isDining = isDiningActivity(act.categoryName, act.placeName);
  if (isDining) {
    const hasCost = act.estimatedCost != null && act.estimatedCost > 0;
    const rangeTooltip =
      act.priceRange?.min != null && act.priceRange?.max != null && act.priceRange.max > 0
        ? `Giá tham khảo: ${formatVnd(act.priceRange.min)} – ${formatVnd(act.priceRange.max)}`
        : 'Chi phí ước tính một suất ăn';
    return hasCost
      ? {
          main: `~${formatVnd(act.estimatedCost!)}`,
          desktopSuffix: '/người',
          title: rangeTooltip,
        }
      : { main: 'Theo thực đơn', title: rangeTooltip };
  }

  if (act.estimatedCost != null && act.estimatedCost > 0) {
    const rangeTooltip =
      act.priceRange?.min != null && act.priceRange?.max != null && act.priceRange.max > act.priceRange.min
        ? `Giá vé niêm yết: ${formatVnd(act.priceRange.min)} – ${formatVnd(act.priceRange.max)}`
        : 'Giá vé tham quan tiêu chuẩn';
    return { desktopPrefix: 'Vé ', main: `~${formatVnd(act.estimatedCost)}`, title: rangeTooltip };
  }

  return null;
}

function renderIntracityTransitConnector(act: ItineraryActivity) {
  if (act.distanceToNextKm != null && act.distanceToNextKm > 0) {
    const km = act.distanceToNextKm;
    const IC = TRANSIT_UI_CONFIG.INTRACITY;
    const mode = act.travelModeToNext ?? (km <= IC.WALK_THRESHOLD_KM ? 'WALK' : 'BIKE');
    const minutes =
      act.durationToNextMinutes ??
      (mode === 'WALK'
        ? Math.max(IC.MIN_WALK_MINUTES, Math.round((km / IC.WALK_SPEED_KMH) * 60))
        : Math.max(
            IC.MIN_BIKE_MINUTES,
            Math.round(((km * IC.ROAD_DETOUR_FACTOR) / IC.BIKE_SPEED_KMH) * 60) + IC.BIKE_BUFFER_MINUTES,
          ));
    const durationText = formatDuration(minutes);

    if (mode === 'WALK') {
      return (
        <span className="text-[11px] text-slate-600 font-medium inline-flex items-center gap-1.5 tabular-nums">
          <i className="fa-solid fa-person-walking text-emerald-600 text-xs" aria-hidden="true" />
          <span>~{durationText} đi bộ ({km} km)</span>
        </span>
      );
    }

    if (mode === 'CAR') {
      return (
        <span className="text-[11px] text-slate-600 font-medium inline-flex items-center gap-1.5 tabular-nums">
          <i className="fa-solid fa-car text-[#0194F3] text-xs" aria-hidden="true" />
          <span>~{durationText} ô tô / taxi ({km} km)</span>
        </span>
      );
    }

    return (
      <span className="text-[11px] text-slate-600 font-medium inline-flex items-center gap-1.5 tabular-nums">
        <i className="fa-solid fa-motorcycle text-slate-500 text-xs" aria-hidden="true" />
        <span>~{durationText} xe máy ({km} km)</span>
      </span>
    );
  }

  return (
    <span className="text-[11px] text-slate-400 font-medium inline-flex items-center gap-1.5">
      <i className="fa-solid fa-route text-[10px]" aria-hidden="true" />
      <span>Di chuyển đến điểm tiếp theo</span>
    </span>
  );
}

function renderTransitDeepLinks(transit: IntercityTransit) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {transit.mode === 'FLIGHT' && (
        <>
          {transit.deepLinks?.googleFlights && (
            <a
              href={transit.deepLinks.googleFlights}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-[#F0F7FF] px-3 py-1.5 text-xs font-semibold text-[#10243A] hover:text-[#0194F3] transition-colors"
            >
              <i className="fa-solid fa-ticket text-xs" aria-hidden="true" />
              <span>Google Flights</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-60" aria-hidden="true" />
            </a>
          )}
          {transit.deepLinks?.traveloka && (
            <a
              href={transit.deepLinks.traveloka}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0E7FF] bg-[#F5F9FF] hover:bg-[#F0F7FF] px-3 py-1.5 text-xs font-semibold text-[#0194F3] transition-colors"
            >
              <i className="fa-solid fa-plane text-xs" aria-hidden="true" />
              <span>Đặt vé Traveloka</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-60" aria-hidden="true" />
            </a>
          )}
        </>
      )}

      {transit.mode === 'TRAIN' && (
        <>
          {transit.deepLinks?.vexereTrain && (
            <a
              href={transit.deepLinks.vexereTrain}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0E7FF] bg-[#F5F9FF] hover:bg-[#F0F7FF] px-3 py-1.5 text-xs font-semibold text-[#0194F3] transition-colors"
            >
              <i className="fa-solid fa-ticket text-xs" aria-hidden="true" />
              <span>Vé tàu VeXeRe</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-60" aria-hidden="true" />
            </a>
          )}
          {transit.deepLinks?.dsvn && (
            <a
              href={transit.deepLinks.dsvn}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-[#F0F7FF] px-3 py-1.5 text-xs font-semibold text-[#10243A] transition-colors"
            >
              <i className="fa-solid fa-train text-xs" aria-hidden="true" />
              <span>Cổng ĐSVN</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-60" aria-hidden="true" />
            </a>
          )}
        </>
      )}

      {transit.mode === 'SLEEPER_BUS' && (
        <>
          {transit.deepLinks?.vexere && (
            <a
              href={transit.deepLinks.vexere}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0E7FF] bg-[#F5F9FF] hover:bg-[#F0F7FF] px-3 py-1.5 text-xs font-semibold text-[#0194F3] transition-colors"
            >
              <i className="fa-solid fa-bus text-xs" aria-hidden="true" />
              <span>Vé xe VeXeRe</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-60" aria-hidden="true" />
            </a>
          )}
          {transit.deepLinks?.traveloka && (
            <a
              href={transit.deepLinks.traveloka}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-[#F0F7FF] px-3 py-1.5 text-xs font-semibold text-[#10243A] transition-colors"
            >
              <i className="fa-solid fa-bus text-xs" aria-hidden="true" />
              <span>Vé xe Traveloka</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-60" aria-hidden="true" />
            </a>
          )}
        </>
      )}

      {(transit.mode === 'PERSONAL_CAR' || transit.mode === 'PERSONAL_MOTORBIKE') &&
        transit.deepLinks?.googleMaps && (
          <a
            href={transit.deepLinks.googleMaps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-[#F0F7FF] px-3 py-1.5 text-xs font-semibold text-[#10243A] transition-colors"
          >
            <i className="fa-solid fa-map-location-dot text-xs text-[#0194F3]" aria-hidden="true" />
            <span>Xem lộ trình Google Maps</span>
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-60" aria-hidden="true" />
          </a>
        )}
    </div>
  );
}

const ItineraryTimeline = memo(function ItineraryTimeline({
  days,
  transit,
  destination,
  startDate,
  selectedPlaceId,
  onSelectPlace,
  onHoverPlace,
  onSwapPlace,
  onDeletePlace,
  onAddPlace,
  onChangeTransitMode,
  isUpdatingTransitMode,
  weatherData,
  isCollapsibleDays = false,
  isMemberOrOwner = false,
  onEditStop,
  onMoveStop,
  movingStopId = null,
  onProposeSwap,
  onProposeNewForDay,
  pendingProposalCountByStop,
  onOpenVotingTab,
}: Props) {
  const numbered = numberStops(days);
  const setStoreHoveredPlaceId = useItineraryHoverStore((s) => s.setHoveredPlaceId);
  const handleHoverPlace = onHoverPlace ?? setStoreHoveredPlaceId;

  const [isTransitDetailsOpen, setIsTransitDetailsOpen] = useState(false);
  const [isEditTransitOpen, setIsEditTransitOpen] = useState(false);
  const [selectedTransitMode, setSelectedTransitMode] = useState<TransitMode>(transit?.mode || 'FLIGHT');
  const [expandedWeatherGuidanceDay, setExpandedWeatherGuidanceDay] = useState<number | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});
  const [openStopMenuKey, setOpenStopMenuKey] = useState<string | null>(null);

  useEffect(() => {
    if (!openStopMenuKey) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-stop-menu-root]')) return;
      setOpenStopMenuKey(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenStopMenuKey(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openStopMenuKey]);

  const targetCityName = destination || transit?.destName || '';
  const transitVisual = transit ? getTransitVisualMeta(transit) : null;
  const isLongMotorbikeWarning =
    transit?.mode === 'PERSONAL_MOTORBIKE' &&
    transit.distanceKm > TRANSIT_UI_CONFIG.MOTORBIKE_SAFETY_LIMIT_KM;

  const weatherByDay = new Map<number, DayWeather>();
  if (weatherData?.days) {
    for (const dw of weatherData.days) {
      weatherByDay.set(dw.dayNumber, dw);
    }
  }

  const handleConfirmChangeTransit = async () => {
    if (!onChangeTransitMode || !selectedTransitMode || selectedTransitMode === transit?.mode) {
      setIsEditTransitOpen(false);
      return;
    }
    await onChangeTransitMode(selectedTransitMode);
    setIsEditTransitOpen(false);
  };

  const toggleDayCollapsed = (dayNumber: number) => {
    setCollapsedDays((prev) => ({ ...prev, [dayNumber]: !prev[dayNumber] }));
  };

  return (
    <div className="space-y-5">
      {/* Compact Intercity Transit Strip */}
      {transit && transitVisual && (
        <section
          aria-label="Thông tin di chuyển liên tỉnh"
          className={`rounded-2xl border bg-white overflow-hidden transition-colors ${
            isLongMotorbikeWarning ? 'border-amber-300' : 'border-slate-200'
          }`}
        >
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="size-8 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center shrink-0">
                <i className={`${transitVisual.iconClass} text-xs`} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-[#10243A]">
                  <span>{transitVisual.label}:</span>
                  <span className="truncate">
                    {cleanHubName(transit.originHub?.name || transit.originName)} →{' '}
                    {cleanHubName(transit.destHub?.name || transit.destName)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {transitVisual.summary}
                  {' · '}
                  Khứ hồi ~{formatVnd(transit.estimatedPriceRoundTrip)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-expanded={isTransitDetailsOpen}
                onClick={() => setIsTransitDetailsOpen((v) => !v)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{isTransitDetailsOpen ? 'Thu gọn' : 'Chi tiết chặng'}</span>
                <i
                  className={`fa-solid fa-chevron-down text-[9px] transition-transform ${
                    isTransitDetailsOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {onChangeTransitMode && (
                <button
                  type="button"
                  disabled={isUpdatingTransitMode}
                  onClick={() => {
                    setSelectedTransitMode(transit.mode);
                    setIsEditTransitOpen(true);
                  }}
                  className="h-8 px-2.5 rounded-lg border border-[#D0E7FF] bg-[#F5F9FF] hover:bg-[#F0F7FF] text-[11px] font-bold text-[#0194F3] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingTransitMode ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-[10px]" aria-hidden="true" />
                  ) : (
                    <i className="fa-solid fa-right-left text-[10px]" aria-hidden="true" />
                  )}
                  <span>Sửa phương tiện</span>
                </button>
              )}
            </div>
          </div>

          {isLongMotorbikeWarning && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-[11px] text-amber-800 font-medium flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-500 shrink-0" aria-hidden="true" />
              <span>
                Cự ly trên {TRANSIT_UI_CONFIG.MOTORBIKE_SAFETY_LIMIT_KM} km — cân nhắc máy bay, tàu hỏa hoặc xe khách để đảm bảo sức khỏe.
              </span>
            </div>
          )}

          {isTransitDetailsOpen && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-2 bg-slate-50/40">
              <TransitRouteBreakdown transit={transit} destCity={targetCityName} />
              {renderTransitDeepLinks(transit)}
            </div>
          )}
        </section>
      )}

      {/* Modal for Changing Transit Mode */}
      <AppModalPortal
        open={isEditTransitOpen}
        onClose={() => setIsEditTransitOpen(false)}
        ariaLabelledBy="edit-transit-mode-title"
        maxWidthClass="max-w-md"
        disableClose={Boolean(isUpdatingTransitMode)}
        mobileBottomSheet
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center">
                <i className="fa-solid fa-right-left text-xs" aria-hidden="true" />
              </div>
              <div>
                <h3 id="edit-transit-mode-title" className="text-sm font-bold text-[#10243A]">
                  Sửa phương tiện di chuyển
                </h3>
                <p className="text-[11px] text-slate-500">
                  Chọn phương tiện cho chặng hành trình liên tỉnh
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditTransitOpen(false)}
              aria-label="Đóng hộp thoại"
              className="size-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-2">
            {TRANSIT_MODE_OPTIONS.map((opt) => {
              const isSelected = selectedTransitMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setSelectedTransitMode(opt.mode)}
                  className={`w-full p-3 rounded-xl border text-left transition-colors flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? 'border-[#0194F3] bg-[#F5F9FF]'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="mt-0.5 size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#0194F3] shrink-0">
                    <i className={`${opt.iconClass} text-xs`} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#10243A]">{opt.title}</span>
                      {isSelected && (
                        <span className="size-4 rounded-full bg-[#0194F3] text-white flex items-center justify-center">
                          <i className="fa-solid fa-check text-[9px]" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditTransitOpen(false)}
              disabled={isUpdatingTransitMode}
              className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmChangeTransit}
              disabled={isUpdatingTransitMode || selectedTransitMode === transit?.mode}
              className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isUpdatingTransitMode ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
                  <span>Đang cập nhật...</span>
                </>
              ) : (
                <span>Xác nhận đổi</span>
              )}
            </button>
          </div>
        </div>
      </AppModalPortal>

      {/* Daily Itinerary Schedule */}
      {numbered.map((day, dIdx) => {
        const dayColor = getDayColor(day.dayNumber);
        const dayWeather = weatherByDay.get(day.dayNumber);
        const weatherTheme = dayWeather ? WEATHER_THEMES[dayWeather.condition] : null;
        const isWeatherGuidanceOpen = expandedWeatherGuidanceDay === day.dayNumber;
        const isCollapsed = isCollapsibleDays && Boolean(collapsedDays[day.dayNumber]);

        const isRainAlert = dayWeather?.condition === 'RAINY';

        return (
          <section key={day.dayNumber} aria-label={`Lịch trình Ngày ${day.dayNumber}`} className="space-y-3">
            {/* Day Header + Option A Weather Pill (Stacks vertically on mobile < 640px so long titles never squeeze) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-200/80 pt-1">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 sm:flex-1">
                {isCollapsibleDays ? (
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? 'Mở rộng' : 'Thu gọn'} Ngày ${day.dayNumber}`}
                    onClick={() => toggleDayCollapsed(day.dayNumber)}
                    className="size-11 -ml-2 sm:size-7 sm:ml-0 flex items-center justify-center shrink-0 cursor-pointer group/collapse"
                  >
                    <span
                      className="size-7 rounded-lg text-white text-xs font-bold flex items-center justify-center tabular-nums group-hover/collapse:opacity-90"
                      style={{ backgroundColor: dayColor }}
                    >
                      {day.dayNumber}
                    </span>
                  </button>
                ) : (
                  <span
                    className="size-7 rounded-lg text-white text-xs font-bold flex items-center justify-center tabular-nums shrink-0"
                    style={{ backgroundColor: dayColor }}
                  >
                    {day.dayNumber}
                  </span>
                )}

                <div className="min-w-0">
                  {isCollapsibleDays ? (
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleDayCollapsed(day.dayNumber)}
                      className="text-left inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-slate-900 hover:text-[#0194F3] leading-snug cursor-pointer transition-colors max-w-full tracking-tight"
                    >
                      <span className="break-words">
                        Ngày {day.dayNumber}
                        {day.theme && day.theme.trim().toLowerCase() !== `ngày ${day.dayNumber}`.toLowerCase()
                          ? `: ${day.theme}`
                          : ''}
                      </span>
                      <i
                        className={`fa-solid fa-chevron-down text-[10px] text-slate-400 shrink-0 transition-transform ${
                          isCollapsed ? '-rotate-90' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  ) : (
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words tracking-tight">
                      Ngày {day.dayNumber}
                      {day.theme && day.theme.trim().toLowerCase() !== `ngày ${day.dayNumber}`.toLowerCase()
                        ? `: ${day.theme}`
                        : ''}
                    </h2>
                  )}
                  <p className="text-xs text-slate-500 tabular-nums font-medium">
                    {formatDayFullDate(startDate, dIdx)} · {day.activities.length} điểm dừng
                  </p>
                </div>
              </div>

              {/* Option A Per-Day Weather Pill */}
              {dayWeather && weatherTheme && (
                <button
                  type="button"
                  aria-expanded={isWeatherGuidanceOpen}
                  onClick={() =>
                    setExpandedWeatherGuidanceDay((curr) =>
                      curr === day.dayNumber ? null : day.dayNumber,
                    )
                  }
                  className="self-start sm:self-auto max-w-full inline-flex items-center gap-1.5 px-2.5 min-h-[40px] sm:min-h-[32px] py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs text-slate-700 transition-colors cursor-pointer shrink-0 tabular-nums"
                  title="Nhấn để xem gợi ý thời tiết ngày này"
                >
                  <WeatherIcon
                    condition={dayWeather.condition}
                    weatherCode={dayWeather.weatherCode}
                    size={16}
                    className="w-4 h-4 object-contain shrink-0"
                  />
                  <span className="font-semibold text-slate-900">
                    {Math.round(dayWeather.tempMinC)}°–{Math.round(dayWeather.tempMaxC)}°C
                  </span>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className={isRainAlert ? 'text-sky-700 font-semibold' : 'text-slate-600'}>
                    {dayWeather.labelVi}
                  </span>
                  {dayWeather.source === 'SEASONAL_AVERAGE' && (
                    <span className="text-[11px] text-slate-500">(Theo mùa)</span>
                  )}
                  <i
                    className={`fa-solid ${
                      isWeatherGuidanceOpen ? 'fa-chevron-up' : 'fa-chevron-down'
                    } text-[10px] text-slate-400 ml-0.5`}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>

            {isWeatherGuidanceOpen && dayWeather && weatherTheme && (() => {
              const dayAdvice = getDayWeatherAdvice(dayWeather);
              return (
                <div
                  className={`rounded-2xl p-3.5 text-xs border space-y-2.5 transition-all ${
                    dayAdvice.isHighRain
                      ? 'bg-sky-50/70 border-sky-200/80 text-sky-950'
                      : dayAdvice.isHeatOrHighUv
                      ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                      : dayAdvice.isCold
                      ? 'bg-indigo-50/60 border-indigo-200/80 text-indigo-950'
                      : 'bg-slate-50/80 border-slate-200/90 text-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2">
                      <WeatherIcon
                        condition={dayWeather.condition}
                        weatherCode={dayWeather.weatherCode}
                        size={18}
                        className="w-4.5 h-4.5 object-contain shrink-0"
                      />
                      <span className="font-bold text-slate-900">
                        {dayWeather.labelVi}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-semibold text-slate-700">
                        {Math.round(dayWeather.tempMinC)}°–{Math.round(dayWeather.tempMaxC)}°C
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {dayWeather.precipitationProbabilityMax != null && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            dayAdvice.isHighRain
                              ? 'bg-sky-100/80 text-sky-800 border-sky-300/80'
                              : 'bg-white/90 text-slate-600 border-slate-200/80'
                          }`}
                        >
                          <i className="fa-solid fa-cloud-showers-heavy text-[10px]" aria-hidden="true" />
                          <span>Mưa {dayWeather.precipitationProbabilityMax}%</span>
                        </span>
                      )}

                      {dayWeather.uvIndexMax != null && dayWeather.uvIndexMax > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            dayAdvice.isHeatOrHighUv
                              ? 'bg-amber-100/80 text-amber-900 border-amber-300/80'
                              : 'bg-white/90 text-slate-600 border-slate-200/80'
                          }`}
                        >
                          <i className="fa-solid fa-sun text-[10px]" aria-hidden="true" />
                          <span>UV {dayWeather.uvIndexMax}</span>
                        </span>
                      )}

                      {dayWeather.source === 'SEASONAL_AVERAGE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/90 text-slate-500 border border-slate-200/80">
                          <i className="fa-regular fa-calendar text-[10px]" aria-hidden="true" />
                          <span>Khí hậu mùa</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-2 pt-1 border-t border-slate-200/50">
                    <i className="fa-regular fa-lightbulb text-amber-500 text-xs shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{dayAdvice.advice}</span>
                  </p>
                </div>
              );
            })()}

            {isCollapsed ? (
              <button
                type="button"
                onClick={() => toggleDayCollapsed(day.dayNumber)}
                className="w-full py-2.5 rounded-xl border border-slate-200/80 bg-white text-xs font-semibold text-slate-600 hover:text-[#0194F3] hover:border-[#0194F3]/30 transition-colors cursor-pointer"
              >
                Đang thu gọn {day.activities.length} điểm dừng · Bấm để mở lại
              </button>
            ) : (
              <>
                {day.activities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center space-y-2.5">
                    <div className="size-10 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                      <i className="fa-regular fa-calendar-plus text-base" aria-hidden="true" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Ngày {day.dayNumber} chưa có điểm dừng
                    </h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Chọn địa điểm tham quan hoặc quán ăn phù hợp cho ngày này.
                    </p>
                    {(Boolean(onAddPlace) || Boolean(isMemberOrOwner && onProposeNewForDay)) && (
                      <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                        {onAddPlace && (
                          <button
                            type="button"
                            onClick={() => onAddPlace(day.dayNumber)}
                            className="min-h-[40px] px-4 rounded-xl bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <i className="fa-solid fa-plus" aria-hidden="true" />
                            <span>Thêm địa điểm vào Ngày {day.dayNumber}</span>
                          </button>
                        )}
                        {!onAddPlace && isMemberOrOwner && onProposeNewForDay && (
                          <button
                            type="button"
                            onClick={() => onProposeNewForDay(day.dayNumber)}
                            className="min-h-[40px] px-4 rounded-xl bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <i className="fa-solid fa-check-to-slot" aria-hidden="true" />
                            <span>Đề xuất địa điểm cho Ngày {day.dayNumber}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {day.activities.map((act, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === day.activities.length - 1;
                      const isLastMultiStop = day.activities.length > 1 && isLast;
                      const imageUrl = act.thumbnailUrl || act.imageUrl || null;
                      const isSelected = act.placeId === selectedPlaceId;
                      const costInfo = formatStopCostText(act);
                      const stopVotesCount = act.id ? (pendingProposalCountByStop?.[act.id] ?? 0) : 0;
                      const isMoving = Boolean(act.id && movingStopId === act.id);
                      const stopKey = act.id || `${day.dayNumber}-${act.placeId}-${idx}`;
                      const menuOpen = openStopMenuKey === stopKey;

                      const canEditCard =
                        Boolean(onEditStop) ||
                        Boolean(onSwapPlace) ||
                        Boolean(onDeletePlace) ||
                        Boolean(onMoveStop && act.id);
                      const hasOverflowItems =
                        Boolean(onMoveStop && act.id) ||
                        Boolean(onDeletePlace) ||
                        Boolean(isMemberOrOwner && onProposeSwap);
                      const hasBottomActionBar =
                        canEditCard || Boolean(isMemberOrOwner && onProposeSwap);
                      const hasOpeningBadge = Boolean(
                        act.openingStatus &&
                          (act.openingStatus.label || act.openingStatus.state !== 'UNKNOWN'),
                      );

                      return (
                        <div key={stopKey}>
                          {/* Stop Card Matched to Demo v2.3 */}
                          <article
                            id={`itinerary-activity-${act.placeId}`}
                            onClick={() => onSelectPlace?.(act.placeId)}
                            onMouseEnter={() => handleHoverPlace(act.placeId)}
                            onMouseLeave={() => handleHoverPlace(null)}
                            className={`group bg-white rounded-2xl border p-3.5 sm:p-4 transition-colors cursor-pointer space-y-2.5 ${
                              isSelected
                                ? 'border-[#0194F3] ring-2 ring-[#0194F3]/15 shadow-sm'
                                : 'border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.03)] hover:border-slate-300'
                            }`}
                            style={
                              isSelected
                                ? { borderColor: dayColor, boxShadow: `0 0 0 2px ${dayColor}26` }
                                : undefined
                            }
                          >
                            {/* Top Row: Thumbnail (72px / 84px) + Time/Category/Cost + Title + Facts */}
                            <div className="flex items-start gap-3 sm:gap-3.5">
                              <div className="relative size-[72px] sm:size-[84px] rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                                {imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={imageUrl}
                                    alt={act.placeName}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <i className="fa-solid fa-location-dot text-slate-400 text-lg" aria-hidden="true" />
                                )}
                                <span
                                  className="absolute top-1.5 left-1.5 size-5 rounded-md text-white text-[11px] font-bold flex items-center justify-center shadow-xs tabular-nums"
                                  style={{ backgroundColor: dayColor }}
                                >
                                  {act.stopNumber}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-600 tabular-nums shrink-0">
                                      <i
                                        className="fa-regular fa-clock text-[10px] text-[#0194F3]"
                                        aria-hidden="true"
                                      />
                                      <span>
                                        {act.startTime || '08:30'} – {act.endTime || '10:00'}
                                      </span>
                                    </span>
                                    <span className="text-slate-300 shrink-0" aria-hidden="true">
                                      ·
                                    </span>
                                    <span className="text-slate-500 truncate">
                                      {act.categoryName || 'Tham quan'}
                                    </span>
                                  </div>

                                  {costInfo && (
                                    <span
                                      title={costInfo.title}
                                      className={`shrink-0 tabular-nums ${
                                        act.estimatedCost === 0
                                          ? 'font-medium text-emerald-700'
                                          : 'font-semibold text-slate-800'
                                      }`}
                                    >
                                      {costInfo.desktopPrefix && (
                                        <span className="hidden sm:inline">{costInfo.desktopPrefix}</span>
                                      )}
                                      <span>{costInfo.main}</span>
                                      {costInfo.desktopSuffix && (
                                        <span className="hidden sm:inline">{costInfo.desktopSuffix}</span>
                                      )}
                                    </span>
                                  )}
                                </div>

                                <h3 className="text-[14.5px] sm:text-[15px] font-semibold text-slate-900 leading-snug group-hover:text-[#0194F3] transition-colors break-words">
                                  {act.placeName}
                                </h3>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                                  {act.ratingAvg != null && act.ratingAvg > 0 ? (
                                    <span className="inline-flex items-center gap-1 font-medium text-slate-700 tabular-nums">
                                      <i className="fa-solid fa-star text-amber-400 text-[10px]" aria-hidden="true" />
                                      <span>{act.ratingAvg.toFixed(1)}</span>
                                      {act.reviewCount != null && act.reviewCount > 0 && (
                                        <span className="text-slate-500 font-normal">
                                          ({act.reviewCount > 999 ? `${(act.reviewCount / 1000).toFixed(1)}k` : act.reviewCount})
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">Chưa có đánh giá</span>
                                  )}

                                  {act.address && (
                                    <>
                                      <span className="text-slate-300" aria-hidden="true">
                                        ·
                                      </span>
                                      <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
                                        <i
                                          className="fa-solid fa-location-dot text-[10px] text-slate-400 shrink-0"
                                          aria-hidden="true"
                                        />
                                        <span className="truncate">{act.address}</span>
                                      </span>
                                    </>
                                  )}

                                  {hasOpeningBadge && act.openingStatus && (
                                    <>
                                      <span className="text-slate-300" aria-hidden="true">
                                        ·
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 font-medium ${
                                          act.openingStatus.state === 'OPEN'
                                            ? 'text-emerald-700'
                                            : act.openingStatus.state === 'CLOSED'
                                              ? 'text-rose-700'
                                              : 'text-slate-500'
                                        }`}
                                      >
                                        <i
                                          className={`text-[10px] ${
                                            act.openingStatus.state === 'OPEN'
                                              ? 'fa-solid fa-circle-check text-emerald-600'
                                              : 'fa-regular fa-clock'
                                          }`}
                                          aria-hidden="true"
                                        />
                                        <span>
                                          {act.openingStatus.label ||
                                            (act.openingStatus.state === 'OPEN'
                                              ? 'Đang mở cửa'
                                              : 'Ngoài giờ mở cửa')}
                                        </span>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Lower Content + Bottom Action Bar (sm:pl-[98px] aligns under Info column on Desktop, Full-Width on Mobile) */}
                            {(act.notes || hasBottomActionBar) && (
                              <div className="sm:pl-[98px] space-y-2">
                                {act.notes && (
                                  <p className="text-xs text-slate-600 leading-relaxed pl-2.5 border-l-2 border-[#0194F3]/35 break-words">
                                    {act.notes}
                                  </p>
                                )}

                                {hasBottomActionBar && (
                                  <div
                                    className="pt-0.5 flex flex-wrap items-center gap-1.5 sm:gap-1 relative"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {canEditCard ? (
                                      <>
                                        {onEditStop && (
                                          <button
                                            type="button"
                                            onClick={() => onEditStop(act)}
                                            className="min-h-[44px] sm:min-h-[34px] px-3 sm:px-2.5 rounded-xl sm:rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-50/70 sm:bg-transparent whitespace-nowrap"
                                          >
                                            <i
                                              className="fa-regular fa-pen-to-square text-[11px]"
                                              aria-hidden="true"
                                            />
                                            <span>Sửa giờ</span>
                                          </button>
                                        )}

                                        {onSwapPlace && (
                                          <button
                                            type="button"
                                            onClick={() => onSwapPlace(act.placeId, act)}
                                            title="Đổi điểm tham quan hoặc quán ăn khác"
                                            className="min-h-[44px] sm:min-h-[34px] px-3 sm:px-2.5 rounded-xl sm:rounded-lg text-xs font-semibold text-slate-700 hover:bg-[#F0F7FF] hover:text-[#0194F3] inline-flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-50/70 sm:bg-transparent whitespace-nowrap"
                                          >
                                            <i
                                              className="fa-solid fa-right-left text-[11px]"
                                              aria-hidden="true"
                                            />
                                            <span>Đổi điểm</span>
                                          </button>
                                        )}

                                        {isMemberOrOwner && onProposeSwap && (
                                          <button
                                            type="button"
                                            onClick={() => onProposeSwap(act.placeId, act)}
                                            className="hidden sm:inline-flex min-h-[34px] px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-[#F0F7FF] hover:text-[#0194F3] items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                          >
                                            <i
                                              className="fa-solid fa-check-to-slot text-[11px]"
                                              aria-hidden="true"
                                            />
                                            <span>Mở vote</span>
                                          </button>
                                        )}

                                        {hasOverflowItems && (
                                          <div className="relative ml-auto" data-stop-menu-root>
                                            <button
                                              type="button"
                                              aria-expanded={menuOpen}
                                              aria-haspopup="menu"
                                              aria-label={`Thêm tùy chọn cho ${act.placeName}`}
                                              onClick={() =>
                                                setOpenStopMenuKey((curr) =>
                                                  curr === stopKey ? null : stopKey,
                                                )
                                              }
                                              className="size-11 sm:size-8 rounded-xl sm:rounded-lg text-slate-500 sm:text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                                            >
                                              <i className="fa-solid fa-ellipsis text-xs" aria-hidden="true" />
                                            </button>

                                            {menuOpen && (
                                              <div
                                                role="menu"
                                                className={`absolute right-0 ${
                                                  isLastMultiStop
                                                    ? 'bottom-full mb-1.5'
                                                    : 'top-full mt-1.5'
                                                } w-52 sm:w-44 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-40`}
                                              >
                                                {isMemberOrOwner && onProposeSwap && (
                                                  <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                      setOpenStopMenuKey(null);
                                                      onProposeSwap(act.placeId, act);
                                                    }}
                                                    className="sm:hidden w-full text-left px-3.5 min-h-[44px] text-xs font-semibold text-[#0194F3] hover:bg-[#F0F7FF] flex items-center gap-2.5 cursor-pointer"
                                                  >
                                                    <i
                                                      className="fa-solid fa-check-to-slot text-[11px]"
                                                      aria-hidden="true"
                                                    />
                                                    <span>Mở bình chọn nhóm</span>
                                                  </button>
                                                )}

                                                {onMoveStop && act.id && !isFirst && (
                                                  <button
                                                    type="button"
                                                    role="menuitem"
                                                    disabled={isMoving}
                                                    onClick={() => {
                                                      setOpenStopMenuKey(null);
                                                      onMoveStop(act.id!, 'UP');
                                                    }}
                                                    className="w-full text-left px-3.5 min-h-[44px] sm:min-h-[36px] text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer disabled:opacity-40"
                                                  >
                                                    <i
                                                      className="fa-solid fa-arrow-up text-[11px] text-slate-400"
                                                      aria-hidden="true"
                                                    />
                                                    <span>Đưa lên trước</span>
                                                  </button>
                                                )}

                                                {onMoveStop && act.id && !isLast && (
                                                  <button
                                                    type="button"
                                                    role="menuitem"
                                                    disabled={isMoving}
                                                    onClick={() => {
                                                      setOpenStopMenuKey(null);
                                                      onMoveStop(act.id!, 'DOWN');
                                                    }}
                                                    className="w-full text-left px-3.5 min-h-[44px] sm:min-h-[36px] text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer disabled:opacity-40"
                                                  >
                                                    <i
                                                      className="fa-solid fa-arrow-down text-[11px] text-slate-400"
                                                      aria-hidden="true"
                                                    />
                                                    <span>Đẩy xuống sau</span>
                                                  </button>
                                                )}

                                                {onDeletePlace && (
                                                  <button
                                                    type="button"
                                                    role="menuitem"
                                                    title="Xóa điểm này khỏi lịch trình"
                                                    onClick={() => {
                                                      setOpenStopMenuKey(null);
                                                      onDeletePlace(act.placeId, act);
                                                    }}
                                                    className="w-full text-left px-3.5 min-h-[44px] sm:min-h-[36px] text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                                                  >
                                                    <i
                                                      className="fa-regular fa-trash-can text-[11px]"
                                                      aria-hidden="true"
                                                    />
                                                    <span>Xóa điểm dừng</span>
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      isMemberOrOwner &&
                                      onProposeSwap && (
                                        <button
                                          type="button"
                                          onClick={() => onProposeSwap(act.placeId, act)}
                                          className="min-h-[44px] sm:min-h-[34px] px-3.5 sm:px-2.5 rounded-xl sm:rounded-lg text-xs font-semibold text-[#0194F3] bg-[#F0F7FF]/70 hover:bg-[#E0EFFF]/70 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                        >
                                          <i
                                            className="fa-solid fa-right-left text-[11px]"
                                            aria-hidden="true"
                                          />
                                          <span>Đề xuất đổi điểm</span>
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Inline Vote Trigger */}
                            {stopVotesCount > 0 && (
                              <div className="sm:pl-[98px]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenVotingTab?.();
                                  }}
                                  className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 rounded-xl bg-[#F0F7FF]/70 hover:bg-[#E0EFFF]/60 border border-[#BAE0FD]/70 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs transition-colors cursor-pointer"
                                >
                                  <span className="inline-flex items-center gap-2 text-slate-700 text-left min-w-0">
                                    <i
                                      className="fa-solid fa-check-to-slot text-[#0194F3] shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span className="min-w-0">
                                      Đang có <strong className="text-slate-900">{stopVotesCount} đề xuất thay thế</strong> cần ý kiến nhóm
                                    </span>
                                  </span>
                                  <span className="font-semibold text-[#0194F3] inline-flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                                    <span>Bình chọn</span>
                                    <i className="fa-solid fa-chevron-right text-[10px]" aria-hidden="true" />
                                  </span>
                                </button>
                              </div>
                            )}
                          </article>

                          {/* Discrete Transit Connector */}
                          {!isLast && (
                            <div className="flex items-center gap-2.5 pl-9 py-1">
                              <span className="w-px h-4 bg-slate-300 shrink-0" aria-hidden="true" />
                              {renderIntracityTransitConnector(act)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Per-Day Action Buttons (Direct Add vs Propose for Voting when day already has stops) */}
                {day.activities.length > 0 &&
                  (Boolean(onAddPlace) || Boolean(isMemberOrOwner && onProposeNewForDay)) && (
                  <div
                    className={
                      Boolean(onAddPlace) && Boolean(isMemberOrOwner && onProposeNewForDay)
                        ? 'grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1'
                        : 'pt-1'
                    }
                  >
                    {onAddPlace && (
                      <button
                        type="button"
                        onClick={() => onAddPlace(day.dayNumber)}
                        className="w-full min-h-[42px] rounded-2xl border border-dashed border-slate-300 bg-white/70 hover:bg-[#F0F7FF]/50 hover:border-[#0194F3]/60 text-slate-600 hover:text-[#0194F3] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <i className="fa-solid fa-plus text-[11px]" aria-hidden="true" />
                        <span>Thêm địa điểm vào Ngày {day.dayNumber}</span>
                      </button>
                    )}

                    {isMemberOrOwner && onProposeNewForDay && (
                      <button
                        type="button"
                        onClick={() => onProposeNewForDay(day.dayNumber)}
                        className={`w-full min-h-[42px] rounded-2xl border border-dashed text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                          onAddPlace
                            ? 'border-slate-200 bg-white/70 hover:bg-slate-100 text-slate-600'
                            : 'border-[#0194F3]/50 bg-[#F0F7FF]/40 hover:bg-[#F0F7FF] text-[#0194F3]'
                        }`}
                      >
                        <i className="fa-solid fa-check-to-slot text-[11px] text-[#0194F3]" aria-hidden="true" />
                        <span>
                          {onAddPlace
                            ? 'Đề xuất để nhóm vote'
                            : `Đề xuất địa điểm vào Ngày ${day.dayNumber} để nhóm bình chọn`}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
});

export default ItineraryTimeline;

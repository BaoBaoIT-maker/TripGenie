'use client';

import { memo, useEffect, useState } from 'react';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { useI18n, type AppLocale } from '@/i18n';
import { useItineraryHoverStore } from '../../stores/itinerary-hover-store';
import {
  WEATHER_THEMES,
  getDayWeatherAdvice,
  getWeatherConditionLabel,
} from '../../constants/climate.constants';
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
import { LodgingAnchorBar } from './LodgingAnchorBar';
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
  onOpenLodgingPicker?: (nightNumber: number) => void;
}

type TranslateFn = ReturnType<typeof useI18n>['t'];

const TRANSIT_MODE_OPTIONS: ReadonlyArray<{
  mode: TransitMode;
  iconClass: string;
}> = [
  { mode: 'FLIGHT', iconClass: 'fa-solid fa-plane' },
  { mode: 'TRAIN', iconClass: 'fa-solid fa-train' },
  { mode: 'SLEEPER_BUS', iconClass: 'fa-solid fa-bus' },
  { mode: 'PERSONAL_CAR', iconClass: 'fa-solid fa-car' },
  { mode: 'PERSONAL_MOTORBIKE', iconClass: 'fa-solid fa-motorcycle' },
];

function getTransitVisualMeta(transit: IntercityTransit, t: TranslateFn, locale: AppLocale) {
  switch (transit.mode) {
    case 'FLIGHT':
      return {
        iconClass: 'fa-solid fa-plane',
        label: t('planner.transitModes.FLIGHT'),
        summary: `~${formatDuration(
          Math.max(
            TRANSIT_UI_CONFIG.FLIGHT_MIN_DURATION_MINUTES,
            transit.durationMinutes || TRANSIT_UI_CONFIG.FLIGHT_DEFAULT_DURATION_MINUTES,
          ),
          locale,
        )}`,
      };
    case 'TRAIN':
      return {
        iconClass: 'fa-solid fa-train',
        label: t('planner.transitModes.TRAIN'),
        summary: `~${Math.round(transit.distanceKm)} km · ~${t('planner.timeline.hoursShort', { hours: Math.max(1, Math.round(transit.durationMinutes / 60)) })}`,
      };
    case 'SLEEPER_BUS':
      return {
        iconClass: 'fa-solid fa-bus',
        label: t('planner.transitModes.SLEEPER_BUS'),
        summary: `~${Math.round(transit.distanceKm)} km · ~${t('planner.timeline.hoursShort', { hours: Math.max(1, Math.round(transit.durationMinutes / 60)) })}`,
      };
    case 'PERSONAL_CAR':
      return {
        iconClass: 'fa-solid fa-car',
        label: t('planner.transitModes.CAR_SHORT'),
        summary: `~${Math.round(transit.distanceKm)} km`,
      };
    case 'PERSONAL_MOTORBIKE':
      return {
        iconClass: 'fa-solid fa-motorcycle',
        label: t('planner.transitModes.PERSONAL_MOTORBIKE'),
        summary: `~${Math.round(transit.distanceKm)} km`,
      };
    default:
      return {
        iconClass: 'fa-solid fa-route',
        label: t('planner.transitModes.INTERCITY_FALLBACK'),
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

function formatDayFullDate(
  isoString: string | null | undefined,
  dayIndex: number,
  t: TranslateFn,
  locale: AppLocale,
): string {
  if (!isoString) return t('planner.common.day', { n: dayIndex + 1 });
  try {
    const d = new Date(isoString);
    d.setDate(d.getDate() + dayIndex);
    if (locale === 'en') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return `${d.getDate()} Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  } catch {
    return t('planner.common.day', { n: dayIndex + 1 });
  }
}

function formatStopCostText(
  act: ItineraryActivity,
  t: TranslateFn,
): {
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
      main: t('common.free'),
      desktopSuffix: t('planner.timeline.freeTicketSuffix'),
      title: t('planner.timeline.freeTicketTitle'),
    };
  }

  const isDining = isDiningActivity(act.categoryName, act.placeName);
  if (isDining) {
    const hasCost = act.estimatedCost != null && act.estimatedCost > 0;
    const rangeTooltip =
      act.priceRange?.min != null && act.priceRange?.max != null && act.priceRange.max > 0
        ? t('planner.timeline.diningPriceRange', {
            min: formatVnd(act.priceRange.min),
            max: formatVnd(act.priceRange.max),
          })
        : t('planner.timeline.diningEstimateTitle');
    return hasCost
      ? {
          main: `~${formatVnd(act.estimatedCost!)}`,
          desktopSuffix: t('planner.common.perPerson'),
          title: rangeTooltip,
        }
      : { main: t('planner.common.menuCostFallback'), title: rangeTooltip };
  }

  if (act.estimatedCost != null && act.estimatedCost > 0) {
    const rangeTooltip =
      act.priceRange?.min != null && act.priceRange?.max != null && act.priceRange.max > act.priceRange.min
        ? t('planner.timeline.ticketPriceRange', {
            min: formatVnd(act.priceRange.min),
            max: formatVnd(act.priceRange.max),
          })
        : t('planner.timeline.ticketEstimateTitle');
    return {
      desktopPrefix: t('planner.timeline.ticketPrefix'),
      main: `~${formatVnd(act.estimatedCost)}`,
      title: rangeTooltip,
    };
  }

  return null;
}

function renderIntracityTransitConnector(
  act: ItineraryActivity,
  t: TranslateFn,
  locale: AppLocale,
) {
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
    const durationText = formatDuration(minutes, locale);

    if (mode === 'WALK') {
      return (
        <span className="text-[11px] text-slate-600 font-medium inline-flex items-center gap-1.5 tabular-nums">
          <i className="fa-solid fa-person-walking text-emerald-600 text-xs" aria-hidden="true" />
          <span>{t('planner.timeline.connectorWalk', { duration: durationText, km })}</span>
        </span>
      );
    }

    if (mode === 'CAR') {
      return (
        <span className="text-[11px] text-slate-600 font-medium inline-flex items-center gap-1.5 tabular-nums">
          <i className="fa-solid fa-car text-[#0194F3] text-xs" aria-hidden="true" />
          <span>{t('planner.timeline.connectorCar', { duration: durationText, km })}</span>
        </span>
      );
    }

    return (
      <span className="text-[11px] text-slate-600 font-medium inline-flex items-center gap-1.5 tabular-nums">
        <i className="fa-solid fa-motorcycle text-slate-500 text-xs" aria-hidden="true" />
        <span>{t('planner.timeline.connectorBike', { duration: durationText, km })}</span>
      </span>
    );
  }

  return (
    <span className="text-[11px] text-slate-400 font-medium inline-flex items-center gap-1.5">
      <i className="fa-solid fa-route text-[10px]" aria-hidden="true" />
      <span>{t('planner.timeline.connectorFallback')}</span>
    </span>
  );
}

function renderTransitDeepLinks(transit: IntercityTransit, t: TranslateFn) {
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
              <span>{t('planner.timeline.bookTraveloka')}</span>
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
              <span>{t('planner.timeline.bookVexereTrain')}</span>
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
              <span>{t('planner.timeline.dsvnPortal')}</span>
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
              <span>{t('planner.timeline.bookVexereBus')}</span>
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
              <span>{t('planner.timeline.bookTravelokaBus')}</span>
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
            <span>{t('planner.timeline.viewGoogleMaps')}</span>
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
  onOpenLodgingPicker,
}: Props) {
  const { t, locale } = useI18n();
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
  const transitVisual = transit ? getTransitVisualMeta(transit, t, locale) : null;
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
          aria-label={t('planner.timeline.intercityAria')}
          className={`rounded-2xl border bg-white overflow-hidden transition-colors ${
            isLongMotorbikeWarning ? 'border-amber-300' : 'border-slate-200'
          }`}
        >
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            {/* Left: Icon & Transit Name on the same row */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="size-8 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center shrink-0">
                <i className={`${transitVisual.iconClass} text-xs`} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-bold text-[#10243A] text-xs sm:text-[13px] min-w-0">
                  <span className="shrink-0">{transitVisual.label}:</span>
                  <span className="truncate text-slate-800 font-semibold">
                    {cleanHubName(transit.originHub?.name || transit.originName)} →{' '}
                    {cleanHubName(transit.destHub?.name || transit.destName)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums truncate">
                  {transitVisual.summary}
                  {' · '}
                  {t('planner.timeline.roundTripSummary', {
                    price: formatVnd(transit.estimatedPriceRoundTrip),
                  })}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
              <button
                type="button"
                aria-expanded={isTransitDetailsOpen}
                onClick={() => setIsTransitDetailsOpen((v) => !v)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>
                  {isTransitDetailsOpen
                    ? t('planner.timeline.collapse')
                    : t('planner.timeline.legDetails')}
                </span>
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
                  <span>{t('planner.timeline.editTransit')}</span>
                </button>
              )}
            </div>
          </div>

          {isLongMotorbikeWarning && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-[11px] text-amber-800 font-medium flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-500 shrink-0" aria-hidden="true" />
              <span>
                {t('planner.timeline.motorbikeWarning', {
                  km: TRANSIT_UI_CONFIG.MOTORBIKE_SAFETY_LIMIT_KM,
                })}
              </span>
            </div>
          )}

          {isTransitDetailsOpen && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-2 bg-slate-50/40">
              <TransitRouteBreakdown transit={transit} destCity={targetCityName} />
              {renderTransitDeepLinks(transit, t)}
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
                  {t('planner.timeline.editTransitTitle')}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {t('planner.timeline.editTransitSubtitle')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditTransitOpen(false)}
              aria-label={t('planner.common.closeDialog')}
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
                      <span className="text-xs font-bold text-[#10243A]">
                        {t(`planner.timeline.transitOptions.${opt.mode}.title`)}
                      </span>
                      {isSelected && (
                        <span className="size-4 rounded-full bg-[#0194F3] text-white flex items-center justify-center">
                          <i className="fa-solid fa-check text-[9px]" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      {t(`planner.timeline.transitOptions.${opt.mode}.desc`)}
                    </p>
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
              {t('common.cancel')}
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
                  <span>{t('planner.timeline.updating')}</span>
                </>
              ) : (
                <span>{t('planner.timeline.confirmChange')}</span>
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
        const dayWeatherLabel = dayWeather
          ? locale === 'en' && dayWeather.labelEn
            ? dayWeather.labelEn
            : getWeatherConditionLabel(dayWeather.condition, locale, dayWeather.labelVi)
          : '';

        return (
          <section
            key={day.dayNumber}
            aria-label={t('planner.timeline.dayAria', { day: day.dayNumber })}
            className="space-y-3"
          >
            {/* Day Header + Option A Weather Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-200/80 pt-1">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 sm:flex-1">
                {isCollapsibleDays ? (
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-label={
                      isCollapsed
                        ? t('planner.timeline.expandDayAria', { day: day.dayNumber })
                        : t('planner.timeline.collapseDayAria', { day: day.dayNumber })
                    }
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
                        {t('planner.common.day', { n: day.dayNumber })}
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
                      {t('planner.common.day', { n: day.dayNumber })}
                      {day.theme && day.theme.trim().toLowerCase() !== `ngày ${day.dayNumber}`.toLowerCase()
                        ? `: ${day.theme}`
                        : ''}
                    </h2>
                  )}
                  <p className="text-xs text-slate-500 tabular-nums font-medium">
                    {formatDayFullDate(startDate, dIdx, t, locale)} ·{' '}
                    {t('planner.common.stopsCount', { count: day.activities.length })}
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
                  title={t('planner.timeline.weatherPillTitle')}
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
                    {dayWeatherLabel}
                  </span>
                  {dayWeather.source === 'SEASONAL_AVERAGE' && (
                    <span className="text-[11px] text-slate-500">
                      {t('planner.timeline.seasonalTag')}
                    </span>
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
              const dayAdvice = getDayWeatherAdvice(dayWeather, locale);
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
                        {dayWeatherLabel}
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
                          <span>
                            {t('planner.timeline.rainProb', {
                              pct: dayWeather.precipitationProbabilityMax,
                            })}
                          </span>
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
                          <span>{t('planner.timeline.seasonalClimateBadge')}</span>
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

            {day.lodging && !day.lodging.isCheckOutDay && (
              <LodgingAnchorBar
                dayNumber={day.dayNumber}
                lodging={day.lodging}
                canEdit={Boolean(onEditStop || onAddPlace)}
                isSelected={day.lodging.placeId === selectedPlaceId}
                onSelectLodging={onSelectPlace}
                onHoverLodging={handleHoverPlace}
                onOpenPicker={onOpenLodgingPicker}
              />
            )}

            {isCollapsed ? (
              <button
                type="button"
                onClick={() => toggleDayCollapsed(day.dayNumber)}
                className="w-full py-2.5 rounded-xl border border-slate-200/80 bg-white text-xs font-semibold text-slate-600 hover:text-[#0194F3] hover:border-[#0194F3]/30 transition-colors cursor-pointer"
              >
                {t('planner.timeline.collapsedSummary', { count: day.activities.length })}
              </button>
            ) : (
              <>
                {day.activities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center space-y-2.5">
                    <div className="size-10 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                      <i className="fa-regular fa-calendar-plus text-base" aria-hidden="true" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {t('planner.timeline.emptyDayTitle', { day: day.dayNumber })}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      {t('planner.timeline.emptyDayDesc')}
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
                            <span>{t('planner.timeline.addPlaceToDay', { day: day.dayNumber })}</span>
                          </button>
                        )}
                        {!onAddPlace && isMemberOrOwner && onProposeNewForDay && (
                          <button
                            type="button"
                            onClick={() => onProposeNewForDay(day.dayNumber)}
                            className="min-h-[40px] px-4 rounded-xl bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <i className="fa-solid fa-check-to-slot" aria-hidden="true" />
                            <span>{t('planner.timeline.proposePlaceForDay', { day: day.dayNumber })}</span>
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
                      const costInfo = formatStopCostText(act, t);
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
                        <div key={stopKey} className="transition-all duration-200">
                          <article
                            id={`itinerary-activity-${act.placeId}`}
                            onClick={() => onSelectPlace?.(act.placeId)}
                            onMouseEnter={() => handleHoverPlace(act.placeId)}
                            onMouseLeave={() => handleHoverPlace(null)}
                            className={`group bg-white rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 cursor-pointer space-y-2.5 ${
                              isSelected
                                ? 'border-[#0194F3] ring-2 ring-[#0194F3]/15 shadow-sm'
                                : 'border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.03)] hover:border-slate-300'
                            } ${isMoving ? 'ring-2 ring-primary/40 shadow-md scale-[1.008]' : ''}`}
                            style={
                              isSelected
                                ? { borderColor: dayColor, boxShadow: `0 0 0 2px ${dayColor}26` }
                                : undefined
                            }
                          >
                            {/* Top Row */}
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
                                      {act.categoryName || t('planner.common.sightseeingFallback')}
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
                                    <span className="text-slate-500">{t('planner.timeline.noRating')}</span>
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
                                          {locale === 'vi' && act.openingStatus.label
                                            ? act.openingStatus.label
                                            : act.openingStatus.state === 'OPEN'
                                              ? t('planner.timeline.openNow')
                                              : t('planner.timeline.closedNow')}
                                        </span>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Lower Content + Bottom Action Bar */}
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
                                            <span>{t('planner.timeline.editTime')}</span>
                                          </button>
                                        )}

                                        {onSwapPlace && (
                                          <button
                                            type="button"
                                            onClick={() => onSwapPlace(act.placeId, act)}
                                            title={t('planner.timeline.swapStopTitle')}
                                            className="min-h-[44px] sm:min-h-[34px] px-3 sm:px-2.5 rounded-xl sm:rounded-lg text-xs font-semibold text-slate-700 hover:bg-[#F0F7FF] hover:text-[#0194F3] inline-flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-50/70 sm:bg-transparent whitespace-nowrap"
                                          >
                                            <i
                                              className="fa-solid fa-right-left text-[11px]"
                                              aria-hidden="true"
                                            />
                                            <span>{t('planner.timeline.swapStop')}</span>
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
                                            <span>{t('planner.timeline.openVote')}</span>
                                          </button>
                                        )}

                                        {hasOverflowItems && (
                                          <div className="relative ml-auto" data-stop-menu-root>
                                            <button
                                              type="button"
                                              aria-expanded={menuOpen}
                                              aria-haspopup="menu"
                                              aria-label={t('planner.timeline.moreStopOptions', {
                                                name: act.placeName,
                                              })}
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
                                                    <span>{t('planner.timeline.openGroupVote')}</span>
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
                                                    <span>{t('planner.timeline.moveUp')}</span>
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
                                                    <span>{t('planner.timeline.moveDown')}</span>
                                                  </button>
                                                )}

                                                {onDeletePlace && (
                                                  <button
                                                    type="button"
                                                    role="menuitem"
                                                    title={t('planner.timeline.deleteStopTitle')}
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
                                                    <span>{t('planner.timeline.deleteStop')}</span>
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
                                          <span>{t('planner.timeline.proposeSwap')}</span>
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
                                      {t('planner.timeline.pendingVotesPrefix')}{' '}
                                      <strong className="text-slate-900">
                                        {t('planner.timeline.pendingVotesCount', {
                                          count: stopVotesCount,
                                        })}
                                      </strong>{' '}
                                      {t('planner.timeline.pendingVotesSuffix')}
                                    </span>
                                  </span>
                                  <span className="font-semibold text-[#0194F3] inline-flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                                    <span>{t('planner.timeline.voteCta')}</span>
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
                              {renderIntracityTransitConnector(act, t, locale)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Per-Day Action Buttons */}
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
                        <span>{t('planner.timeline.addPlaceToDay', { day: day.dayNumber })}</span>
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
                            ? t('planner.timeline.proposeToGroup')
                            : t('planner.timeline.proposeForDayFull', { day: day.dayNumber })}
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

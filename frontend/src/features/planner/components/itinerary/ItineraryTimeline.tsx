'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Star,
  Sparkles,
  Trash2,
  Plus,
  Lightbulb,
  Plane,
  TrainFront,
  Bus,
  Car,
  Bike,
  Ticket,
  MapPin,
  ExternalLink,
  Banknote,
  UtensilsCrossed,
  Check,
  Footprints,
  ArrowLeftRight,
  Loader2,
  Layers,
  X,
} from 'lucide-react';
import type { ItineraryDay, IntercityTransit, ItineraryActivity, TransitMode } from '@/types/itinerary';
import { formatVnd } from '../../model/itinerary-format';
import { getDayColor } from '@/features/map/types';

interface Props {
  days: ItineraryDay[];
  transit?: IntercityTransit | null;
  startDate?: string | null;
  endDate?: string | null;
  selectedPlaceId?: string | null;
  onSelectPlace?: (placeId: string) => void;
  onHoverPlace?: (placeId: string | null) => void;
  onSwapPlace?: (placeId: string, activity?: ItineraryActivity) => void;
  onDeletePlace?: (placeId: string) => void;
  onAddPlace?: (dayNumber: number) => void;
  onChangeTransitMode?: (newMode: TransitMode) => Promise<void> | void;
  isUpdatingTransitMode?: boolean;
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

function getTransitModeConfig(transit: IntercityTransit) {
  switch (transit.mode) {
    case 'FLIGHT':
      return {
        icon: <Plane className="size-4 text-sky-600 shrink-0" aria-hidden="true" />,
        title: 'Chặng bay: Hàng không liên tỉnh',
        departLabel: 'Khởi hành 10:30',
        arriveLabel: 'Hạ cánh 11:50',
        distanceSummary: `Chặng bay ${Math.floor(transit.durationMinutes / 60)}h ${transit.durationMinutes % 60}m`,
      };
    case 'TRAIN':
      return {
        icon: <TrainFront className="size-4 text-amber-600 shrink-0" aria-hidden="true" />,
        title: 'Chặng tàu: Đường sắt Bắc - Nam',
        departLabel: 'Khởi hành 19:00',
        arriveLabel: 'Đến ga ~07:30 hôm sau',
        distanceSummary: `Tàu hỏa đường sắt ~${transit.distanceKm} km (~${Math.round(transit.durationMinutes / 60)} tiếng)`,
      };
    case 'SLEEPER_BUS':
      return {
        icon: <Bus className="size-4 text-emerald-600 shrink-0" aria-hidden="true" />,
        title: 'Chặng đi: Xe khách đường dài',
        departLabel: 'Khởi hành 22:00',
        arriveLabel: 'Đến bến ~06:00 sáng',
        distanceSummary: `Xe khách giường nằm ~${transit.distanceKm} km (~${Math.round(transit.durationMinutes / 60)} tiếng)`,
      };
    case 'PERSONAL_CAR':
      return {
        icon: <Car className="size-4 text-indigo-600 shrink-0" aria-hidden="true" />,
        title: 'Chặng đi: Ô tô cá nhân',
        departLabel: 'Khởi hành linh hoạt',
        arriveLabel: 'Đến nơi dự kiến',
        distanceSummary: `Ô tô tự lái ~${transit.distanceKm} km (~${Math.round(transit.durationMinutes / 60)} tiếng)`,
      };
    case 'PERSONAL_MOTORBIKE':
      return {
        icon: <Bike className="size-4 text-teal-600 shrink-0" aria-hidden="true" />,
        title: 'Chặng đi: Phượt xe máy',
        departLabel: 'Khởi hành sáng sớm (~05:30)',
        arriveLabel: 'Đến nơi dự kiến',
        distanceSummary: `Phượt xe máy ~${transit.distanceKm} km (~${Math.round(transit.durationMinutes / 60)} tiếng)`,
      };
    default:
      return {
        icon: <Car className="size-4 text-slate-600 shrink-0" aria-hidden="true" />,
        title: 'Chặng đi: Di chuyển liên tỉnh',
        departLabel: 'Khởi hành',
        arriveLabel: 'Đến nơi',
        distanceSummary: `Cự ly ~${transit.distanceKm} km`,
      };
  }
}

const TRANSIT_MODE_OPTIONS: Array<{
  mode: TransitMode;
  title: string;
  desc: string;
  icon: (className?: string) => React.ReactNode;
}> = [
  {
    mode: 'FLIGHT',
    title: 'Máy bay',
    desc: 'Nhanh nhất cho cự ly xa, đặt qua Google Flights & Traveloka',
    icon: (c) => <Plane className={c || 'size-4 text-sky-600'} aria-hidden="true" />,
  },
  {
    mode: 'TRAIN',
    title: 'Tàu hỏa (Đường sắt)',
    desc: 'Trải nghiệm ngắm cảnh, an toàn, đặt qua ĐSVN & VeXeRe',
    icon: (c) => <TrainFront className={c || 'size-4 text-amber-600'} aria-hidden="true" />,
  },
  {
    mode: 'SLEEPER_BUS',
    title: 'Xe khách giường nằm',
    desc: 'Tiết kiệm chi phí, chạy ban đêm, đặt qua VeXeRe & Traveloka',
    icon: (c) => <Bus className={c || 'size-4 text-emerald-600'} aria-hidden="true" />,
  },
  {
    mode: 'PERSONAL_CAR',
    title: 'Ô tô cá nhân / Thuê xe',
    desc: 'Chủ động hành trình, phù hợp đi cùng gia đình, nhóm bạn',
    icon: (c) => <Car className={c || 'size-4 text-indigo-600'} aria-hidden="true" />,
  },
  {
    mode: 'PERSONAL_MOTORBIKE',
    title: 'Xe máy phượt',
    desc: 'Tự do trải nghiệm cung đường đèo ven biển, tiết kiệm tối đa',
    icon: (c) => <Bike className={c || 'size-4 text-teal-600'} aria-hidden="true" />,
  },
];

function formatDurationMinutes(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}p` : `${hours} tiếng`;
  }
  return `${minutes} phút`;
}

function renderIntracityTransitConnector(act: ItineraryActivity) {
  if (act.distanceToNextKm != null && act.distanceToNextKm > 0) {
    const km = act.distanceToNextKm;
    const mode = act.travelModeToNext ?? (km <= 0.8 ? 'WALK' : 'BIKE');
    const minutes =
      act.durationToNextMinutes ??
      (mode === 'WALK'
        ? Math.max(2, Math.round((km / 4.5) * 60))
        : Math.max(3, Math.round(((km * 1.25) / 25) * 60) + 2));

    const durationText = formatDurationMinutes(minutes);

    if (mode === 'WALK') {
      return (
        <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1.5 shadow-2xs">
          <Footprints className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span>~{durationText} đi bộ ({km} km)</span>
        </span>
      );
    }

    if (mode === 'CAR') {
      return (
        <span className="text-[11px] text-sky-700 dark:text-sky-300 font-medium bg-sky-50/80 dark:bg-sky-950/40 px-3 py-1 rounded-full border border-sky-200 dark:border-sky-800/60 inline-flex items-center gap-1.5 shadow-2xs">
          <Car className="size-3 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
          <span>~{durationText} ô tô / taxi ({km} km)</span>
        </span>
      );
    }

    return (
      <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium bg-amber-50/80 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800/60 inline-flex items-center gap-1.5 shadow-2xs">
        <Bike className="size-3 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
        <span>~{durationText} xe máy ({km} km)</span>
      </span>
    );
  }

  return (
    <span className="text-[11px] text-slate-500 font-medium bg-slate-50 dark:bg-slate-900/60 px-3 py-1 rounded-full border border-slate-200/80 dark:border-slate-800 inline-flex items-center gap-1.5 shadow-2xs">
      <Bike className="size-3 text-slate-400 shrink-0" aria-hidden="true" />
      <span>Di chuyển đến điểm tiếp theo</span>
    </span>
  );
}

function renderActivityPriceBadge(act: ItineraryActivity) {
  const isFree =
    act.estimatedCost === 0 ||
    (act.priceRange?.min === 0 && (act.priceRange?.max === 0 || act.priceRange?.max == null));

  const catLower = (act.categoryName || '').toLowerCase();
  const placeLower = (act.placeName || '').toLowerCase();
  const isDining =
    catLower.includes('ẩm thực') ||
    catLower.includes('nhà hàng') ||
    catLower.includes('cà phê') ||
    catLower.includes('quán ăn') ||
    catLower.includes('tráng miệng') ||
    catLower.includes('ăn vặt') ||
    catLower.includes('bar') ||
    placeLower.includes('quán') ||
    placeLower.includes('phở') ||
    placeLower.includes('bún') ||
    placeLower.includes('cơm');

  if (isFree) {
    return (
      <span
        title="Địa điểm tham quan mở cửa tự do, không thu phí vé vào cổng"
        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1 shadow-2xs"
      >
        <Ticket className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>Miễn phí vé</span>
      </span>
    );
  }

  if (isDining) {
    const costText =
      act.estimatedCost != null && act.estimatedCost > 0
        ? `~${formatVnd(act.estimatedCost)}/người`
        : 'Theo thực đơn';
    const rangeTooltip =
      act.priceRange?.min != null && act.priceRange?.max != null && act.priceRange.max > 0
        ? `Thực đơn cào được: ${formatVnd(act.priceRange.min)} – ${formatVnd(act.priceRange.max)}`
        : 'Chi phí ước tính một suất ăn';

    return (
      <span
        title={rangeTooltip}
        className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 inline-flex items-center gap-1 shadow-2xs"
      >
        <UtensilsCrossed className="size-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span>{costText}</span>
      </span>
    );
  }

  // Attraction with ticket
  if (act.estimatedCost != null && act.estimatedCost > 0) {
    const rangeTooltip =
      act.priceRange?.min != null && act.priceRange?.max != null && act.priceRange.max > act.priceRange.min
        ? `Giá vé niêm yết: ${formatVnd(act.priceRange.min)} – ${formatVnd(act.priceRange.max)}`
        : 'Giá vé tham quan tiêu chuẩn';

    return (
      <span
        title={rangeTooltip}
        className="text-[10px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/60 inline-flex items-center gap-1 shadow-2xs"
      >
        <Ticket className="size-3 text-rose-600 dark:text-rose-400" aria-hidden="true" />
        <span>Vé: ~{formatVnd(act.estimatedCost)}</span>
      </span>
    );
  }

  if (act.priceLevel) {
    return (
      <span className="text-[10px] font-bold text-slate-700 bg-slate-50 dark:bg-slate-900/60 dark:text-slate-300 px-1.5 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-800 inline-flex items-center gap-1">
        <Banknote className="size-3 text-slate-500" aria-hidden="true" />
        <span>{act.priceLevel === 'LOW' ? 'Tiết kiệm' : act.priceLevel === 'HIGH' ? 'Cao cấp' : 'Tiêu chuẩn'}</span>
      </span>
    );
  }

  return null;
}

export default function ItineraryTimeline({
  days,
  transit,
  startDate,
  endDate,
  selectedPlaceId,
  onSelectPlace,
  onHoverPlace,
  onSwapPlace,
  onDeletePlace,
  onAddPlace,
  onChangeTransitMode,
  isUpdatingTransitMode,
}: Props) {
  const numbered = numberStops(days);
  const modeConfig = transit ? getTransitModeConfig(transit) : null;
  const [isEditTransitOpen, setIsEditTransitOpen] = useState(false);
  const [selectedTransitMode, setSelectedTransitMode] = useState<TransitMode>(transit?.mode || 'FLIGHT');

  const handleConfirmChangeTransit = async () => {
    if (!onChangeTransitMode || !selectedTransitMode || selectedTransitMode === transit?.mode) {
      setIsEditTransitOpen(false);
      return;
    }
    await onChangeTransitMode(selectedTransitMode);
    setIsEditTransitOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────────
          INTERCITY TRANSIT CARD (Database-driven deep links)
          ───────────────────────────────────────────────────────────────── */}
      {transit && modeConfig && (
        <div className="bg-card text-card-foreground rounded-2xl border border-border p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <span className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-2">
              {modeConfig.icon}
              <span>{modeConfig.title}</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border/60">
                Ước tính: ~{formatVnd(transit.estimatedPriceRoundTrip)} / vé khứ hồi
              </span>
              {onChangeTransitMode && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTransitMode(transit.mode);
                    setIsEditTransitOpen(true);
                  }}
                  disabled={isUpdatingTransitMode}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 font-semibold transition-colors cursor-pointer text-[11px] shadow-2xs"
                >
                  {isUpdatingTransitMode ? (
                    <>
                      <Loader2 className="size-3 animate-spin text-teal-600 dark:text-teal-400" aria-hidden="true" />
                      <span>Đang đổi...</span>
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="size-3 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                      <span>Sửa phương tiện</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-1 text-xs">
            <div>
              <div className="text-sm font-bold text-foreground">
                {transit.originHub?.name || transit.originName}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {modeConfig.departLabel}
              </div>
            </div>

            <div className="flex-1 px-4 text-center">
              <div className="text-[11px] text-primary font-semibold">
                {modeConfig.distanceSummary}
                {transit.details?.carriers ? ` • ${transit.details.carriers}` : ''}
              </div>
              <div className="w-full h-px bg-border my-1" />
              <div className="text-[11px] text-muted-foreground">
                {transit.destHub ? `Trung chuyển về ${transit.destName}` : `Đến ${transit.destName}`}
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-bold text-foreground">
                {transit.destHub?.name || transit.destName}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {modeConfig.arriveLabel}
              </div>
            </div>
          </div>

          {/* Multi-Modal Connecting Route Breakdown (e.g. Train to Da Lat / Sa Pa / Phu Quoc, Bus to Phu Quoc) */}
          {transit.isMultiModal && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-indigo-950/30 p-3.5 space-y-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between font-bold text-indigo-950 dark:text-indigo-200 flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <Layers className="size-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  <span>LỘ TRÌNH NỐI CHẶNG THÔNG MINH:</span>
                </span>
                {transit.transferLeg && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700">
                    {transit.transferLeg.type === 'FERRY' ? 'Tàu cao tốc sang đảo' : 'Xe trung chuyển kết nối'}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                {transit.details?.routeSteps?.map((step, idx) => (
                  <p key={idx} className="flex items-start gap-2">
                    <span className="size-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="flex-1">{step}</span>
                  </p>
                ))}
              </div>

              {transit.details?.notes && (
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-indigo-800 dark:text-indigo-300 font-medium">
                  <Lightbulb className="size-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                  <span>{transit.details.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Mode-Specific Booking & Routing Buttons (No Emojis, Clean UI/UX) */}
          <div className="pt-2.5 border-t border-border/80 flex items-center justify-between text-xs flex-wrap gap-2">
            <span className="text-muted-foreground text-[11px]">Giá biến động theo ngày di chuyển thực tế</span>
            <div className="flex items-center gap-2 flex-wrap">
              {transit.mode === 'FLIGHT' && (
                <>
                  {transit.deepLinks?.googleFlights && (
                    <a
                      href={transit.deepLinks.googleFlights}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Đặt vé qua Google Flights"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted/70 px-3 py-1.5 text-foreground font-semibold transition-colors cursor-pointer text-xs shadow-2xs"
                    >
                      <Ticket className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>Đặt vé Google Flights</span>
                      <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                    </a>
                  )}
                  {transit.deepLinks?.traveloka && (
                    <a
                      href={transit.deepLinks.traveloka}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Đặt vé máy bay qua Traveloka"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/40 px-3 py-1.5 font-semibold transition-colors cursor-pointer text-xs shadow-2xs"
                    >
                      <Plane className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                      <span>Đặt vé Traveloka</span>
                      <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
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
                      aria-label="Đặt vé tàu hỏa qua VeXeRe"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/40 px-3 py-1.5 font-semibold transition-colors cursor-pointer text-xs shadow-2xs"
                    >
                      <Ticket className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                      <span>Vé tàu VeXeRe</span>
                      <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                    </a>
                  )}
                  {transit.deepLinks?.dsvn && (
                    <a
                      href={transit.deepLinks.dsvn}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Cổng đặt vé chính thức ĐSVN"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 px-3 py-1.5 font-semibold transition-colors cursor-pointer text-xs shadow-2xs"
                    >
                      <TrainFront className="size-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                      <span>Cổng ĐSVN (dsvn.vn)</span>
                      <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
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
                      aria-label="Đặt vé xe khách qua VeXeRe"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/40 px-3 py-1.5 font-semibold transition-colors cursor-pointer text-xs shadow-2xs"
                    >
                      <Bus className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                      <span>Đặt vé VeXeRe</span>
                      <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                    </a>
                  )}
                  {transit.deepLinks?.traveloka && (
                    <a
                      href={transit.deepLinks.traveloka}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Đặt vé xe khách qua Traveloka"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/40 px-3 py-1.5 font-semibold transition-colors cursor-pointer text-xs shadow-2xs"
                    >
                      <Bus className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                      <span>Vé xe Traveloka</span>
                      <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                    </a>
                  )}
                </>
              )}

              {(transit.mode === 'PERSONAL_CAR' || transit.mode === 'PERSONAL_MOTORBIKE') && (
                transit.deepLinks?.googleMaps && (
                  <a
                    href={transit.deepLinks.googleMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Xem lộ trình trên Google Maps"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-3 py-1.5 font-semibold transition-colors cursor-pointer text-xs shadow-2xs"
                  >
                    <MapPin className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>Xem lộ trình Google Maps</span>
                    <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                  </a>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog for Changing Transit Mode */}
      {isEditTransitOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card text-card-foreground rounded-2xl border border-border p-5 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300 flex items-center justify-center">
                  <ArrowLeftRight className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Sửa phương tiện di chuyển</h3>
                  <p className="text-[11px] text-muted-foreground">Chọn phương tiện cho chặng hành trình liên tỉnh</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTransitOpen(false)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
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
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 shadow-xs ring-1 ring-teal-500/20'
                        : 'border-border hover:bg-muted/60'
                    }`}
                  >
                    <div className="mt-0.5 p-1.5 rounded-lg bg-background border border-border/80 shrink-0">
                      {opt.icon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? 'text-teal-900 dark:text-teal-200' : 'text-foreground'}`}>
                          {opt.title}
                        </span>
                        {isSelected && (
                          <span className="size-4 rounded-full bg-teal-600 text-white flex items-center justify-center">
                            <Check className="size-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditTransitOpen(false)}
                disabled={isUpdatingTransitMode}
                className="px-3.5 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmChangeTransit}
                disabled={isUpdatingTransitMode || selectedTransitMode === transit?.mode}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingTransitMode ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <span>Xác nhận đổi</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          SCHEDULE BY DAY (Matches Figma Prompt Screen 2 Item 6)
          ───────────────────────────────────────────────────────────────── */}
      {numbered.map((day, dIdx) => {
        const dayColor = getDayColor(day.dayNumber);
        return (
          <div key={day.dayNumber} className="space-y-4">
            {/* Day Section Header */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <span className="size-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: dayColor }} />
                <span>
                  Ngày {day.dayNumber}: {formatDayFullDate(startDate, dIdx)}
                </span>
              </div>
              <div
                className="text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-2xs"
                style={{
                  color: dayColor,
                  backgroundColor: `${dayColor}15`,
                  borderColor: `${dayColor}40`,
                }}
              >
                {day.activities.length} điểm dừng
              </div>
            </div>

            {day.activities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                Chưa có dữ liệu địa điểm cho ngày này.
              </div>
            ) : (
              day.activities.map((act, idx) => {
                const isLast = idx === day.activities.length - 1;
                const imageUrl =
                  act.imageUrl ||
                  'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=400&q=80';

                const isSelected = act.placeId === selectedPlaceId;

                return (
                  <div key={act.placeId + idx} className="space-y-3">
                    {/* Destination Card matching Figma Prompt */}
                    <div
                      id={`itinerary-activity-${act.placeId}`}
                      onClick={() => onSelectPlace?.(act.placeId)}
                      onMouseEnter={() => onHoverPlace?.(act.placeId)}
                      onMouseLeave={() => onHoverPlace?.(null)}
                      className={`bg-white rounded-2xl border transition-all p-4 flex flex-col sm:flex-row gap-4 group cursor-pointer ${
                        isSelected
                          ? 'ring-2 shadow-md'
                          : 'border-slate-200/90 hover:shadow-xs'
                      }`}
                      style={isSelected ? { borderColor: dayColor, boxShadow: `0 0 0 2px ${dayColor}33` } : {}}
                    >
                      {/* Left: Thumbnail with Number badge */}
                      <div className="relative size-20 sm:size-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <img
                          src={imageUrl}
                          alt={act.placeName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span
                          className="absolute top-1.5 left-1.5 size-6 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: dayColor }}
                        >
                          {act.stopNumber}
                        </span>
                      </div>

                    {/* Middle: Details */}
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                              {act.startTime || '08:30'} – {act.endTime || '10:00'} (
                              {act.durationMinutes || 90} phút)
                            </span>
                            <span className="text-[11px] font-medium text-slate-500">
                              {act.categoryName || 'Tham quan'}
                            </span>
                            {renderActivityPriceBadge(act)}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">
                            {act.placeName}
                          </h3>
                        </div>

                        {/* Action Buttons: [Đổi điểm] [Xóa] */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSwapPlace?.(act.placeId, act);
                            }}
                            title="Đổi điểm tham quan hoặc quán ăn khác"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-500 hover:text-teal-700 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
                          >
                            <Sparkles className="size-3 text-teal-600" aria-hidden="true" />
                            <span>Đổi điểm</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePlace?.(act.placeId);
                            }}
                            title="Xóa điểm này khỏi lịch trình"
                            className="size-7 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Rating & Reviews & Hours */}
                      <div className="flex items-center gap-3 text-[11px] flex-wrap">
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                          <span>{(act.ratingAvg || 4.7).toFixed(1)}</span>
                          <span className="text-slate-400 font-normal">
                            ({act.reviewCount && act.reviewCount > 999 ? `${(act.reviewCount / 1000).toFixed(1)}k` : act.reviewCount || 120} đánh giá)
                          </span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <span className="text-emerald-700 font-medium text-[11px] inline-flex items-center gap-1">
                          <Check className="size-3 text-emerald-600" aria-hidden="true" />
                          <span>Đang mở cửa</span>
                        </span>
                      </div>

                      {/* AI Tip Callout Box */}
                      <div className="rounded-xl bg-amber-50/70 border border-amber-200/60 p-2 text-[11px] text-slate-700 flex items-start gap-1.5 leading-relaxed">
                        <Lightbulb className="size-3.5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>
                          <strong>Mẹo AI:</strong>{' '}
                          {act.notes ||
                            'Nên ghé mua vé tham quan quần thể di sản để vào thăm các công trình kiến trúc cổ kính.'}
                        </span>
                      </div>

                      {act.address && (
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <MapPin className="size-3 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{act.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Discrete Transit Connector between stops */}
                  {!isLast && (
                    <div className="pl-8 border-l-2 border-dashed border-teal-300 ml-5 py-1">
                      {renderIntracityTransitConnector(act)}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Add Stop Button for this Day */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onAddPlace?.(day.dayNumber)}
              className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/40 text-slate-600 hover:text-teal-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Thêm địa điểm vào Ngày {day.dayNumber}</span>
            </button>
          </div>
        </div>
      );
    })}
    </div>
  );
}

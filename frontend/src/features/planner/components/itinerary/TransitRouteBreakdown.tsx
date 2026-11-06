'use client';

import type { ReactNode } from 'react';
import {
  Plane,
  TrainFront,
  Bus,
  Car,
  AlertTriangle,
  ShieldAlert,
  Lightbulb,
  Layers,
  Ship,
} from 'lucide-react';
import type { IntercityTransit, TransitMode } from '@/types/itinerary';
import {
  TRANSIT_UI_CONFIG,
  cleanHubName,
  formatDuration,
  formatVnd,
} from '../../model/itinerary-format';

export { cleanHubName };

interface DirectModeTheme {
  icon: ReactNode;
  title: string;
  noteLabel: string;
  containerClass: string;
  headerClass: string;
  badgeClass: string;
  noteBoxClass: string;
  buildFallbackSteps: (ctx: {
    transit: IntercityTransit;
    cleanOrigin: string;
    cleanDest: string;
    durHours: number;
    durMinutes: number;
    priceOneWay: number;
  }) => string[];
}

const DIRECT_MODE_THEMES: Record<Exclude<TransitMode, 'PERSONAL_MOTORBIKE'>, DirectModeTheme> = {
  FLIGHT: {
    icon: <Plane className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />,
    title: 'LỘ TRÌNH HÀNG KHÔNG & XE TRUNG CHUYỂN SÂN BAY:',
    noteLabel: 'Gợi ý trung chuyển',
    containerClass:
      'border-teal-200 bg-teal-50/50 dark:border-teal-900/50 dark:bg-teal-950/20',
    headerClass: 'text-teal-900 dark:text-teal-200',
    badgeClass: 'bg-teal-600 text-white',
    noteBoxClass: 'border-teal-200/80 dark:border-teal-800/50',
    buildFallbackSteps: ({ transit, cleanOrigin, cleanDest, durMinutes, priceOneWay }) => {
      const transferKm =
        transit.destHub?.distanceKm || TRANSIT_UI_CONFIG.DEFAULT_AIRPORT_TRANSFER_KM;
      const transferMins = Math.max(
        TRANSIT_UI_CONFIG.DEFAULT_AIRPORT_TRANSFER_MINUTES,
        Math.round(transferKm * TRANSIT_UI_CONFIG.LOCAL_TRANSFER_MINS_PER_KM),
      );
      return [
        `Khởi hành từ ${cleanHubName(transit.originHub?.name || cleanOrigin)} ──> ${cleanHubName(transit.destHub?.name || cleanDest)} (~${formatDuration(durMinutes)}, ~${formatVnd(priceOneWay)}/vé)`,
        `Trung chuyển sân bay: Xe buýt sân bay / Taxi từ ${cleanHubName(transit.destHub?.name || 'sân bay')} về trung tâm ${cleanDest} (~${transferKm}km, ~${transferMins} phút)`,
      ];
    },
  },
  SLEEPER_BUS: {
    icon: <Bus className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />,
    title: 'CHI TIẾT CHẶNG XE KHÁCH & TRUNG CHUYỂN VỀ TRUNG TÂM:',
    noteLabel: 'Gợi ý',
    containerClass:
      'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20',
    headerClass: 'text-amber-900 dark:text-amber-200',
    badgeClass: 'bg-amber-600 text-white',
    noteBoxClass: 'border-amber-200/80 dark:border-amber-800/50',
    buildFallbackSteps: ({ transit, cleanOrigin, cleanDest, durHours, priceOneWay }) => [
      `Đón xe tại ${cleanHubName(transit.originHub?.name || `Bến xe tại ${cleanOrigin}`)} ──> ${cleanHubName(transit.destHub?.name || `Bến xe tại ${cleanDest}`)} (~${durHours} tiếng, ~${formatVnd(priceOneWay)}/vé)`,
      `Xe trung chuyển nhà xe hoặc Taxi đưa đón về trung tâm ${cleanDest}.`,
    ],
  },
  TRAIN: {
    icon: (
      <TrainFront className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
    ),
    title: 'CHI TIẾT TUYẾN ĐƯỜNG SẮT & TRUNG CHUYỂN VỀ TRUNG TÂM:',
    noteLabel: 'Gợi ý',
    containerClass:
      'border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20',
    headerClass: 'text-indigo-900 dark:text-indigo-200',
    badgeClass: 'bg-indigo-600 text-white',
    noteBoxClass: 'border-indigo-200/80 dark:border-indigo-800/50',
    buildFallbackSteps: ({ transit, cleanOrigin, cleanDest, durHours, priceOneWay }) => [
      `Tuyến tàu: ${cleanHubName(transit.originHub?.name || `Ga ${cleanOrigin}`)} ──> ${cleanHubName(transit.destHub?.name || `Ga ${cleanDest}`)} (~${durHours} tiếng, ~${formatVnd(priceOneWay)}/vé)`,
      `Đón Taxi / Grab từ nhà ga về khách sạn trung tâm ${cleanDest}.`,
    ],
  },
  PERSONAL_CAR: {
    icon: <Car className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />,
    title: 'LỘ TRÌNH Ô TÔ CÁ NHÂN / TỰ LÁI:',
    noteLabel: 'Chi tiết chi phí',
    containerClass:
      'border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20',
    headerClass: 'text-indigo-900 dark:text-indigo-200',
    badgeClass: 'bg-indigo-600 text-white',
    noteBoxClass: 'border-indigo-200/80 dark:border-indigo-800/50',
    buildFallbackSteps: ({ cleanOrigin, cleanDest, durHours, transit }) => [
      `Lộ trình cao tốc / quốc lộ từ ${cleanOrigin} ──> trung tâm ${cleanDest} (~${transit.distanceKm}km, ~${durHours} tiếng lái xe)`,
    ],
  },
};

interface Props {
  transit: IntercityTransit;
  originCity?: string;
  destCity?: string;
}

export default function TransitRouteBreakdown({
  transit,
  originCity,
  destCity,
}: Props) {
  const cleanOrigin = originCity || transit.originName;
  const cleanDest = destCity || transit.destName;
  const distKm = transit.distanceKm ?? 0;
  const durMinutes = transit.durationMinutes ?? 0;
  const durHours = Math.max(1, Math.round(durMinutes / 60));
  const priceOneWay = transit.estimatedPriceOneWay ?? 0;
  const routeSteps = transit.details?.routeSteps ?? [];

  // 1. Multi-Modal Connecting Route (Train/Flight/Bus + Connecting Bus or Island Ferry)
  if (transit.isMultiModal) {
    const isFerry = transit.transferLeg?.type === 'FERRY';
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-indigo-950/30 p-3.5 space-y-2.5 text-xs shadow-2xs">
        <div className="flex items-center justify-between font-bold text-indigo-950 dark:text-indigo-200 flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <Layers className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
            <span>LỘ TRÌNH NỐI CHẶNG &amp; TRUNG CHUYỂN THÔNG MINH:</span>
          </span>
          {transit.transferLeg && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 inline-flex items-center gap-1">
              {isFerry ? (
                <Ship className="size-3 shrink-0" aria-hidden="true" />
              ) : (
                <Bus className="size-3 shrink-0" aria-hidden="true" />
              )}
              <span>{isFerry ? 'Tàu cao tốc vượt biển' : 'Xe trung chuyển kết nối'}</span>
            </span>
          )}
        </div>

        {routeSteps.length > 0 && (
          <div className="space-y-1.5 text-foreground/90 leading-relaxed font-medium">
            {routeSteps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="size-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="flex-1">{cleanHubName(step)}</p>
              </div>
            ))}
          </div>
        )}

        {transit.transferLeg && (
          <div className="rounded-lg bg-card border border-indigo-200/80 dark:border-indigo-800/60 p-2.5 text-xs flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              {isFerry ? (
                <Ship className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
              ) : (
                <Bus className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
              )}
              <span className="font-bold text-foreground truncate">
                Chặng nối: {cleanHubName(transit.transferLeg.title)}
              </span>
            </div>
            <span className="font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
              ~{formatVnd(transit.transferLeg.estimatedPrice)}
            </span>
          </div>
        )}

        {transit.details?.notes && (
          <div className="bg-card/90 rounded-lg border border-indigo-200/60 dark:border-indigo-800/50 p-2.5 text-[11px] text-indigo-950 dark:text-indigo-200 flex items-start gap-2 shadow-2xs">
            <Lightbulb className="size-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Gợi ý kinh nghiệm:</strong> {cleanHubName(transit.details.notes)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 2. Personal Motorbike Road Trip + Safety Advisory
  if (transit.mode === 'PERSONAL_MOTORBIKE') {
    const isOverLimit = distKm > TRANSIT_UI_CONFIG.MOTORBIKE_SAFETY_LIMIT_KM;
    const fuelLiters =
      transit.details?.fuelLiters ??
      Number(
        (
          priceOneWay /
          (transit.details?.gasPricePerLiter || TRANSIT_UI_CONFIG.DEFAULT_GAS_PRICE_VND)
        ).toFixed(1),
      );

    return (
      <div
        className={`rounded-xl border p-3.5 space-y-2.5 text-xs shadow-2xs ${
          isOverLimit
            ? 'border-rose-300 bg-rose-50/80 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200'
            : 'border-amber-300 bg-amber-50/80 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
        }`}
      >
        <div className="font-bold flex items-center gap-1.5">
          {isOverLimit ? (
            <>
              <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
              <span>CẢNH BÁO AN TOÀN PHƯỢT XE MÁY ({cleanOrigin} ──&gt; {cleanDest}):</span>
            </>
          ) : (
            <>
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
              <span>LỘ TRÌNH PHƯỢT XE MÁY &amp; LƯU Ý AN TOÀN ({cleanOrigin} ──&gt; {cleanDest}):</span>
            </>
          )}
        </div>

        {isOverLimit ? (
          <div className="space-y-1.5 leading-relaxed font-medium">
            <p className="font-bold text-rose-800 dark:text-rose-300">
              CỰ LY QUÁ XA CHO XE MÁY (~{distKm} km, mất hơn {durHours} tiếng lái xe liên tục):
            </p>
            <p>
              Quãng đường {distKm} km bằng xe máy dễ gây kiệt sức và mất an toàn giao thông. Bạn nên ưu tiên chọn{' '}
              <strong>Xe khách giường nằm</strong> hoặc <strong>Máy bay</strong> để bảo đảm sức khỏe cho chuyến đi!
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 leading-relaxed font-medium">
            {(routeSteps.length > 0
              ? routeSteps
              : [
                  `Cung đường phượt xe máy: Từ ${cleanOrigin} ──> ${cleanDest} (~${distKm} km, dự kiến ~${durHours} tiếng lái xe).`,
                  `Chi phí xăng xe ước tính: ~${formatVnd(priceOneWay)} (khoảng ${fuelLiters} lít xăng RON95).`,
                ]
            ).map((step, idx) => (
              <p key={idx}>
                {idx + 1}. {step}
              </p>
            ))}
          </div>
        )}

        {transit.details?.notes && (
          <div className="bg-card/90 rounded-lg border border-amber-200/80 dark:border-amber-800/50 p-2.5 text-[11px] flex items-start gap-2 shadow-2xs">
            <Lightbulb className="size-3.5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Khuyến nghị:</strong> {transit.details.notes}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 3. Unified Direct Mode Renderer (FLIGHT, SLEEPER_BUS, TRAIN, PERSONAL_CAR)
  const theme = DIRECT_MODE_THEMES[transit.mode] ?? DIRECT_MODE_THEMES.FLIGHT;
  const stepsToRender =
    routeSteps.length > 0
      ? routeSteps
      : theme.buildFallbackSteps({
          transit,
          cleanOrigin,
          cleanDest,
          durHours,
          durMinutes,
          priceOneWay,
        });

  return (
    <div className={`rounded-xl border p-3.5 space-y-2.5 text-xs shadow-2xs ${theme.containerClass}`}>
      <div className={`font-bold flex items-center gap-1.5 ${theme.headerClass}`}>
        {theme.icon}
        <span>{theme.title}</span>
      </div>
      <div className="space-y-1.5 text-foreground/90 leading-relaxed font-medium">
        {stepsToRender.map((step, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span
              className={`size-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${theme.badgeClass}`}
            >
              {idx + 1}
            </span>
            <p className="flex-1">{cleanHubName(step)}</p>
          </div>
        ))}
      </div>
      {transit.details?.notes && (
        <div
          className={`bg-card rounded-lg border p-2.5 text-[11px] text-foreground/85 flex items-start gap-2 shadow-2xs ${theme.noteBoxClass}`}
        >
          <Lightbulb className="size-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>{theme.noteLabel}:</strong> {cleanHubName(transit.details.notes)}
          </span>
        </div>
      )}
    </div>
  );
}


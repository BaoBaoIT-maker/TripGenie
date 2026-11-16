'use client';

import type { ReactNode } from 'react';
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
    icon: <i className="fa-solid fa-plane text-[#0194F3] text-sm shrink-0" aria-hidden="true" />,
    title: 'Chặng bay & xe trung chuyển',
    buildFallbackSteps: ({ transit, cleanOrigin, cleanDest, durMinutes, priceOneWay }) => {
      const transferKm =
        transit.destHub?.distanceKm || TRANSIT_UI_CONFIG.DEFAULT_AIRPORT_TRANSFER_KM;
      const transferMins = Math.max(
        TRANSIT_UI_CONFIG.DEFAULT_AIRPORT_TRANSFER_MINUTES,
        Math.round(transferKm * TRANSIT_UI_CONFIG.LOCAL_TRANSFER_MINS_PER_KM),
      );
      return [
        `Chặng bay: ${cleanHubName(transit.originHub?.name || cleanOrigin)} → ${cleanHubName(transit.destHub?.name || cleanDest)} (~${formatDuration(durMinutes)}, ~${formatVnd(priceOneWay)}/vé)`,
        `Xe trung chuyển: Taxi / Buýt sân bay về trung tâm ${cleanDest} (~${transferKm} km, ~${transferMins} phút)`,
      ];
    },
  },
  SLEEPER_BUS: {
    icon: <i className="fa-solid fa-bus text-amber-600 text-sm shrink-0" aria-hidden="true" />,
    title: 'Chặng xe khách liên tỉnh',
    buildFallbackSteps: ({ transit, cleanOrigin, cleanDest, durHours, priceOneWay }) => [
      `Chặng xe: ${cleanHubName(transit.originHub?.name || `Bến xe ${cleanOrigin}`)} → ${cleanHubName(transit.destHub?.name || `Bến xe ${cleanDest}`)} (~${durHours} tiếng, ~${formatVnd(priceOneWay)}/vé)`,
      `Xe trung chuyển: Nhà xe hoặc Taxi đưa đón về trung tâm ${cleanDest}`,
    ],
  },
  TRAIN: {
    icon: <i className="fa-solid fa-train text-[#0194F3] text-sm shrink-0" aria-hidden="true" />,
    title: 'Tuyến tàu hỏa & ga đến',
    buildFallbackSteps: ({ transit, cleanOrigin, cleanDest, durHours, priceOneWay }) => [
      `Tuyến tàu: ${cleanHubName(transit.originHub?.name || `Ga ${cleanOrigin}`)} → ${cleanHubName(transit.destHub?.name || `Ga ${cleanDest}`)} (~${durHours} tiếng, ~${formatVnd(priceOneWay)}/vé)`,
      `Xe trung chuyển: Taxi / Xe ôm công nghệ từ ga về trung tâm ${cleanDest}`,
    ],
  },
  PERSONAL_CAR: {
    icon: <i className="fa-solid fa-car text-[#0194F3] text-sm shrink-0" aria-hidden="true" />,
    title: 'Lộ trình ô tô tự lái',
    buildFallbackSteps: ({ cleanOrigin, cleanDest, durHours, transit }) => [
      `Lộ trình cao tốc / quốc lộ: ${cleanOrigin} → trung tâm ${cleanDest} (~${transit.distanceKm} km, ~${durHours} tiếng)`,
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
      <div className="rounded-xl border border-[#D0E7FF] bg-[#F0F7FF] p-3.5 space-y-2.5 text-xs shadow-2xs">
        <div className="flex items-center justify-between font-bold text-[#10243A] flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <i className="fa-solid fa-route text-[#0194F3] text-sm shrink-0" aria-hidden="true" />
            <span>Lộ trình nối chặng liên tỉnh</span>
          </span>
          {transit.transferLeg && (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#E1EFFF] text-[#0194F3] inline-flex items-center gap-1.5 border border-[#D0E7FF]">
              {isFerry ? (
                <i className="fa-solid fa-ship text-[11px] shrink-0" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-bus text-[11px] shrink-0" aria-hidden="true" />
              )}
              <span>{isFerry ? 'Tàu cao tốc' : 'Xe trung chuyển'}</span>
            </span>
          )}
        </div>

        {routeSteps.length > 0 && (
          <div className="space-y-1.5 text-slate-700 leading-relaxed font-medium">
            {routeSteps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="size-4 rounded-full bg-white text-[#0194F3] border border-[#D0E7FF] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  {idx + 1}
                </span>
                <p className="flex-1 text-slate-800 font-semibold">{cleanHubName(step)}</p>
              </div>
            ))}
          </div>
        )}

        {transit.transferLeg && (
          <div className="rounded-lg bg-white border border-[#D0E7FF] p-2.5 text-xs flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              {isFerry ? (
                <i className="fa-solid fa-ship text-[#0194F3] text-xs shrink-0" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-bus text-[#0194F3] text-xs shrink-0" aria-hidden="true" />
              )}
              <span className="font-bold text-[#10243A] truncate">
                {cleanHubName(transit.transferLeg.title)}
              </span>
            </div>
            <span className="font-bold text-[#0194F3] shrink-0">
              ~{formatVnd(transit.transferLeg.estimatedPrice)}
            </span>
          </div>
        )}

        {transit.details?.notes && (
          <div className="rounded-lg bg-white/90 border border-[#D0E7FF] p-2.5 text-xs text-slate-700 flex items-start gap-2 shadow-2xs">
            <i className="fa-solid fa-circle-info text-[#0194F3] text-sm shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong className="text-[#10243A]">Lưu ý:</strong> {cleanHubName(transit.details.notes)}
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
        className={`rounded-xl border p-3.5 space-y-2 text-xs shadow-2xs ${
          isOverLimit
            ? 'border-amber-200 bg-amber-50/90'
            : 'border-[#D0E7FF] bg-[#F0F7FF]'
        }`}
      >
        <div className="flex items-center justify-between font-bold">
          <div className="flex items-center gap-1.5">
            {isOverLimit ? (
              <i className="fa-solid fa-triangle-exclamation text-amber-500 text-sm shrink-0" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-car text-[#0194F3] text-sm shrink-0" aria-hidden="true" />
            )}
            <span className={isOverLimit ? 'text-amber-950 font-bold' : 'text-[#10243A] font-bold'}>
              {isOverLimit ? 'Lưu ý cự ly phượt đường bộ' : `Lộ trình phượt đường bộ (${cleanOrigin} → ${cleanDest})`}
            </span>
          </div>
          {distKm > 0 && (
            <span className={`text-xs font-semibold ${isOverLimit ? 'text-amber-800' : 'text-slate-600'}`}>
              ~{distKm} km • ~{durHours} tiếng
            </span>
          )}
        </div>

        {isOverLimit ? (
          <div className="space-y-1.5 text-xs">
            <p className="text-amber-900 leading-relaxed font-medium">
              Cự ly ~{distKm} km mất hơn {durHours} tiếng lái xe liên tục. Bạn nên cân nhắc lựa chọn <strong>Xe khách giường nằm</strong> hoặc <strong>Máy bay</strong> để đảm bảo an toàn và sức khỏe.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 text-slate-700 leading-relaxed font-medium">
            {(routeSteps.length > 0
              ? routeSteps
              : [
                  `Cung đường: ${cleanOrigin} → ${cleanDest} (~${distKm} km, ~${durHours} tiếng)`,
                  `Nhiên liệu ước tính: ~${formatVnd(priceOneWay)} (~${fuelLiters} lít xăng)`,
                ]
            ).map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="size-4 rounded-full bg-white text-[#0194F3] border border-[#D0E7FF] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  {idx + 1}
                </span>
                <p className="flex-1 text-slate-800 font-semibold">{step}</p>
              </div>
            ))}
          </div>
        )}

        {transit.details?.notes && (
          <div
            className={`rounded-lg border p-2.5 text-xs flex items-start gap-2 shadow-2xs ${
              isOverLimit
                ? 'bg-white/90 border-amber-200/80 text-amber-950'
                : 'bg-white/90 border-[#D0E7FF] text-slate-700'
            }`}
          >
            <i
              className={`text-sm shrink-0 mt-0.5 ${
                isOverLimit
                  ? 'fa-solid fa-triangle-exclamation text-amber-500'
                  : 'fa-solid fa-circle-info text-[#0194F3]'
              }`}
              aria-hidden="true"
            />
            <span>
              <strong className="font-bold">Khuyến nghị:</strong> {transit.details.notes}
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
    <div className="rounded-xl border border-[#D0E7FF] bg-[#F0F7FF] p-3.5 space-y-2.5 text-xs shadow-2xs">
      <div className="flex items-center justify-between font-semibold text-slate-900">
        <div className="flex items-center gap-1.5">
          {theme.icon}
          <span className="font-semibold text-slate-900">{theme.title}</span>
        </div>
        <div className="text-xs font-semibold text-slate-600">
          {distKm > 0 && `~${distKm} km`}
          {distKm > 0 && durMinutes > 0 && ' • '}
          {durMinutes > 0 && `~${formatDuration(durMinutes)}`}
        </div>
      </div>

      <div className="space-y-1.5 leading-relaxed font-medium">
        {stepsToRender.map((step, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="size-4 rounded-full bg-white text-[#0194F3] border border-[#D0E7FF] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              {idx + 1}
            </span>
            <p className="flex-1 text-slate-700 font-medium">{cleanHubName(step)}</p>
          </div>
        ))}
      </div>

      {transit.details?.notes && (
        <div className="rounded-lg bg-white/90 border border-[#D0E7FF] p-2.5 text-xs text-slate-700 flex items-start gap-2 shadow-2xs">
          <i className="fa-solid fa-circle-info text-[#0194F3] text-sm shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong className="text-[#10243A]">Lưu ý:</strong> {cleanHubName(transit.details.notes)}
          </span>
        </div>
      )}
    </div>
  );
}

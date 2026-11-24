'use client';

import { useState } from 'react';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { useI18n } from '@/i18n';
import { useActivityAlternatives } from '../../hooks/use-itinerary-planner';
import { ModalCopilotAssist } from './ModalCopilotAssist';
import type { ItineraryActivity, AlternativePlaceItem } from '@/types/itinerary';

interface Props {
  itineraryId: string;
  activity: ItineraryActivity | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectAlternative: (newPlaceId: string) => Promise<void>;
  onAskCopilot: (promptOrPlaceName: string) => void;
  canEdit?: boolean;
  isMemberOrOwner?: boolean;
  onProposeAlternative?: (newPlaceId: string) => Promise<void>;
}

export default function PlaceAlternativesModal({
  itineraryId,
  activity,
  isOpen,
  onClose,
  onSelectAlternative,
  onAskCopilot,
  canEdit = true,
  isMemberOrOwner = false,
  onProposeAlternative,
}: Props) {
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);

  const destinationId = activity?.id || activity?.placeId || null;
  const { data: alternatives, isLoading, error } = useActivityAlternatives(
    itineraryId,
    isOpen ? destinationId : null,
  );

  const handleDirectSwap = async (alt: AlternativePlaceItem) => {
    try {
      setBusyId(alt.id);
      await onSelectAlternative(alt.id);
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const handlePropose = async (alt: AlternativePlaceItem) => {
    if (!onProposeAlternative) return;
    try {
      setBusyId(`vote-${alt.id}`);
      await onProposeAlternative(alt.id);
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppModalPortal
      open={isOpen && Boolean(activity)}
      onClose={onClose}
      ariaLabelledBy="place-alternatives-title"
      maxWidthClass="max-w-lg"
      dialogClassName="flex flex-col max-h-[86vh]"
      disableClose={busyId !== null}
      mobileBottomSheet
    >
      {activity && (
        <>
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center shrink-0">
                <i className="fa-solid fa-right-left text-sm" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 id="place-alternatives-title" className="text-sm font-bold text-slate-900 leading-tight">
                  {t('planner.alternatives.title')}
                </h3>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {t('planner.alternatives.replacing')}{' '}
                  <span className="font-semibold text-slate-700">{activity.placeName}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={busyId !== null}
              aria-label={t('planner.common.closeDialog')}
              className="size-8 rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            >
              <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
            </button>
          </div>

          {/* Content list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-white text-xs">
            {isLoading && (
              <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500">
                <i className="fa-solid fa-circle-notch fa-spin text-xl text-[#0194F3]" aria-hidden="true" />
                <p className="text-xs font-medium">{t('planner.alternatives.loading')}</p>
              </div>
            )}

            {!isLoading && error && (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <i className="fa-solid fa-circle-exclamation text-xl text-rose-500" aria-hidden="true" />
                <p className="text-xs font-medium">{t('planner.alternatives.error')}</p>
              </div>
            )}

            {!isLoading && !error && alternatives && alternatives.length === 0 && (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <i className="fa-solid fa-utensils text-2xl text-slate-300" aria-hidden="true" />
                <p className="text-xs font-semibold text-slate-700">
                  {t('planner.alternatives.emptyTitle')}
                </p>
                <p className="text-[11px] text-slate-400">
                  {t('planner.alternatives.emptyDesc')}
                </p>
              </div>
            )}

            {!isLoading &&
              alternatives?.map((alt) => (
                <div
                  key={alt.id}
                  className="group p-3 rounded-xl border border-slate-200 hover:border-[#0194F3]/60 hover:bg-[#F5F9FF]/40 transition-colors flex items-center gap-3 bg-white"
                >
                  {/* Thumbnail */}
                  <div className="relative size-16 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                    {alt.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={alt.imageUrl}
                        alt={alt.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <i className="fa-solid fa-location-dot text-slate-400 text-base" aria-hidden="true" />
                    )}
                    {alt.distanceKm != null && (
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-[10px] font-bold text-white tabular-nums">
                        {alt.distanceKm}km
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-[#F0F7FF] text-[#0194F3] font-bold text-[10px]">
                        {alt.categoryName}
                      </span>
                      {alt.ratingAvg > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-amber-600 font-bold text-[11px] tabular-nums">
                          <i className="fa-solid fa-star text-[10px] text-amber-500" aria-hidden="true" />
                          <span>{alt.ratingAvg.toFixed(1)}</span>
                        </span>
                      )}
                      {alt.reviewCount > 0 && (
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          ({alt.reviewCount})
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-[#10243A] truncate group-hover:text-[#0194F3] transition-colors">
                      {alt.name}
                    </h4>

                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                      <i className="fa-solid fa-location-dot text-[10px] text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{alt.address}</span>
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {canEdit && (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => handleDirectSwap(alt)}
                        className="h-8 px-3 rounded-lg bg-[#0194F3] hover:bg-[#007AD0] disabled:opacity-50 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        {busyId === alt.id ? (
                          <i className="fa-solid fa-circle-notch fa-spin text-[11px]" aria-hidden="true" />
                        ) : (
                          <i className="fa-solid fa-check text-[11px]" aria-hidden="true" />
                        )}
                        <span>{t('planner.alternatives.swapNow')}</span>
                      </button>
                    )}

                    {isMemberOrOwner && onProposeAlternative && (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => handlePropose(alt)}
                        className={`h-8 px-2.5 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer inline-flex items-center justify-center gap-1 disabled:opacity-50 ${
                          canEdit
                            ? 'border border-slate-200 bg-white hover:bg-[#F0F7FF] text-[#10243A] hover:text-[#0194F3]'
                            : 'bg-[#0194F3] hover:bg-[#007AD0] text-white font-bold'
                        }`}
                      >
                        {busyId === `vote-${alt.id}` ? (
                          <i className="fa-solid fa-circle-notch fa-spin text-[11px]" aria-hidden="true" />
                        ) : (
                          <i className="fa-solid fa-check-to-slot text-[11px]" aria-hidden="true" />
                        )}
                        <span>
                          {canEdit
                            ? t('planner.alternatives.openVote')
                            : t('planner.alternatives.proposeSwap')}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Shared Copilot Assist Footer */}
          <div className="p-4 border-t border-slate-100 bg-white shrink-0">
            <ModalCopilotAssist
              context="swap"
              placeName={activity.placeName}
              canEdit={canEdit}
              onAskCopilot={(prompt) => {
                onClose();
                onAskCopilot(prompt);
              }}
            />
          </div>
        </>
      )}
    </AppModalPortal>
  );
}

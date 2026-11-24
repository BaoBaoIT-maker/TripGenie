'use client';

import { useEffect, useState } from 'react';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { useI18n } from '@/i18n';
import { placeService } from '@/services/place.service';
import type { Place } from '@/types/place';
import { TRIP_COMPANIONS_CONFIG } from '../config/trip-companions.config';

export type PlaceSearchMode = 'add' | 'propose-new' | 'propose-swap';

interface PlaceSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlace: (place: Place) => void | Promise<void>;
  mode?: PlaceSearchMode;
  days?: Array<{ dayNumber: number; theme?: string | null }>;
  selectedDayNumber?: number;
  onChangeDayNumber?: (day: number) => void;
  targetStopName?: string;
  destinationCity?: string | null;
  onProposePlace?: (payload: {
    place: Place;
    dayNumber: number;
    proposedStartTime?: string;
    notes?: string;
  }) => Promise<void>;
  isSubmittingProposal?: boolean;
  copilotAssist?: React.ReactNode;
}

const MODAL_ICONS: Record<PlaceSearchMode, string> = {
  add: 'fa-solid fa-location-dot',
  'propose-new': 'fa-solid fa-check-to-slot',
  'propose-swap': 'fa-solid fa-right-left',
};

export function PlaceSearchDialog({
  open,
  onOpenChange,
  onSelectPlace,
  mode = 'add',
  days,
  selectedDayNumber = 1,
  onChangeDayNumber,
  targetStopName,
  destinationCity,
  onProposePlace,
  isSubmittingProposal = false,
  copilotAssist,
}: PlaceSearchDialogProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectingId, setIsSelectingId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  // Proposal composer state (used only when mode !== 'add')
  const [chosenPlace, setChosenPlace] = useState<Place | null>(null);
  const [proposedStartTime, setProposedStartTime] = useState('');
  const [notes, setNotes] = useState('');

  const isProposeMode = mode !== 'add';
  const modalIcon = MODAL_ICONS[mode];
  const modalTitle =
    mode === 'add'
      ? t('planner.placeSearch.addTitle')
      : mode === 'propose-new'
        ? t('planner.placeSearch.proposeNewTitle')
        : t('planner.placeSearch.proposeSwapTitle');
  const modalSubtitle =
    mode === 'add'
      ? t('planner.placeSearch.addSubtitle', { day: selectedDayNumber })
      : mode === 'propose-new'
        ? t('planner.placeSearch.proposeNewSubtitle', { day: selectedDayNumber })
        : t('planner.placeSearch.proposeSwapSubtitle', {
            stopName: targetStopName || t('planner.placeSearch.currentStopFallback'),
          });

  const handleClose = () => {
    if (isSubmittingProposal || isSelectingId) return;
    setQuery('');
    setPlaces([]);
    setHasError(false);
    setChosenPlace(null);
    setProposedStartTime('');
    setNotes('');
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;

    let active = true;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const keyword = query.trim() || destinationCity?.trim() || undefined;
        const results = await placeService.getPlaces({ keyword });
        if (active) {
          setPlaces(Array.isArray(results) ? results : []);
        }
      } catch {
        if (active) {
          setHasError(true);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open, destinationCity, retryNonce]);

  const handlePickPlace = async (place: Place) => {
    if (isProposeMode) {
      setChosenPlace((prev) => (prev?.id === place.id ? null : place));
      return;
    }

    try {
      setIsSelectingId(place.id);
      await onSelectPlace(place);
      handleClose();
    } finally {
      setIsSelectingId(null);
    }
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosenPlace || !onProposePlace) return;
    await onProposePlace({
      place: chosenPlace,
      dayNumber: selectedDayNumber,
      proposedStartTime: proposedStartTime.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    handleClose();
  };

  return (
    <AppModalPortal
      open={open}
      onClose={handleClose}
      ariaLabelledBy="place-search-dialog-title"
      maxWidthClass="max-w-2xl"
      dialogClassName="max-h-[88vh] flex flex-col"
      disableClose={isSubmittingProposal || Boolean(isSelectingId)}
      mobileBottomSheet
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/70 shrink-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="size-9 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center shrink-0">
            <i className={`${modalIcon} text-sm`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="place-search-dialog-title" className="text-sm font-bold text-[#10243A]">
              {modalTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{modalSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmittingProposal || Boolean(isSelectingId)}
          aria-label={t('planner.placeSearch.closeAria')}
          className="size-8 rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
        </button>
      </div>

      {/* Search bar + Optional Day Switcher */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100 space-y-2.5 shrink-0 bg-white">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <i
              className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('planner.placeSearch.searchPlaceholder')}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3] transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('planner.placeSearch.clearQueryAria')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-[10px]" aria-hidden="true" />
              </button>
            )}
          </div>

          {days && days.length > 1 && mode !== 'propose-swap' && onChangeDayNumber && (
            <select
              aria-label={t('planner.placeSearch.daySelectAria')}
              value={selectedDayNumber}
              onChange={(e) => onChangeDayNumber(Number(e.target.value))}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3] shrink-0"
            >
              {days.map((d) => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  {t('planner.common.day', { n: d.dayNumber })}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto min-h-[220px] p-4 space-y-2 bg-white">
        {isLoading && (
          <div className="space-y-2.5 py-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-18 rounded-xl bg-slate-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {hasError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-2.5 text-rose-600">
            <i className="fa-solid fa-circle-exclamation text-2xl" aria-hidden="true" />
            <p className="text-xs font-semibold">{t('planner.placeSearch.loadError')}</p>
            <button
              type="button"
              onClick={() => setRetryNonce((n) => n + 1)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              {t('planner.common.retry')}
            </button>
          </div>
        )}

        {!isLoading && !hasError && places.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500 space-y-1.5">
            <i className="fa-solid fa-location-dot text-2xl text-slate-300" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-800">
              {t('planner.placeSearch.emptyTitle')}
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs">
              {t('planner.placeSearch.emptyDesc')}
            </p>
          </div>
        )}

        {!isLoading &&
          !hasError &&
          places.map((place) => {
            const isSelected = isProposeMode && chosenPlace?.id === place.id;
            const isBusy = isSelectingId === place.id;

            return (
              <button
                key={place.id}
                type="button"
                disabled={Boolean(isSelectingId) || isSubmittingProposal}
                onClick={() => handlePickPlace(place)}
                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-colors group cursor-pointer disabled:opacity-60 ${
                  isSelected
                    ? 'border-[#0194F3] bg-[#F0F7FF]'
                    : 'border-slate-200/80 hover:border-[#0194F3]/50 hover:bg-[#F5F9FF]'
                }`}
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 flex items-center justify-center">
                  {place.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={place.coverImage}
                      alt={place.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <i className="fa-solid fa-location-dot text-slate-400 text-sm" aria-hidden="true" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs sm:text-[13px] font-bold text-[#10243A] truncate group-hover:text-[#0194F3] transition-colors">
                      {place.name}
                    </h4>
                    {place.rating != null && place.rating > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 shrink-0 tabular-nums">
                        <i className="fa-solid fa-star text-[10px] text-amber-500" aria-hidden="true" />
                        <span>{place.rating}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 truncate">
                    {place.address || place.city}
                  </p>

                  <span className="inline-block text-[10px] font-semibold text-[#0194F3] bg-[#F0F7FF] px-2 py-0.5 rounded-md">
                    {place.categoryLabel || place.category}
                  </span>
                </div>

                <span className="shrink-0 text-[11px] font-bold text-[#0194F3] px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 group-hover:border-[#0194F3]/40">
                  {isBusy ? (
                    <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
                  ) : isSelected ? (
                    <i className="fa-solid fa-check" aria-hidden="true" />
                  ) : isProposeMode ? (
                    t('planner.common.select')
                  ) : (
                    t('planner.common.add')
                  )}
                </span>
              </button>
            );
          })}
      </div>

      {/* Inline Proposal Composer when in propose-new / propose-swap mode and place is selected */}
      {isProposeMode && chosenPlace && (
        <form
          onSubmit={handleSubmitProposal}
          className="px-5 py-3.5 border-t border-[#D0E7FF] bg-[#F5F9FF] space-y-3 shrink-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-xs">
              <span className="text-slate-500">{t('planner.placeSearch.selectedProposal')} </span>
              <strong className="text-[#10243A] font-bold">{chosenPlace.name}</strong>
            </div>
            <button
              type="button"
              onClick={() => setChosenPlace(null)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
            >
              {t('planner.placeSearch.reselect')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {mode === 'propose-new' && (
              <div>
                <label htmlFor="proposal-start-time" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t('planner.placeSearch.proposedTimeLabel')}
                </label>
                <input
                  id="proposal-start-time"
                  type="time"
                  value={proposedStartTime}
                  onChange={(e) => setProposedStartTime(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30"
                />
              </div>
            )}
            <div className={mode === 'propose-new' ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="proposal-notes-input" className="text-[11px] font-semibold text-slate-700">
                  {t('planner.placeSearch.reasonLabel')}
                </label>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {notes.length}/{TRIP_COMPANIONS_CONFIG.PROPOSAL_NOTES_MAX_LENGTH}
                </span>
              </div>
              <input
                id="proposal-notes-input"
                type="text"
                maxLength={TRIP_COMPANIONS_CONFIG.PROPOSAL_NOTES_MAX_LENGTH}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('planner.placeSearch.reasonPlaceholder')}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmittingProposal}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmittingProposal}
              className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingProposal ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-paper-plane text-xs" aria-hidden="true" />
              )}
              <span>
                {isSubmittingProposal
                  ? t('planner.placeSearch.sending')
                  : t('planner.placeSearch.submitProposal')}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Optional Copilot Assist Footer */}
      {copilotAssist && !chosenPlace && (
        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
          {copilotAssist}
        </div>
      )}
    </AppModalPortal>
  );
}

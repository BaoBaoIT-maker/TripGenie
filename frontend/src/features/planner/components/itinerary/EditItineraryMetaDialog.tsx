'use client';

import { useState } from 'react';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { useI18n } from '@/i18n';
import { ITINERARY_META_LIMITS } from '../../constants/itinerary.constants';
import { MANUAL_MAX_TRIP_DAYS } from '../../config/itinerary-wizard-options';
import type { UpdateItineraryMetaRequest } from '@/types/itinerary';

type MetaErrorKey = 'errEmptyTitle' | 'errInvalidDates' | 'errEndBeforeStart' | 'errMaxDays';

interface EditItineraryMetaDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalDays: number;
  onSubmit: (dto: UpdateItineraryMetaRequest) => Promise<void>;
  isSubmitting?: boolean;
  onAskCopilot?: (prompt: string) => void;
}

interface EditMetaFormProps {
  initialTitle: string;
  initialDescription: string;
  initialStartDate: string;
  initialEndDate: string;
  initialTotalDays: number;
  onClose: () => void;
  onSubmit: (dto: UpdateItineraryMetaRequest) => Promise<void>;
  isSubmitting: boolean;
  onAskCopilot?: (prompt: string) => void;
}

function toDateInputString(dateStr?: string | null): string {
  if (!dateStr) return '';
  // Handles ISO date strings like "2025-11-20T00:00:00.000Z" or "2025-11-20"
  return dateStr.slice(0, 10);
}

function calculateSpanDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return null;
  return Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function EditMetaForm({
  initialTitle,
  initialDescription,
  initialStartDate,
  initialEndDate,
  initialTotalDays,
  onClose,
  onSubmit,
  isSubmitting,
  onAskCopilot,
}: EditMetaFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [dayShiftMode, setDayShiftMode] = useState<'merge' | 'trim'>('merge');
  const [expandAction, setExpandAction] = useState<'copilot' | 'manual'>('copilot');
  const [confirmStep, setConfirmStep] = useState<'reduce' | 'expand' | null>(null);
  const [errorKey, setErrorKey] = useState<MetaErrorKey | null>(null);

  const calculatedNewDays = calculateSpanDays(startDate, endDate) ?? initialTotalDays;
  const hasDaysChanged =
    startDate &&
    endDate &&
    (startDate !== initialStartDate || endDate !== initialEndDate) &&
    calculatedNewDays !== initialTotalDays;

  const handleValidateAndProceed = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorKey('errEmptyTitle');
      return;
    }

    if (startDate && endDate) {
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        setErrorKey('errInvalidDates');
        return;
      }
      if (d2 < d1) {
        setErrorKey('errEndBeforeStart');
        return;
      }
      const days = calculateSpanDays(startDate, endDate) || 1;
      if (days > MANUAL_MAX_TRIP_DAYS) {
        setErrorKey('errMaxDays');
        return;
      }

      if (days < initialTotalDays) {
        setErrorKey(null);
        setConfirmStep('reduce');
        return;
      }

      if (days > initialTotalDays) {
        setErrorKey(null);
        setConfirmStep('expand');
        return;
      }
    }

    setErrorKey(null);
    void executeSave();
  };

  const executeSave = async (options?: {
    customShiftMode?: 'merge' | 'trim';
    triggerCopilotExpand?: boolean;
  }) => {
    const trimmedTitle = title.trim();
    const resolvedShiftMode = options?.customShiftMode ?? dayShiftMode;

    await onSubmit({
      title: trimmedTitle,
      description: description.trim(),
      ...(startDate && endDate
        ? {
            startDate,
            endDate,
            dayShiftMode: resolvedShiftMode,
          }
        : {}),
    });

    onClose();

    if (options?.triggerCopilotExpand && onAskCopilot) {
      const prompt = t('planner.editMeta.copilotExpandPrompt', {
        newDays: calculatedNewDays,
        fromDay: initialTotalDays + 1,
      });
      onAskCopilot(prompt);
    }
  };

  return (
    <form onSubmit={handleValidateAndProceed} className="flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center shrink-0">
            <i className="fa-solid fa-pen-to-square text-sm" aria-hidden="true" />
          </div>
          <div>
            <h2 id="edit-meta-title" className="text-sm font-bold text-slate-900">
              {confirmStep === 'reduce'
                ? t('planner.editMeta.titleReduce')
                : confirmStep === 'expand'
                  ? t('planner.editMeta.titleExpand')
                  : t('planner.editMeta.titleDefault')}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {confirmStep
                ? t('planner.editMeta.subtitleConfirm')
                : t('planner.editMeta.subtitleDefault')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label={t('planner.common.closeDialog')}
          className="size-8 rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
        </button>
      </div>

      {/* Confirmation Step: Reduce days */}
      {confirmStep === 'reduce' && (
        <div className="p-5 space-y-4 text-xs">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5 text-amber-900">
            <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-bold leading-snug">
                {t('planner.editMeta.reduceHeading', {
                  oldDays: initialTotalDays,
                  newDays: calculatedNewDays,
                })}
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {t('planner.editMeta.reduceDesc', {
                  fromDay: calculatedNewDays + 1,
                  toDay: initialTotalDays,
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                dayShiftMode === 'merge'
                  ? 'border-[#0194F3] bg-[#F5F9FF] ring-2 ring-[#0194F3]/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="dayShiftMode"
                value="merge"
                checked={dayShiftMode === 'merge'}
                onChange={() => setDayShiftMode('merge')}
                className="mt-0.5 text-[#0194F3] focus:ring-[#0194F3]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[#10243A]">
                    {t('planner.editMeta.mergeTitle')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {t('planner.editMeta.mergeBadge')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {t('planner.editMeta.mergeDesc', {
                    fromDay: calculatedNewDays + 1,
                    toDay: initialTotalDays,
                    targetDay: calculatedNewDays,
                  })}
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                dayShiftMode === 'trim'
                  ? 'border-rose-400 bg-rose-50/50 ring-2 ring-rose-400/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="dayShiftMode"
                value="trim"
                checked={dayShiftMode === 'trim'}
                onChange={() => setDayShiftMode('trim')}
                className="mt-0.5 text-rose-600 focus:ring-rose-500"
              />
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-900">{t('planner.editMeta.trimTitle')}</span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {t('planner.editMeta.trimDesc', {
                    fromDay: calculatedNewDays + 1,
                    toDay: initialTotalDays,
                  })}
                </p>
              </div>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setConfirmStep(null)}
              disabled={isSubmitting}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              {t('planner.editMeta.backToEdit')}
            </button>
            <button
              type="button"
              onClick={() => void executeSave()}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-check text-xs" aria-hidden="true" />
              )}
              <span>{t('planner.editMeta.confirmShiftDays')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Step: Expand days */}
      {confirmStep === 'expand' && (
        <div className="p-5 space-y-4 text-xs">
          <div className="rounded-xl border border-[#D0E7FF] bg-[#F5F9FF] p-3.5 flex items-start gap-2.5 text-[#10243A]">
            <i className="fa-solid fa-calendar-plus text-[#0194F3] text-sm mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-bold leading-snug">
                {t('planner.editMeta.expandHeading', {
                  oldDays: initialTotalDays,
                  newDays: calculatedNewDays,
                })}
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {t('planner.editMeta.expandDesc', {
                  fromDay: initialTotalDays + 1,
                  toDay: calculatedNewDays,
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                expandAction === 'copilot'
                  ? 'border-[#0194F3] bg-[#F5F9FF] ring-2 ring-[#0194F3]/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="expandAction"
                value="copilot"
                checked={expandAction === 'copilot'}
                onChange={() => setExpandAction('copilot')}
                className="mt-0.5 text-[#0194F3] focus:ring-[#0194F3]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[#10243A]">
                    {t('planner.editMeta.copilotExpandTitle')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[#E5F2FF] text-[#0194F3] text-[10px] font-bold">
                    {t('planner.editMeta.recommendedBadge')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {t('planner.editMeta.copilotExpandDesc', {
                    fromDay: initialTotalDays + 1,
                    toDay: calculatedNewDays,
                  })}
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                expandAction === 'manual'
                  ? 'border-[#0194F3] bg-[#F5F9FF] ring-2 ring-[#0194F3]/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="expandAction"
                value="manual"
                checked={expandAction === 'manual'}
                onChange={() => setExpandAction('manual')}
                className="mt-0.5 text-[#0194F3] focus:ring-[#0194F3]"
              />
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-900">
                  {t('planner.editMeta.manualExpandTitle')}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {t('planner.editMeta.manualExpandDesc')}
                </p>
              </div>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setConfirmStep(null)}
              disabled={isSubmitting}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              {t('planner.editMeta.backToEdit')}
            </button>
            <button
              type="button"
              onClick={() => void executeSave({ triggerCopilotExpand: expandAction === 'copilot' })}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-check text-xs" aria-hidden="true" />
              )}
              <span>{t('planner.editMeta.confirmShiftDays')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Form body */}
      {!confirmStep && (
        <div className="p-5 space-y-4 text-xs">
          {errorKey && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 flex items-center gap-2"
            >
              <i className="fa-solid fa-circle-exclamation shrink-0" aria-hidden="true" />
              <span>
                {errorKey === 'errMaxDays'
                  ? t('planner.editMeta.errMaxDays', { max: MANUAL_MAX_TRIP_DAYS })
                  : t(`planner.editMeta.${errorKey}`)}
              </span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="itinerary-title-input" className="font-semibold text-slate-700">
                {t('planner.editMeta.titleLabel')} <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {title.length}/{ITINERARY_META_LIMITS.MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              id="itinerary-title-input"
              type="text"
              required
              maxLength={ITINERARY_META_LIMITS.MAX_TITLE_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              placeholder={t('planner.editMeta.titlePlaceholder')}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
            />
          </div>

          {/* Dates: Start Date & End Date */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">
              {t('planner.editMeta.datesLabel')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500">
                  {t('planner.editMeta.startDate')}
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500">{t('planner.editMeta.endDate')}</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
                />
              </div>
            </div>

            {/* Dynamic trip length indicator */}
            <div className="pt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                {t('planner.editMeta.calculatedDuration')}{' '}
                <strong className="text-slate-800 tabular-nums">
                  {t('planner.common.durationFull', {
                    days: calculatedNewDays,
                    nights: Math.max(0, calculatedNewDays - 1),
                  })}
                </strong>
              </span>
              {hasDaysChanged && (
                <span
                  className={`font-bold tabular-nums ${
                    calculatedNewDays < initialTotalDays ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {calculatedNewDays < initialTotalDays
                    ? t('planner.editMeta.daysReduced', {
                        count: initialTotalDays - calculatedNewDays,
                      })
                    : t('planner.editMeta.daysIncreased', {
                        count: calculatedNewDays - initialTotalDays,
                      })}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="itinerary-desc-input" className="font-semibold text-slate-700">
                {t('planner.editMeta.descriptionLabel')}
              </label>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {description.length}/{ITINERARY_META_LIMITS.MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
            <textarea
              id="itinerary-desc-input"
              rows={3}
              maxLength={ITINERARY_META_LIMITS.MAX_DESCRIPTION_LENGTH}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder={t('planner.editMeta.descriptionPlaceholder')}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3] resize-none"
            />
          </div>
        </div>
      )}

      {/* Footer */}
      {!confirmStep && (
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-check text-xs" aria-hidden="true" />
            )}
            <span>
              {isSubmitting ? t('planner.common.saving') : t('planner.common.saveChanges')}
            </span>
          </button>
        </div>
      )}
    </form>
  );
}

/**
 * Modal for editing itinerary title, trip dates, and description (Owner/Editor).
 * Provides interactive confirmation step when days increase or decrease.
 */
export function EditItineraryMetaDialog({
  open,
  onClose,
  title,
  description,
  startDate,
  endDate,
  totalDays,
  onSubmit,
  isSubmitting = false,
  onAskCopilot,
}: EditItineraryMetaDialogProps) {
  return (
    <AppModalPortal
      open={open}
      onClose={onClose}
      ariaLabelledBy="edit-meta-title"
      maxWidthClass="max-w-lg"
      disableClose={isSubmitting}
      mobileBottomSheet
    >
      {open && (
        <EditMetaForm
          key={`${title}-${description ?? ''}-${startDate ?? ''}-${endDate ?? ''}-${totalDays}`}
          initialTitle={title}
          initialDescription={description ?? ''}
          initialStartDate={toDateInputString(startDate)}
          initialEndDate={toDateInputString(endDate)}
          initialTotalDays={totalDays}
          onClose={onClose}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          onAskCopilot={onAskCopilot}
        />
      )}
    </AppModalPortal>
  );
}

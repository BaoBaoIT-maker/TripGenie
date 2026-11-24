'use client';

import { memo } from 'react';
import { useI18n, type MessageKey } from '@/i18n';
import type { ItineraryDetail, TourBriefing } from '@/types/itinerary';
import { PARTY_SIZE_BOUNDS } from '../../constants/itinerary.constants';
import {
  TOUR_BRIEFING_UI_CONSTANTS,
  formatDateRangeVi,
  formatDayDateLabel,
  formatVnd,
  type PrintSheetOptions,
} from './tour-briefing';

interface ItineraryPrintSheetProps {
  data: ItineraryDetail;
  briefing: TourBriefing;
  options: PrintSheetOptions;
  transitName: string;
}

export const ItineraryPrintSheet = memo(function ItineraryPrintSheet({
  data,
  briefing,
  options,
  transitName,
}: ItineraryPrintSheetProps) {
  const { t, locale } = useI18n();
  const totalDays = data.days.length || data.totalDays || 1;
  const totalNights = Math.max(0, totalDays - 1);
  const partySize = Math.max(
    PARTY_SIZE_BOUNDS.DEFAULT,
    data.budgetBreakdown?.partySize || data.partySize || PARTY_SIZE_BOUNDS.DEFAULT,
  );
  const docCode = `${TOUR_BRIEFING_UI_CONSTANTS.SHORT_CODE_PREFIX}-${(data.id || '')
    .replace(/-/g, '')
    .slice(0, TOUR_BRIEFING_UI_CONSTANTS.SHORT_CODE_LENGTH)
    .toUpperCase()}`;

  const leaderName = options.blankHandwritingMode ? '' : briefing.leaderName?.trim() || '';
  const leaderPhone = options.blankHandwritingMode ? '' : briefing.leaderPhone?.trim() || '';
  const meetingPoint = options.blankHandwritingMode ? '' : briefing.meetingPoint?.trim() || '';
  const groupNotes = options.blankHandwritingMode ? '' : briefing.notes?.trim() || '';

  const budgetLevelLabel =
    data.budgetLevel && ['LOW', 'MEDIUM', 'HIGH', 'LUXURY'].includes(data.budgetLevel)
      ? t(`planner.budgetLevels.${data.budgetLevel}` as MessageKey)
      : t('planner.budgetLevels.MEDIUM');

  const durationCompact = t('planner.common.durationCompact', {
    days: totalDays,
    nights: totalNights,
  });

  return (
    <article
      aria-label={t('planner.printSheet.sheetAria')}
      className="bg-white text-slate-900 w-full max-w-[794px] mx-auto p-6 sm:p-10 print:p-0 print:max-w-none print:shadow-none print:border-none font-sans"
    >
      {/* 1A. OFFICIAL TOUR SHEET MASTHEAD */}
      <header className="border-b-2 border-slate-900 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-900">
          <span>{t('planner.printSheet.masthead')}</span>
          <span className="text-slate-600 font-semibold tabular-nums">
            {t('planner.printSheet.codeLabel', { code: docCode })}
          </span>
        </div>

        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-950 mt-1.5 leading-tight">
          {data.title ||
            t('planner.briefing.fallbackTripTitle', {
              dest: data.destination || t('planner.common.vietnamFallback'),
            })}
        </h1>

        {data.description && (
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{data.description}</p>
        )}

        {/* Key Trip Specs Strip */}
        <div className="mt-3 py-2 px-3 bg-slate-50 border border-slate-300 rounded-md grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-slate-800">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              {t('planner.briefing.specDestination')}
            </span>
            <strong className="font-bold text-slate-950">
              {data.destination || t('planner.common.vietnamFallback')}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold tabular-nums">
              {t('planner.printSheet.specDuration', { duration: durationCompact })}
            </span>
            <strong className="font-bold text-slate-950 tabular-nums">
              {formatDateRangeVi(data.startDate, data.endDate, locale)}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              {t('planner.briefing.specGroupSize')}
            </span>
            <strong className="font-bold text-slate-950 tabular-nums">
              {t('planner.common.membersCount', { count: partySize })}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              {t('planner.printSheet.specMainTransit')}
            </span>
            <strong className="font-bold text-slate-950">{transitName}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              {t('planner.printSheet.specBudget')}
            </span>
            <strong className="font-bold text-slate-950">{budgetLevelLabel}</strong>
          </div>
        </div>
      </header>

      {/* 1B. FRAMED TOUR LEADER & ASSEMBLY BRIEFING BOX */}
      <section
        aria-label={t('planner.printSheet.briefingBoxAria')}
        className="mt-4 border-2 border-slate-900 rounded-lg p-3.5 bg-white break-inside-avoid"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-950 flex items-center gap-1.5">
            <i className="fa-solid fa-user-check text-xs text-[#0068B8] shrink-0" aria-hidden="true" />
            <span>{t('planner.printSheet.briefingBoxTitle')}</span>
          </h2>
          <span className="text-[10px] font-medium text-slate-500">
            {t('planner.printSheet.beOnTime')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
          {/* Leader Name */}
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-600 shrink-0">
              {t('planner.printSheet.leaderLabel')}
            </span>
            {leaderName ? (
              <strong className="font-bold text-slate-950">{leaderName}</strong>
            ) : (
              <span
                className="flex-1 border-b border-dotted border-slate-400 min-w-[120px] h-4 inline-block"
                aria-label={t('planner.printSheet.blankLeaderAria')}
              />
            )}
          </div>

          {/* Leader Phone */}
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-600 shrink-0">
              {t('planner.printSheet.phoneLabel')}
            </span>
            {leaderPhone ? (
              <strong className="font-bold text-slate-950 tracking-wide tabular-nums">
                {leaderPhone}
              </strong>
            ) : (
              <span
                className="flex-1 border-b border-dotted border-slate-400 min-w-[120px] h-4 inline-block"
                aria-label={t('planner.printSheet.blankPhoneAria')}
              />
            )}
          </div>

          {/* Meeting Point & Time */}
          <div className="sm:col-span-2 flex items-baseline gap-2">
            <span className="font-semibold text-slate-600 shrink-0">
              {t('planner.printSheet.meetingLabel')}
            </span>
            {meetingPoint ? (
              <strong className="font-bold text-slate-950">{meetingPoint}</strong>
            ) : (
              <span
                className="flex-1 border-b border-dotted border-slate-400 min-w-[180px] h-4 inline-block"
                aria-label={t('planner.printSheet.blankMeetingAria')}
              />
            )}
          </div>

          {/* Group Notes */}
          <div className="sm:col-span-2 flex items-baseline gap-2">
            <span className="font-semibold text-slate-600 shrink-0">
              {t('planner.printSheet.notesLabel')}
            </span>
            {groupNotes ? (
              <span className="text-slate-900 font-medium leading-relaxed whitespace-pre-line">
                {groupNotes}
              </span>
            ) : (
              <span
                className="flex-1 border-b border-dotted border-slate-400 min-w-[180px] h-4 inline-block"
                aria-label={t('planner.printSheet.blankNotesAria')}
              />
            )}
          </div>
        </div>
      </section>

      {/* 1C. FULL MULTI-DAY CHECKLIST TIMELINE (ALL DAYS SEQUENTIALLY) */}
      <div className="mt-5 space-y-6">
        {data.days.map((day, dayIdx) => {
          const dateLabel = formatDayDateLabel(data.startDate, dayIdx, locale);
          const shouldBreakBefore = options.pageBreakPerDay && dayIdx > 0;

          return (
            <section
              key={day.dayNumber}
              className={shouldBreakBefore ? 'print:break-before-page pt-2' : ''}
            >
              {/* Day Header Bar */}
              <div className="bg-slate-900 text-white px-3.5 py-2 rounded-md flex flex-wrap items-center justify-between gap-2 break-inside-avoid [break-after:avoid]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                  <span className="tabular-nums">
                    {t('planner.common.dayPadded', {
                      n: String(day.dayNumber).padStart(2, '0'),
                    })}
                    {dateLabel ? ` (${dateLabel})` : ''}
                  </span>
                  {day.theme && (
                    <span className="font-normal text-slate-200 normal-case">
                      — {day.theme}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-300 tabular-nums">
                  {t('planner.common.stopsCount', { count: day.activities.length })}
                </span>
              </div>

              {/* Intercity Transit Leg on Day 1 if available */}
              {dayIdx === 0 && data.intercityTransit && (
                <div className="mt-2.5 px-3 py-2 rounded-md border border-dashed border-slate-400 bg-slate-50 text-xs text-slate-800 flex flex-wrap items-center justify-between gap-2 break-inside-avoid">
                  <div>
                    <strong className="font-bold text-slate-950">
                      {t('planner.printSheet.intercityLabel', { mode: transitName })}{' '}
                    </strong>
                    <span>
                      {data.intercityTransit.originName} → {data.intercityTransit.destName}
                    </span>
                    {data.intercityTransit.details?.carriers && (
                      <span className="text-slate-600">
                        {t('planner.printSheet.suggestedCarriers', {
                          carriers: data.intercityTransit.details.carriers,
                        })}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                    {t('planner.printSheet.roundTripEstimate', {
                      km: Math.round(data.intercityTransit.distanceKm),
                      price: formatVnd(data.intercityTransit.estimatedPriceRoundTrip, locale),
                    })}
                  </span>
                </div>
              )}

              {/* Chronological Activities Table / Rows */}
              <div className="mt-2 divide-y divide-slate-200 border-x border-b border-slate-200 rounded-b-md">
                {day.activities.map((act, actIdx) => {
                  const stopKey = `${day.dayNumber}-${act.placeId}-${actIdx}`;
                  const timeSlot =
                    act.startTime && act.endTime
                      ? `${act.startTime} – ${act.endTime}`
                      : act.startTime || t('planner.printSheet.stopNumber', { n: actIdx + 1 });
                  const travelModeLabel =
                    act.travelModeToNext &&
                    ['WALK', 'BIKE', 'CAR'].includes(act.travelModeToNext)
                      ? t(`planner.travelModes.${act.travelModeToNext}` as MessageKey)
                      : act.travelModeToNext || t('planner.travelModes.DEFAULT');

                  return (
                    <div
                      key={stopKey}
                      className="p-3 flex items-start gap-3 bg-white break-inside-avoid"
                    >
                      {/* Column 1: Print Checkbox & Time Slot */}
                      <div className="flex items-start gap-2.5 w-32 sm:w-36 shrink-0">
                        {options.showChecklist && (
                          <span
                            aria-hidden="true"
                            className="mt-0.5 size-4 rounded-[3px] border-2 border-slate-800 shrink-0 bg-white"
                          />
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-950 tabular-nums">
                            {timeSlot}
                          </div>
                          {act.durationMinutes && (
                            <div className="text-[10px] text-slate-500 tabular-nums">
                              {t('planner.printSheet.durationShort', {
                                mins: act.durationMinutes,
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Column 2: Place Name, Category, Full Address, Notes & Next Leg */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-sky-900 tabular-nums">
                            {day.dayNumber}.{actIdx + 1}
                          </span>
                          <h3 className="text-sm font-bold text-slate-950">
                            {act.placeName}
                          </h3>
                          {act.categoryName && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded">
                              {act.categoryName}
                            </span>
                          )}
                        </div>

                        {act.address && (
                          <p className="text-xs text-slate-700 font-medium mt-0.5 leading-snug">
                            <span className="text-slate-500">
                              {t('planner.printSheet.addressPrefix')}
                            </span>
                            {act.address}
                          </p>
                        )}

                        {act.notes && (
                          <p className="text-[11px] text-slate-600 italic mt-1 leading-relaxed">
                            {t('planner.printSheet.notesPrefix', { notes: act.notes })}
                          </p>
                        )}

                        {act.distanceToNextKm !== null &&
                          act.distanceToNextKm !== undefined && (
                            <div className="mt-1.5 text-[11px] text-slate-600 tabular-nums">
                              {t('planner.printSheet.nextLeg', { km: act.distanceToNextKm })}
                              {act.durationToNextMinutes
                                ? t('planner.printSheet.nextLegDuration', {
                                    mins: act.durationToNextMinutes,
                                    mode: travelModeLabel,
                                  })
                                : ''}
                            </div>
                          )}
                      </div>

                      {/* Column 3: Estimated Cost */}
                      <div className="text-right shrink-0 w-24">
                        <span className="text-xs font-semibold text-slate-900 tabular-nums block">
                          {formatVnd(act.estimatedCost, locale)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {t('planner.common.estimated')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* 1D. COST SUMMARY TABLE & HANDWRITTEN FIELD NOTES FOOTER */}
      {options.showCostTable && data.budgetBreakdown && (
        <section
          aria-label={t('planner.printSheet.costTableAria')}
          className="mt-6 border border-slate-300 rounded-lg overflow-hidden break-inside-avoid"
        >
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 tabular-nums">
              {partySize > 1
                ? t('planner.printSheet.costTableTitleGroup', { count: partySize })
                : t('planner.printSheet.costTableTitleSolo')}
            </h2>
            <span className="text-[10px] text-slate-500 font-medium">
              {t('planner.printSheet.currencyUnit')}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 text-xs bg-white">
            <div className="p-2.5">
              <span className="text-[10px] text-slate-500 block">
                {t('planner.printSheet.costTransit')}
              </span>
              <strong className="font-bold text-slate-900 tabular-nums">
                {formatVnd(data.budgetBreakdown.transitRoundTrip, locale)}
              </strong>
            </div>
            <div className="p-2.5">
              <span className="text-[10px] text-slate-500 block">
                {t('planner.printSheet.costAccommodation')}
              </span>
              <strong className="font-bold text-slate-900 tabular-nums">
                {formatVnd(data.budgetBreakdown.accommodation, locale)}
              </strong>
            </div>
            <div className="p-2.5">
              <span className="text-[10px] text-slate-500 block">
                {t('planner.printSheet.costFood')}
              </span>
              <strong className="font-bold text-slate-900 tabular-nums">
                {formatVnd(data.budgetBreakdown.food, locale)}
              </strong>
            </div>
            <div className="p-2.5">
              <span className="text-[10px] text-slate-500 block">
                {t('planner.printSheet.costTicketsLocal')}
              </span>
              <strong className="font-bold text-slate-900 tabular-nums">
                {formatVnd(
                  (data.budgetBreakdown.tickets || 0) +
                    (data.budgetBreakdown.localTransit || 0),
                  locale,
                )}
              </strong>
            </div>
            <div className="p-2.5 bg-slate-50 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-sky-900 block">
                {t('planner.printSheet.costTotal')}
              </span>
              <strong className="text-sm font-bold text-slate-950 tabular-nums">
                {formatVnd(data.budgetBreakdown.totalEstimated, locale)}
              </strong>
            </div>
          </div>
        </section>
      )}

      {/* Handwritten Field Notes Area */}
      <section className="mt-5 pt-3 border-t border-slate-300 break-inside-avoid">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-700 mb-2">
          {t('planner.printSheet.fieldNotesTitle')}
        </div>
        <div className="space-y-4">
          {Array.from({ length: TOUR_BRIEFING_UI_CONSTANTS.HANDWRITING_NOTES_LINES }).map(
            (_, idx) => (
              <div
                key={idx}
                className="border-b border-dotted border-slate-400 h-3 w-full"
              />
            ),
          )}
        </div>
        <footer className="mt-4 flex items-center justify-between text-[10px] text-slate-500 tabular-nums">
          <span>{t('planner.printSheet.footerBrand')}</span>
          <span>{t('planner.printSheet.footerCode', { code: docCode })}</span>
        </footer>
      </section>
    </article>
  );
});

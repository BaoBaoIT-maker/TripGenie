'use client';

import { useI18n } from '@/i18n';
import type { TourBriefing } from '@/types/itinerary';

interface TourBriefingBannerProps {
  briefing?: TourBriefing | null;
  isOwner: boolean;
  onOpenModal: () => void;
}

/**
 * Group operation & meeting guide card (shown in "Đoàn & Hướng dẫn" tab).
 * Backend already redacts leaderPhone/notes for guests outside the trip.
 */
export function TourBriefingBanner({ briefing, isOwner, onOpenModal }: TourBriefingBannerProps) {
  const { t } = useI18n();
  const hasBriefing = Boolean(
    briefing && (briefing.leaderName || briefing.leaderPhone || briefing.meetingPoint || briefing.notes),
  );

  if (!hasBriefing && !isOwner) {
    return null;
  }

  return (
    <section
      aria-label={t('planner.briefing.bannerAria')}
      className="bg-white border border-slate-200 rounded-2xl p-5 print:hidden space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center shrink-0">
            <i className="fa-solid fa-clipboard-list text-sm" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              {t('planner.briefing.bannerTitle')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasBriefing
                ? t('planner.briefing.bannerSubFilled')
                : t('planner.briefing.bannerSubEmpty')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenModal}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#F5F9FF] hover:bg-[#F0F7FF] text-[#0194F3] border border-[#D0E7FF] text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          {isOwner ? (
            <>
              <i className="fa-solid fa-pen-to-square text-xs" aria-hidden="true" />
              <span>
                {hasBriefing
                  ? t('planner.briefing.editAndExport')
                  : t('planner.briefing.setupBriefing')}
              </span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-print text-xs" aria-hidden="true" />
              <span>{t('planner.briefing.viewPrintPdf')}</span>
            </>
          )}
        </button>
      </div>

      {hasBriefing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {(briefing?.leaderName || briefing?.leaderPhone) && (
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <i className="fa-solid fa-user-check text-[#0194F3]" aria-hidden="true" />
                <span>{t('planner.briefing.leaderLabel')}</span>
              </span>
              <div className="font-semibold text-slate-900 text-sm">
                {briefing?.leaderName || t('planner.briefing.leaderNameEmpty')}
              </div>
              {briefing?.leaderPhone && (
                <a
                  href={`tel:${briefing.leaderPhone.replace(/\s+/g, '')}`}
                  className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F0F7FF] text-[#10243A] hover:text-[#0194F3] border border-slate-200 text-xs font-bold tabular-nums transition-colors"
                  title={t('planner.briefing.callLeaderTitle')}
                >
                  <i className="fa-solid fa-phone text-[11px] text-[#0194F3]" aria-hidden="true" />
                  <span>{briefing.leaderPhone}</span>
                </a>
              )}
            </div>
          )}

          {briefing?.meetingPoint && (
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <i className="fa-solid fa-location-dot text-[#0194F3]" aria-hidden="true" />
                <span>{t('planner.briefing.meetingPointLabel')}</span>
              </span>
              <p className="font-semibold text-[#10243A] leading-relaxed">{briefing.meetingPoint}</p>
            </div>
          )}

          {briefing?.notes && (
            <div className="sm:col-span-2 bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <i className="fa-regular fa-file-lines text-[#0194F3]" aria-hidden="true" />
                <span>{t('planner.briefing.notesLabel')}</span>
              </span>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">{briefing.notes}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-600 bg-[#F5F9FF] rounded-xl px-4 py-3 border border-[#D0E7FF]">
          {t('planner.briefing.emptyPrivacyNotice')}
        </div>
      )}
    </section>
  );
}

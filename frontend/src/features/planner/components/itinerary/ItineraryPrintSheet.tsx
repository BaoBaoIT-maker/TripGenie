import { memo } from 'react';
import { UserCheck } from 'lucide-react';
import type { ItineraryDetail, TourBriefing } from '@/types/itinerary';
import { BUDGET_LABEL } from '../../itinerary-labels';
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
  const totalDays = data.days.length || data.totalDays || 1;
  const totalNights = Math.max(0, totalDays - 1);
  const docCode = `${TOUR_BRIEFING_UI_CONSTANTS.SHORT_CODE_PREFIX}-${(data.id || '')
    .replace(/-/g, '')
    .slice(0, TOUR_BRIEFING_UI_CONSTANTS.SHORT_CODE_LENGTH)
    .toUpperCase()}`;

  const leaderName = options.blankHandwritingMode ? '' : briefing.leaderName?.trim() || '';
  const leaderPhone = options.blankHandwritingMode ? '' : briefing.leaderPhone?.trim() || '';
  const meetingPoint = options.blankHandwritingMode ? '' : briefing.meetingPoint?.trim() || '';
  const groupNotes = options.blankHandwritingMode ? '' : briefing.notes?.trim() || '';

  return (
    <article
      aria-label="Phiếu hành trình và hướng dẫn đoàn khổ A4"
      className="bg-white text-slate-900 w-full max-w-[794px] mx-auto p-6 sm:p-10 print:p-0 print:max-w-none print:shadow-none print:border-none font-sans"
    >
      {/* 1A. OFFICIAL TOUR SHEET MASTHEAD */}
      <header className="border-b-2 border-slate-900 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-teal-800">
          <span>TRIPGENIE.VN — PHIẾU HÀNH TRÌNH &amp; HƯỚNG DẪN ĐOÀN</span>
          <span className="font-mono text-slate-600 font-semibold">
            MÃ HÀNH TRÌNH: #{docCode}
          </span>
        </div>

        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-950 mt-1.5 leading-tight">
          {data.title || `Hành trình khám phá ${data.destination || 'Việt Nam'}`}
        </h1>

        {data.description && (
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{data.description}</p>
        )}

        {/* Key Trip Specs Strip */}
        <div className="mt-3 py-2 px-3 bg-slate-50 border border-slate-300 rounded-md grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-800">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Điểm đến
            </span>
            <strong className="font-bold text-slate-950">
              {data.destination || 'Việt Nam'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Thời gian ({totalDays}N{totalNights}Đ)
            </span>
            <strong className="font-mono font-bold text-slate-950">
              {formatDateRangeVi(data.startDate, data.endDate)}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Phương tiện chính
            </span>
            <strong className="font-bold text-slate-950">{transitName}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Mức ngân sách
            </span>
            <strong className="font-bold text-slate-950">
              {BUDGET_LABEL[data.budgetLevel] || 'Tiêu chuẩn'}
            </strong>
          </div>
        </div>
      </header>

      {/* 1B. FRAMED TOUR LEADER & ASSEMBLY BRIEFING BOX */}
      <section
        aria-label="Thông tin điều hành đoàn và điểm tập trung"
        className="mt-4 border-2 border-slate-900 rounded-lg p-3.5 bg-white break-inside-avoid"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2.5">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-950 flex items-center gap-1.5">
            <UserCheck className="size-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            <span>THÔNG TIN ĐIỀU HÀNH ĐOÀN &amp; ĐIỂM TẬP TRUNG</span>
          </h2>
          <span className="text-[10px] font-medium text-slate-500">
            Vui lòng có mặt đúng giờ quy định
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
          {/* Leader Name */}
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-600 shrink-0">
              Trưởng đoàn / Phụ trách:
            </span>
            {leaderName ? (
              <strong className="font-bold text-slate-950">{leaderName}</strong>
            ) : (
              <span
                className="flex-1 border-b border-dotted border-slate-400 min-w-[120px] h-4 inline-block"
                aria-label="Dòng trống để ghi tên trưởng đoàn"
              />
            )}
          </div>

          {/* Leader Phone */}
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-600 shrink-0">
              Hotline liên hệ (24/7):
            </span>
            {leaderPhone ? (
              <strong className="font-mono font-bold text-slate-950 tracking-wide">
                {leaderPhone}
              </strong>
            ) : (
              <span
                className="flex-1 border-b border-dotted border-slate-400 min-w-[120px] h-4 inline-block"
                aria-label="Dòng trống để ghi số điện thoại"
              />
            )}
          </div>

          {/* Meeting Point & Time */}
          <div className="sm:col-span-2 flex items-baseline gap-2">
            <span className="font-semibold text-slate-600 shrink-0">
              Điểm &amp; Giờ tập trung:
            </span>
            {meetingPoint ? (
              <strong className="font-bold text-slate-950">{meetingPoint}</strong>
            ) : (
              <span
                className="flex-1 border-b border-dotted border-slate-400 min-w-[180px] h-4 inline-block"
                aria-label="Dòng trống để ghi điểm và giờ tập trung"
              />
            )}
          </div>

          {/* Group Notes */}
          <div className="sm:col-span-2 flex items-baseline gap-2">
            <span className="font-semibold text-slate-600 shrink-0">
              Dặn dò / Lưu ý đoàn:
            </span>
            {groupNotes ? (
              <span className="text-slate-900 font-medium leading-relaxed whitespace-pre-line">
                {groupNotes}
              </span>
            ) : (
              <span
                className="flex-1 border-b border-dotted border-slate-400 min-w-[180px] h-4 inline-block"
                aria-label="Dòng trống để ghi lưu ý đoàn"
              />
            )}
          </div>
        </div>
      </section>

      {/* 1C. FULL MULTI-DAY CHECKLIST TIMELINE (ALL DAYS SEQUENTIALLY) */}
      <div className="mt-5 space-y-6">
        {data.days.map((day, dayIdx) => {
          const dateLabel = formatDayDateLabel(data.startDate, dayIdx);
          const shouldBreakBefore = options.pageBreakPerDay && dayIdx > 0;

          return (
            <section
              key={day.dayNumber}
              className={shouldBreakBefore ? 'print:break-before-page pt-2' : ''}
            >
              {/* Day Header Bar (break-after-avoid prevents orphan day headers at bottom of page) */}
              <div className="bg-slate-900 text-white px-3.5 py-2 rounded-md flex flex-wrap items-center justify-between gap-2 break-inside-avoid [break-after:avoid]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                  <span>
                    NGÀY {String(day.dayNumber).padStart(2, '0')}
                    {dateLabel ? ` (${dateLabel})` : ''}
                  </span>
                  {day.theme && (
                    <span className="font-normal text-slate-200 normal-case">
                      — {day.theme}
                    </span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-slate-300">
                  {day.activities.length} điểm dừng
                </span>
              </div>

              {/* Intercity Transit Leg on Day 1 if available */}
              {dayIdx === 0 && data.intercityTransit && (
                <div className="mt-2.5 px-3 py-2 rounded-md border border-dashed border-slate-400 bg-slate-50 text-xs text-slate-800 flex flex-wrap items-center justify-between gap-2 break-inside-avoid">
                  <div>
                    <strong className="font-bold text-slate-950">
                      Di chuyển liên tỉnh ({transitName}):{' '}
                    </strong>
                    <span>
                      {data.intercityTransit.originName} → {data.intercityTransit.destName}
                    </span>
                    {data.intercityTransit.details?.carriers && (
                      <span className="text-slate-600">
                        {' '}
                        • Hãng gợi ý: {data.intercityTransit.details.carriers}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-slate-700">
                    ~{Math.round(data.intercityTransit.distanceKm)} km • Khứ hồi dự kiến:{' '}
                    {formatVnd(data.intercityTransit.estimatedPriceRoundTrip)}
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
                      : act.startTime || `Điểm ${actIdx + 1}`;
                  const travelModeLabel = act.travelModeToNext
                    ? TOUR_BRIEFING_UI_CONSTANTS.TRAVEL_MODE_LABELS[act.travelModeToNext] ||
                      act.travelModeToNext
                    : 'Di chuyển';

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
                          <div className="font-mono text-xs font-bold text-slate-950 tabular-nums">
                            {timeSlot}
                          </div>
                          {act.durationMinutes && (
                            <div className="font-mono text-[10px] text-slate-500">
                              Thời lượng: {act.durationMinutes}p
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Column 2: Place Name, Category, Full Address, Notes & Next Leg */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-teal-800">
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
                            <span className="text-slate-500">Địa chỉ: </span>
                            {act.address}
                          </p>
                        )}

                        {act.notes && (
                          <p className="text-[11px] text-slate-600 italic mt-1 leading-relaxed">
                            Lưu ý: {act.notes}
                          </p>
                        )}

                        {act.distanceToNextKm !== null &&
                          act.distanceToNextKm !== undefined && (
                            <div className="mt-1.5 text-[11px] text-slate-600 font-mono">
                              ↳ Chặng tiếp theo: ~{act.distanceToNextKm} km
                              {act.durationToNextMinutes
                                ? ` (~${act.durationToNextMinutes} phút • ${travelModeLabel})`
                                : ''}
                            </div>
                          )}
                      </div>

                      {/* Column 3: Estimated Cost */}
                      <div className="text-right shrink-0 w-24">
                        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums block">
                          {formatVnd(act.estimatedCost)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">Dự kiến</span>
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
          aria-label="Bảng tổng hợp dự toán kinh phí"
          className="mt-6 border border-slate-300 rounded-lg overflow-hidden break-inside-avoid"
        >
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-900">
              BẢNG TỔNG HỢP DỰ TOÁN KINH PHÍ (TÍNH TRÊN 01 NGƯỜI)
            </h2>
            <span className="text-[10px] text-slate-500 font-medium">
              Đơn vị tính: VNĐ
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 text-xs bg-white">
            <div className="p-2.5">
              <span className="text-[10px] text-slate-500 block">Di chuyển khứ hồi</span>
              <strong className="font-mono font-bold text-slate-900 tabular-nums">
                {formatVnd(data.budgetBreakdown.transitRoundTrip)}
              </strong>
            </div>
            <div className="p-2.5">
              <span className="text-[10px] text-slate-500 block">Lưu trú dự kiến</span>
              <strong className="font-mono font-bold text-slate-900 tabular-nums">
                {formatVnd(data.budgetBreakdown.accommodation)}
              </strong>
            </div>
            <div className="p-2.5">
              <span className="text-[10px] text-slate-500 block">Ẩm thực &amp; Đặc sản</span>
              <strong className="font-mono font-bold text-slate-900 tabular-nums">
                {formatVnd(data.budgetBreakdown.food)}
              </strong>
            </div>
            <div className="p-2.5">
              <span className="text-[10px] text-slate-500 block">Vé &amp; Đi lại nội đô</span>
              <strong className="font-mono font-bold text-slate-900 tabular-nums">
                {formatVnd(
                  (data.budgetBreakdown.tickets || 0) +
                    (data.budgetBreakdown.localTransit || 0),
                )}
              </strong>
            </div>
            <div className="p-2.5 bg-slate-50 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-teal-800 block">
                TỔNG DỰ KIẾN
              </span>
              <strong className="font-mono text-sm font-extrabold text-slate-950 tabular-nums">
                {formatVnd(data.budgetBreakdown.totalEstimated)}
              </strong>
            </div>
          </div>
        </section>
      )}

      {/* Handwritten Field Notes Area */}
      <section className="mt-5 pt-3 border-t border-slate-300 break-inside-avoid">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-700 mb-2">
          Ghi chú phát sinh thực tế của đoàn:
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
        <footer className="mt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Xuất từ nền tảng lập kế hoạch du lịch thông minh TripGenie</span>
          <span>Mã lịch trình: #{docCode}</span>
        </footer>
      </section>
    </article>
  );
});

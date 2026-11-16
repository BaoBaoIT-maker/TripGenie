'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import type { ItineraryDetail, TourBriefing } from '@/types/itinerary';
import {
  TOUR_BRIEFING_UI_CONSTANTS,
  formatDateRangeVi,
  formatDayDateLabel,
  type PrintSheetOptions,
} from './tour-briefing';

interface TourBriefingPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ItineraryDetail;
  isOwner: boolean;
  transitName: string;
  draftBriefing: TourBriefing;
  onChangeDraftBriefing: (next: TourBriefing) => void;
  printOptions: PrintSheetOptions;
  onChangePrintOptions: (next: PrintSheetOptions) => void;
  onSaveBriefing: (briefing: TourBriefing) => Promise<void>;
  isSaving: boolean;
  onTriggerPrint: () => void;
}

/**
 * Modern, high-performance modal for configuring tour briefing & exporting A4 PDF.
 * Uses local state to eliminate root-level re-render lag on keystroke.
 * Designed according to DESIGN.md and Community popup standards (compact, purposeful, antislop).
 */
export function TourBriefingPrintModal({
  isOpen,
  onClose,
  data,
  isOwner,
  transitName,
  draftBriefing,
  onChangeDraftBriefing,
  printOptions,
  onChangePrintOptions,
  onSaveBriefing,
  isSaving,
  onTriggerPrint,
}: TourBriefingPrintModalProps) {
  // Local state prevents typing lag by isolating keystrokes inside the modal
  const [localBriefing, setLocalBriefing] = useState<TourBriefing>(draftBriefing);
  const [localOptions, setLocalOptions] = useState<PrintSheetOptions>(printOptions);
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');

  useEffect(() => {
    if (isOpen) {
      setLocalBriefing(draftBriefing);
      setLocalOptions(printOptions);
      setActiveTab('config');
    }
  }, [isOpen, draftBriefing, printOptions]);

  const totalDays = data.days?.length || data.totalDays || 1;
  const totalNights = Math.max(0, totalDays - 1);
  const totalPlaces = data.days?.reduce((acc, d) => acc + (d.activities?.length || 0), 0) ?? 0;
  const docCode = `${TOUR_BRIEFING_UI_CONSTANTS.SHORT_CODE_PREFIX}-${(data.id || '')
    .replace(/-/g, '')
    .slice(0, TOUR_BRIEFING_UI_CONSTANTS.SHORT_CODE_LENGTH)
    .toUpperCase()}`;

  const handleSaveOnly = async () => {
    onChangeDraftBriefing(localBriefing);
    onChangePrintOptions(localOptions);
    try {
      await onSaveBriefing(localBriefing);
      toast.success('Đã lưu thông tin đoàn vào lịch trình!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể lưu thông tin đoàn.');
    }
  };

  const handleSaveAndPrint = async () => {
    onChangeDraftBriefing(localBriefing);
    onChangePrintOptions(localOptions);
    if (isOwner) {
      try {
        await onSaveBriefing(localBriefing);
      } catch (err) {
        toast.warning(
          err instanceof Error
            ? `Chưa lưu được thông tin đoàn: ${err.message}. Đang mở lệnh in...`
            : 'Chưa lưu được thông tin đoàn. Đang mở lệnh in...',
        );
      }
    }
    onClose();
    // Small timeout ensures modal DOM unmounts before triggering browser print dialog
    setTimeout(() => {
      onTriggerPrint();
    }, 120);
  };

  return (
    <AppModalPortal
      open={isOpen}
      onClose={onClose}
      ariaLabelledBy="tour-briefing-modal-title"
      maxWidthClass="max-w-2xl"
      disableClose={isSaving}
      mobileBottomSheet
    >
      <div className="flex flex-col max-h-[88vh] text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center shrink-0">
              <i className="fa-solid fa-file-pdf text-sm" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="tour-briefing-modal-title" className="text-sm font-bold text-slate-900 leading-snug">
                Xuất file PDF &amp; In tờ hướng dẫn tour
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Khổ giấy A4 chuẩn • Tự động tổng hợp đầy đủ {totalDays} ngày ({totalPlaces} điểm dừng)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Đóng cửa sổ"
            className="size-8 rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Navigation: Config vs Quick Preview */}
        <div className="px-5 pt-3 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'text-[#0194F3] border-b-2 border-[#0194F3]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-sliders text-[11px]" aria-hidden="true" />
            <span>Tùy chọn in &amp; Thông tin đoàn</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'text-[#0194F3] border-b-2 border-[#0194F3]'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <i className="fa-regular fa-file-lines text-[11px]" aria-hidden="true" />
            <span>Xem trước tóm tắt bố cục</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'config' ? (
            <>
              {/* 1. Print Format Switches */}
              <div className="space-y-2">
                <label className="font-bold text-slate-800 text-xs block">
                  1. Tùy chọn định dạng bản in A4
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      localOptions.showChecklist
                        ? 'bg-[#F5F9FF] border-[#0194F3]/40 ring-1 ring-[#0194F3]/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={localOptions.showChecklist}
                      onChange={(e) =>
                        setLocalOptions({ ...localOptions, showChecklist: e.target.checked })
                      }
                      className="mt-0.5 size-4 rounded border-slate-300 text-[#0194F3] focus:ring-[#0194F3]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 block text-[11px]">
                        Ô tích (Checklist)
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                        Đặt ô vuông trước mỗi mốc giờ để tích điểm danh
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      localOptions.showCostTable
                        ? 'bg-[#F5F9FF] border-[#0194F3]/40 ring-1 ring-[#0194F3]/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={localOptions.showCostTable}
                      onChange={(e) =>
                        setLocalOptions({ ...localOptions, showCostTable: e.target.checked })
                      }
                      className="mt-0.5 size-4 rounded border-slate-300 text-[#0194F3] focus:ring-[#0194F3]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 block text-[11px]">
                        Bảng tổng hợp chi phí
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                        Kèm bảng dự toán chi tiết ở trang cuối
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      localOptions.pageBreakPerDay
                        ? 'bg-[#F5F9FF] border-[#0194F3]/40 ring-1 ring-[#0194F3]/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={localOptions.pageBreakPerDay}
                      onChange={(e) =>
                        setLocalOptions({ ...localOptions, pageBreakPerDay: e.target.checked })
                      }
                      className="mt-0.5 size-4 rounded border-slate-300 text-[#0194F3] focus:ring-[#0194F3]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 block text-[11px]">
                        Tách trang theo ngày
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                        Mỗi ngày ngắt sang tờ A4 mới riêng biệt
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      localOptions.blankHandwritingMode
                        ? 'bg-[#F5F9FF] border-[#0194F3]/40 ring-1 ring-[#0194F3]/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={localOptions.blankHandwritingMode}
                      onChange={(e) =>
                        setLocalOptions({ ...localOptions, blankHandwritingMode: e.target.checked })
                      }
                      className="mt-0.5 size-4 rounded border-slate-300 text-[#0194F3] focus:ring-[#0194F3]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 block text-[11px]">
                        Dòng chấm ghi tay
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                        Chừa dòng trống để viết tay sau khi in ra giấy
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. Tour Leader & Assembly Form (Owner/Editor edits, Member views) */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    2. Thông tin Điều hành Đoàn &amp; Điểm tập trung
                  </label>
                  {!isOwner && (
                    <span className="px-2 py-0.5 rounded-md bg-[#F0F7FF] text-[#0194F3] font-semibold text-[10px]">
                      Thành viên xem
                    </span>
                  )}
                </div>

                {isOwner ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label htmlFor="briefing-leader-name" className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                          <i className="fa-solid fa-user-check text-[#0194F3]" aria-hidden="true" />
                          <span>Trưởng đoàn / Hướng dẫn viên</span>
                        </label>
                        <input
                          id="briefing-leader-name"
                          type="text"
                          maxLength={TOUR_BRIEFING_UI_CONSTANTS.MAX_LEADER_NAME_LENGTH}
                          value={localBriefing.leaderName || ''}
                          onChange={(e) =>
                            setLocalBriefing({ ...localBriefing, leaderName: e.target.value })
                          }
                          placeholder="Ví dụ: Nguyễn Hoàng Minh"
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="briefing-leader-phone" className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                          <i className="fa-solid fa-phone text-[#0194F3]" aria-hidden="true" />
                          <span>Hotline liên hệ 24/7</span>
                        </label>
                        <input
                          id="briefing-leader-phone"
                          type="tel"
                          maxLength={TOUR_BRIEFING_UI_CONSTANTS.MAX_LEADER_PHONE_LENGTH}
                          value={localBriefing.leaderPhone || ''}
                          onChange={(e) =>
                            setLocalBriefing({ ...localBriefing, leaderPhone: e.target.value })
                          }
                          placeholder="Ví dụ: 0905 882 419"
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="briefing-meeting-point" className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                        <i className="fa-solid fa-location-dot text-[#0194F3]" aria-hidden="true" />
                        <span>Điểm &amp; Giờ tập trung</span>
                      </label>
                      <input
                        id="briefing-meeting-point"
                        type="text"
                        maxLength={TOUR_BRIEFING_UI_CONSTANTS.MAX_MEETING_POINT_LENGTH}
                        value={localBriefing.meetingPoint || ''}
                        onChange={(e) =>
                          setLocalBriefing({ ...localBriefing, meetingPoint: e.target.value })
                        }
                        placeholder="Ví dụ: 05:30 sáng 15/11 — Sân bay Tân Sơn Nhất (Cổng D2)"
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor="briefing-notes" className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                          <i className="fa-solid fa-note-sticky text-[#0194F3]" aria-hidden="true" />
                          <span>Dặn dò / Nội quy chung cho đoàn</span>
                        </label>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {(localBriefing.notes || '').length}/{TOUR_BRIEFING_UI_CONSTANTS.MAX_NOTES_LENGTH}
                        </span>
                      </div>
                      <textarea
                        id="briefing-notes"
                        rows={2}
                        maxLength={TOUR_BRIEFING_UI_CONSTANTS.MAX_NOTES_LENGTH}
                        value={localBriefing.notes || ''}
                        onChange={(e) =>
                          setLocalBriefing({ ...localBriefing, notes: e.target.value })
                        }
                        placeholder="Ví dụ: Mang CCCD bản gốc; chuẩn bị giày thể thao êm chân; có mặt trước 15 phút..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3] resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#F5F9FF] border border-[#D0E7FF] rounded-xl p-3 text-xs text-[#10243A] space-y-1">
                    <p className="font-bold">Thông tin đoàn từ Trưởng nhóm:</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {localBriefing.leaderName
                        ? `Trưởng đoàn: ${localBriefing.leaderName} ${localBriefing.leaderPhone ? `• Hotline: ${localBriefing.leaderPhone}` : ''}`
                        : 'Trưởng đoàn chưa điền thông tin chi tiết.'}
                    </p>
                    {localBriefing.meetingPoint && (
                      <p className="text-[11px] text-slate-600">
                        Điểm tập trung: <strong>{localBriefing.meetingPoint}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Quick Summary Outline Tab (Zero lag, instantaneous rendering) */
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                {/* Masthead Banner */}
                <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#0194F3] uppercase tracking-wider">
                    TRIPGENIE • PHIẾU HÀNH TRÌNH A4
                  </span>
                  <span className="font-mono text-slate-500 font-bold tabular-nums">#{docCode}</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {data.title || `Hành trình khám phá ${data.destination || 'Việt Nam'}`}
                  </h3>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Điểm đến</span>
                      <strong className="text-slate-800">{data.destination || 'Việt Nam'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Thời gian</span>
                      <strong className="text-slate-800 tabular-nums">
                        {totalDays}N{totalNights}Đ
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Phương tiện</span>
                      <strong className="text-slate-800">{transitName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Quy mô đoàn</span>
                      <strong className="text-slate-800 tabular-nums">
                        {data.partySize || 1} người
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Day-by-Day Outline */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 block">Lộ trình tổng hợp:</span>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {data.days?.map((day, idx) => (
                      <div
                        key={day.dayNumber}
                        className="p-2 rounded-lg bg-slate-50/70 border border-slate-100 flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0194F3] tabular-nums">Ngày {day.dayNumber}</span>
                          <span className="text-slate-600 truncate max-w-[280px]">
                            {day.theme || `Khám phá các điểm nổi bật`}
                          </span>
                        </div>
                        <span className="text-slate-400 font-medium tabular-nums shrink-0">
                          {day.activities?.length || 0} điểm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#F0F7FF] border border-[#D0E7FF] rounded-xl p-2.5 text-[11px] text-sky-900 flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-[#0194F3] shrink-0" aria-hidden="true" />
                  <span>
                    Bản in A4 thực tế sẽ có đầy đủ ảnh bìa, bản đồ, địa chỉ, giờ giấc và các ô checklist. Bấm nút bên dưới để mở giao diện in / lưu PDF của trình duyệt.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {isOwner && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveOnly}
                className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-[#F0F7FF] text-[#10243A] hover:text-[#0194F3] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs text-[#0194F3]" aria-hidden="true" />
                ) : (
                  <i className="fa-regular fa-floppy-disk text-xs text-[#0194F3]" aria-hidden="true" />
                )}
                <span>Lưu thông tin</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAndPrint}
              className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#007AD0] text-white text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <i className="fa-solid fa-print text-xs" aria-hidden="true" />
              <span>Xuất file PDF / In ngay</span>
            </button>
          </div>
        </div>
      </div>
    </AppModalPortal>
  );
}

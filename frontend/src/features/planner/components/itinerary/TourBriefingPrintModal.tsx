'use client';

import { useEffect } from 'react';
import { Printer, Save, X, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { ItineraryDetail, TourBriefing } from '@/types/itinerary';
import { ItineraryPrintSheet } from './ItineraryPrintSheet';
import { TOUR_BRIEFING_UI_CONSTANTS, type PrintSheetOptions } from './tour-briefing';

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
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveOnly = async () => {
    try {
      await onSaveBriefing(draftBriefing);
      toast.success('Đã lưu thông tin đoàn vào lịch trình! Mọi người mở link sẽ thấy thông tin này.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể lưu thông tin đoàn.');
    }
  };

  const handleSaveAndPrint = async () => {
    if (isOwner) {
      try {
        await onSaveBriefing(draftBriefing);
      } catch (err) {
        // Printing the local draft stays possible, but the user must know it was not persisted.
        toast.warning(err instanceof Error ? `Chưa lưu được: ${err.message}. Đang in bản nháp.` : 'Chưa lưu được thông tin đoàn. Đang in bản nháp.');
      }
    }
    onTriggerPrint();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-briefing-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 lg:p-6 print:hidden"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-[1380px] h-[92vh] flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT PANEL: CONFIGURATION & ACTIONS */}
        <div className="w-full lg:w-[400px] xl:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between bg-white overflow-y-auto">
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2
                  id="tour-briefing-modal-title"
                  className="text-base font-bold text-slate-900"
                >
                  {isOwner
                    ? 'Thiết lập & Xem trước Tờ Hướng Dẫn Tour'
                    : 'Xem trước Tờ Hướng Dẫn Tour (Khổ A4)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isOwner
                    ? 'Gõ thông tin đoàn bên dưới, bản xem trước A4 bên phải sẽ cập nhật trực tiếp.'
                    : 'Bản tổng hợp đầy đủ tất cả các ngày chuẩn khổ giấy A4.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng cửa sổ xem trước"
                className="size-8 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>

            {isOwner ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="briefing-leader-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    1. Họ tên Trưởng đoàn / Hướng dẫn viên
                  </label>
                  <input
                    id="briefing-leader-name"
                    type="text"
                    maxLength={TOUR_BRIEFING_UI_CONSTANTS.MAX_LEADER_NAME_LENGTH}
                    value={draftBriefing.leaderName || ''}
                    onChange={(e) =>
                      onChangeDraftBriefing({ ...draftBriefing, leaderName: e.target.value })
                    }
                    placeholder="VD: Nguyễn Hoàng Minh"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="briefing-leader-phone"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    2. Số điện thoại liên hệ khẩn cấp (24/7)
                  </label>
                  <input
                    id="briefing-leader-phone"
                    type="tel"
                    maxLength={TOUR_BRIEFING_UI_CONSTANTS.MAX_LEADER_PHONE_LENGTH}
                    value={draftBriefing.leaderPhone || ''}
                    onChange={(e) =>
                      onChangeDraftBriefing({ ...draftBriefing, leaderPhone: e.target.value })
                    }
                    placeholder="VD: 0905 882 419"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="briefing-meeting-point"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    3. Điểm &amp; Giờ tập trung
                  </label>
                  <input
                    id="briefing-meeting-point"
                    type="text"
                    maxLength={TOUR_BRIEFING_UI_CONSTANTS.MAX_MEETING_POINT_LENGTH}
                    value={draftBriefing.meetingPoint || ''}
                    onChange={(e) =>
                      onChangeDraftBriefing({
                        ...draftBriefing,
                        meetingPoint: e.target.value,
                      })
                    }
                    placeholder="VD: 05:30 sáng 15/11 — Sân bay Tân Sơn Nhất (Cổng D2)"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="briefing-notes"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    4. Dặn dò / Nội quy chung cho đoàn
                  </label>
                  <textarea
                    id="briefing-notes"
                    rows={3}
                    maxLength={TOUR_BRIEFING_UI_CONSTANTS.MAX_NOTES_LENGTH}
                    value={draftBriefing.notes || ''}
                    onChange={(e) =>
                      onChangeDraftBriefing({ ...draftBriefing, notes: e.target.value })
                    }
                    placeholder="VD: Mang CCCD bản gốc; có mặt trước 15 phút; chuẩn bị giày thể thao êm chân..."
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3] resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3.5 text-xs text-sky-900 space-y-1.5">
                <div className="font-bold">Chế độ xem thành viên đoàn</div>
                <p className="text-slate-600 leading-relaxed">
                  Tờ hướng dẫn này đã được đồng bộ đầy đủ toàn bộ các ngày trong lịch trình. Bạn có thể bấm nút bên dưới để lưu thành file PDF hoặc in ra giấy A4.
                </p>
              </div>
            )}

            {/* Print Display Switches */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="text-xs font-bold text-slate-800">
                Tùy chọn định dạng bản in A4:
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={printOptions.showChecklist}
                  onChange={(e) =>
                    onChangePrintOptions({
                      ...printOptions,
                      showChecklist: e.target.checked,
                    })
                  }
                  className="size-4 rounded border-slate-300 text-[#0194F3] focus:ring-[#0194F3]"
                />
                <span>Hiển thị ô tích (Checklist ☐) trước mỗi mốc giờ</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={printOptions.showCostTable}
                  onChange={(e) =>
                    onChangePrintOptions({
                      ...printOptions,
                      showCostTable: e.target.checked,
                    })
                  }
                  className="size-4 rounded border-slate-300 text-[#0194F3] focus:ring-[#0194F3]"
                />
                <span>Hiển thị bảng tổng hợp dự toán chi phí cuối trang</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={printOptions.pageBreakPerDay}
                  onChange={(e) =>
                    onChangePrintOptions({
                      ...printOptions,
                      pageBreakPerDay: e.target.checked,
                    })
                  }
                  className="size-4 rounded border-slate-300 text-[#0194F3] focus:ring-[#0194F3]"
                />
                <span>Ngắt sang trang A4 mới cho mỗi ngày (Tách tờ theo ngày)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={printOptions.blankHandwritingMode}
                  onChange={(e) =>
                    onChangePrintOptions({
                      ...printOptions,
                      blankHandwritingMode: e.target.checked,
                    })
                  }
                  className="size-4 rounded border-slate-300 text-[#0194F3] focus:ring-[#0194F3]"
                />
                <span>Để trống khung thông tin đoàn (In dòng chấm để ghi tay)</span>
              </label>
            </div>

            {isOwner && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 flex items-start gap-2">
                <ShieldCheck className="size-4 text-[#0068B8] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Bảo mật:</strong> Số điện thoại và ghi chú chỉ hiển thị với bạn và thành viên nhóm chuyến đi. Người xem công khai và người nhân bản lịch trình sẽ không thấy hai thông tin này.
                </span>
              </div>
            )}
          </div>

          {/* Sticky Action Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
            {isOwner && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveOnly}
                className="w-full h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="size-3.5 animate-spin text-[#0194F3]" />
                ) : (
                  <Save className="size-3.5 text-[#0068B8]" />
                )}
                <span>Lưu thông tin đoàn vào lịch trình</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAndPrint}
              className="w-full h-11 rounded-xl bg-[#0068B8] hover:bg-[#00569C] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="size-4" />
              <span>
                {isOwner
                  ? 'Lưu & Xuất PDF / In tờ hướng dẫn (Khổ A4)'
                  : 'Xuất PDF / In tờ hướng dẫn (Khổ A4)'}
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: LIVE A4 PAPER PREVIEW CANVAS */}
        <div className="flex-1 bg-slate-200/90 flex flex-col overflow-hidden">
          <div className="px-5 py-2.5 bg-slate-800 text-slate-200 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span className="font-medium">
              Bản xem trước khổ chuẩn A4 (210 × 297 mm) • Tự động gộp đầy đủ {data.days.length} ngày
            </span>
            <span className="font-mono text-[11px] text-sky-300">
              Hỗ trợ in nhiều trang tự động (Chống cắt đôi địa điểm)
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="shadow-lg border border-slate-300 bg-white max-w-[794px] mx-auto">
              <ItineraryPrintSheet
                data={data}
                briefing={draftBriefing}
                options={printOptions}
                transitName={transitName}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

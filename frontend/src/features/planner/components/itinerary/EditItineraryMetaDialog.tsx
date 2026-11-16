'use client';

import { useState } from 'react';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { ITINERARY_META_LIMITS } from '../../constants/itinerary.constants';
import type { UpdateItineraryMetaRequest } from '@/types/itinerary';

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
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [dayShiftMode, setDayShiftMode] = useState<'merge' | 'trim'>('merge');
  const [expandAction, setExpandAction] = useState<'copilot' | 'manual'>('copilot');
  const [confirmStep, setConfirmStep] = useState<'reduce' | 'expand' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      setErrorMsg('Tên lịch trình không được để trống.');
      return;
    }

    if (startDate && endDate) {
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        setErrorMsg('Ngày đi hoặc ngày về không hợp lệ.');
        return;
      }
      if (d2 < d1) {
        setErrorMsg('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
        return;
      }
      const days = calculateSpanDays(startDate, endDate) || 1;
      if (days > 30) {
        setErrorMsg('Thời gian chuyến đi tối đa là 30 ngày.');
        return;
      }

      if (days < initialTotalDays) {
        setErrorMsg(null);
        setConfirmStep('reduce');
        return;
      }

      if (days > initialTotalDays) {
        setErrorMsg(null);
        setConfirmStep('expand');
        return;
      }
    }

    setErrorMsg(null);
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
      const prompt = `Lịch trình vừa được mở rộng lên ${calculatedNewDays} ngày (thêm Ngày ${initialTotalDays + 1} đến Ngày ${calculatedNewDays}). Hãy gợi ý cho tôi các địa điểm hấp dẫn và lộ trình di chuyển hợp lý cho những ngày mới này nhé!`;
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
                ? 'Xác nhận rút ngắn lịch trình'
                : confirmStep === 'expand'
                  ? 'Kéo dài thời gian chuyến đi'
                  : 'Chỉnh sửa thông tin & ngày đi'}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {confirmStep
                ? 'Xử lý các ngày và điểm dừng khi số ngày chuyến đi thay đổi'
                : 'Cập nhật tiêu đề, ngày khởi hành và ghi chú chuyến đi'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Đóng hộp thoại"
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
                Số ngày giảm từ {initialTotalDays} ngày xuống {calculatedNewDays} ngày
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Các địa điểm đã lên lịch từ <strong>Ngày {calculatedNewDays + 1}</strong> đến{' '}
                <strong>Ngày {initialTotalDays}</strong> sẽ bị ảnh hưởng. Vui lòng chọn cách xử lý:
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
                  <span className="font-bold text-[#10243A]">Dồn vào ngày cuối</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Khuyên dùng - 0 mất dữ liệu
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Tất cả các điểm dừng từ Ngày {calculatedNewDays + 1} đến Ngày {initialTotalDays} sẽ được chuyển về Ngày {calculatedNewDays} để bạn tự do sắp xếp lại.
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
                <span className="font-bold text-slate-900">Xóa các điểm vượt quá</span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Xóa bỏ toàn bộ các điểm dừng thuộc Ngày {calculatedNewDays + 1} đến Ngày {initialTotalDays} khỏi lịch trình.
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
              Quay lại chỉnh sửa
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
              <span>Xác nhận dời ngày</span>
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
                Lịch trình được tăng từ {initialTotalDays} ngày lên {calculatedNewDays} ngày
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Các ngày mới (từ <strong>Ngày {initialTotalDays + 1}</strong> đến{' '}
                <strong>Ngày {calculatedNewDays}</strong>) hiện đang trống. Vui lòng chọn cách tiếp tục:
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
                  <span className="font-bold text-[#10243A]">Nhờ Genie Copilot gợi ý điểm mới</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[#E5F2FF] text-[#0194F3] text-[10px] font-bold">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Tự động lưu ngày mới và mở khung chat để Copilot gợi ý địa điểm hấp dẫn cho Ngày {initialTotalDays + 1} đến Ngày {calculatedNewDays}.
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
                <span className="font-bold text-slate-900">Tự thêm điểm sau</span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Cập nhật thời gian chuyến đi và tạo các ngày trống để bạn tự tra cứu và thêm địa điểm dừng theo ý muốn.
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
              Quay lại chỉnh sửa
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
              <span>Xác nhận dời ngày</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Form body */}
      {!confirmStep && (
        <div className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 flex items-center gap-2"
            >
              <i className="fa-solid fa-circle-exclamation shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="itinerary-title-input" className="font-semibold text-slate-700">
                Tên lịch trình <span className="text-rose-500">*</span>
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
              placeholder="Ví dụ: Khám phá Hội An - Đà Nẵng 3N2Đ"
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
            />
          </div>

          {/* Dates: Start Date & End Date */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Thời gian chuyến đi</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500">Ngày bắt đầu</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500">Ngày kết thúc</span>
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
                Thời lượng tính toán: <strong className="text-slate-800 tabular-nums">{calculatedNewDays} ngày {Math.max(0, calculatedNewDays - 1)} đêm</strong>
              </span>
              {hasDaysChanged && (
                <span
                  className={`font-bold tabular-nums ${
                    calculatedNewDays < initialTotalDays ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {calculatedNewDays < initialTotalDays
                    ? `(Giảm ${initialTotalDays - calculatedNewDays} ngày)`
                    : `(Tăng ${calculatedNewDays - initialTotalDays} ngày)`}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="itinerary-desc-input" className="font-semibold text-slate-700">
                Mô tả ngắn (không bắt buộc)
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
              placeholder="Chia sẻ tiêu chí chuyến đi, lưu ý chung hoặc phong cách khám phá..."
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
            Hủy
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
            <span>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
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

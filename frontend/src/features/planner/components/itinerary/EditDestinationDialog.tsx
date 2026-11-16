'use client';

import { useState } from 'react';
import { AppModalPortal } from '@/components/common/AppModalPortal';
import { ModalCopilotAssist } from './ModalCopilotAssist';
import { DESTINATION_TIME_DEFAULTS } from '../../constants/itinerary.constants';
import type { ItineraryActivity, ItineraryDay, UpdateDestinationRequest } from '@/types/itinerary';

interface EditDestinationDialogProps {
  open: boolean;
  onClose: () => void;
  activity: ItineraryActivity | null;
  days: ItineraryDay[];
  onSubmit: (destinationId: string, dto: UpdateDestinationRequest) => Promise<void>;
  isSubmitting?: boolean;
  canEdit?: boolean;
  onAskCopilot?: (prompt: string) => void;
}

interface EditDestinationFormProps {
  activity: ItineraryActivity;
  days: ItineraryDay[];
  onClose: () => void;
  onSubmit: (destinationId: string, dto: UpdateDestinationRequest) => Promise<void>;
  isSubmitting: boolean;
  canEdit?: boolean;
  onAskCopilot?: (prompt: string) => void;
}

function findInitialDayNumber(activity: ItineraryActivity, days: ItineraryDay[]): number {
  const matchedDay = days.find((d) =>
    d.activities.some((a) => (a.id && activity.id ? a.id === activity.id : a.placeId === activity.placeId)),
  );
  return matchedDay?.dayNumber ?? days[0]?.dayNumber ?? 1;
}

function EditDestinationForm({
  activity,
  days,
  onClose,
  onSubmit,
  isSubmitting,
  canEdit = true,
  onAskCopilot,
}: EditDestinationFormProps) {
  const [dayNumber, setDayNumber] = useState<number>(() => findInitialDayNumber(activity, days));
  const [startTime, setStartTime] = useState(
    activity.startTime || DESTINATION_TIME_DEFAULTS.DEFAULT_START,
  );
  const [endTime, setEndTime] = useState(
    activity.endTime || DESTINATION_TIME_DEFAULTS.DEFAULT_END,
  );
  const [notes, setNotes] = useState(activity.notes ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const destinationId = activity.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationId) {
      setValidationError('Điểm dừng này chưa đồng bộ mã bản ghi, không thể chỉnh trực tiếp.');
      return;
    }

    if (!startTime || !endTime) {
      setValidationError('Vui lòng chọn đầy đủ giờ bắt đầu và giờ kết thúc.');
      return;
    }

    if (endTime <= startTime) {
      setValidationError('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }

    setValidationError(null);
    await onSubmit(destinationId, {
      dayNumber,
      startTime,
      endTime,
      notes: notes.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-xl bg-[#F0F7FF] text-[#0194F3] flex items-center justify-center shrink-0">
            <i className="fa-regular fa-clock text-sm" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="edit-destination-title" className="text-sm font-bold text-slate-900">
              Chỉnh sửa giờ &amp; ghi chú điểm dừng
            </h2>
            <p className="text-xs text-slate-500 truncate mt-0.5">{activity.placeName}</p>
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

      {/* Body */}
      <div className="p-5 space-y-4 text-xs">
        {validationError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 flex items-center gap-2"
          >
            <i className="fa-solid fa-circle-exclamation shrink-0" aria-hidden="true" />
            <span>{validationError}</span>
          </div>
        )}

        {days.length > 1 && (
          <div className="space-y-1.5">
            <label htmlFor="dest-day-select" className="block font-semibold text-slate-700">
              Thuộc ngày trong lịch trình
            </label>
            <select
              id="dest-day-select"
              value={dayNumber}
              onChange={(e) => setDayNumber(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
            >
              {days.map((d) => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  Ngày {d.dayNumber}
                  {d.theme ? ` — ${d.theme}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="dest-start-time" className="block font-semibold text-slate-700">
              Giờ bắt đầu
            </label>
            <input
              id="dest-start-time"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dest-end-time" className="block font-semibold text-slate-700">
              Giờ kết thúc
            </label>
            <input
              id="dest-end-time"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="dest-notes" className="font-semibold text-slate-700">
              Ghi chú cho cả đoàn
            </label>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {notes.length}/{DESTINATION_TIME_DEFAULTS.MAX_NOTES_LENGTH}
            </span>
          </div>
          <textarea
            id="dest-notes"
            rows={3}
            maxLength={DESTINATION_TIME_DEFAULTS.MAX_NOTES_LENGTH}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            placeholder="Ví dụ: Nên đi sớm để tránh nắng, đặt bàn trước 1 ngày..."
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3] resize-none"
          />
        </div>

        {onAskCopilot && (
          <div className="pt-1">
            <ModalCopilotAssist
              context="edit"
              placeName={activity.placeName}
              dayNumber={dayNumber}
              canEdit={canEdit}
              onAskCopilot={(prompt) => {
                onClose();
                onAskCopilot(prompt);
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
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
          disabled={isSubmitting}
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
    </form>
  );
}

/**
 * Modal for editing destination day, time range, and notes.
 */
export function EditDestinationDialog({
  open,
  onClose,
  activity,
  days,
  onSubmit,
  isSubmitting = false,
  canEdit = true,
  onAskCopilot,
}: EditDestinationDialogProps) {
  return (
    <AppModalPortal
      open={open && Boolean(activity)}
      onClose={onClose}
      ariaLabelledBy="edit-destination-title"
      maxWidthClass="max-w-lg"
      disableClose={isSubmitting}
      mobileBottomSheet
    >
      {activity && (
        <EditDestinationForm
          key={`${activity.id || activity.placeId}-${activity.startTime}-${activity.endTime}`}
          activity={activity}
          days={days}
          onClose={onClose}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          canEdit={canEdit}
          onAskCopilot={onAskCopilot}
        />
      )}
    </AppModalPortal>
  );
}

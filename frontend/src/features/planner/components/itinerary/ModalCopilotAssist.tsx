'use client';

import { useState } from 'react';

export interface ModalCopilotAssistProps {
  context: 'swap' | 'add' | 'propose' | 'edit';
  placeName?: string;
  dayNumber?: number;
  canEdit: boolean;
  onAskCopilot: (prompt: string) => void;
}

const COPILOT_CAPABILITIES = [
  {
    icon: 'fa-solid fa-arrows-rotate',
    iconColor: 'text-[#0194F3]',
    title: 'Đổi địa điểm theo gu',
    desc: 'Đổi quán yên tĩnh hơn, tiết kiệm chi phí, hoặc chuyển vào trong nhà khi mưa.',
  },
  {
    icon: 'fa-regular fa-calendar-days',
    iconColor: 'text-indigo-600',
    title: 'Chuyển ngày linh hoạt',
    desc: 'Dời địa điểm này sang một ngày khác thuận tiện hơn trong lịch trình.',
  },
  {
    icon: 'fa-solid fa-shuffle',
    iconColor: 'text-purple-600',
    title: 'Hoán đổi 2 ngày',
    desc: 'Đổi toàn bộ lịch trình giữa 2 ngày cho nhau (ví dụ Ngày 1 với Ngày 2).',
  },
  {
    icon: 'fa-solid fa-route',
    iconColor: 'text-emerald-600',
    title: 'Thêm điểm tiện đường',
    desc: 'Gợi ý quán cafe hoặc món đặc sản nằm ngay trên cung đường di chuyển.',
  },
  {
    icon: 'fa-regular fa-clock',
    iconColor: 'text-amber-600',
    title: 'Cân đối thời gian',
    desc: 'Tự động phân bổ lại giờ giấc và thứ tự ghé thăm để chuyến đi thư thả.',
  },
] as const;

const SWAP_CHIPS = [
  {
    label: 'Ít đông / yên tĩnh hơn',
    buildPrompt: (target: string) =>
      `Gợi ý cho tôi một địa điểm thay thế cho "${target}" có không gian yên tĩnh, ít đông đúc hơn nhưng cùng khu vực`,
  },
  {
    label: 'Hợp túi tiền hơn',
    buildPrompt: (target: string) =>
      `Tìm giúp tôi địa điểm thay thế cho "${target}" với chi phí tiết kiệm hơn mà vẫn chất lượng`,
  },
  {
    label: 'Trong nhà khi mưa',
    buildPrompt: (target: string) =>
      `Nếu thời tiết có mưa, tôi nên đổi "${target}" sang địa điểm trong nhà nào gần đó?`,
  },
  {
    label: 'Chuyển sang ngày khác',
    buildPrompt: (target: string) =>
      `Hãy giúp tôi chuyển điểm "${target}" sang một ngày khác thuận đường hơn trong lịch trình`,
  },
  {
    label: 'Đổi Ngày 1 & Ngày 2',
    buildPrompt: () => `Hãy hoán đổi toàn bộ lịch trình Ngày 1 và Ngày 2 cho nhau`,
  },
] as const;

const DISCOVERY_CHIPS = [
  {
    label: 'Quán ăn đặc sản tiện đường',
    buildPrompt: (day: number) =>
      `Gợi ý 1 quán ăn đặc sản địa phương ngon, tiện cung đường di chuyển vào Ngày ${day}`,
  },
  {
    label: 'Cafe view đẹp nghỉ chân',
    buildPrompt: (day: number) =>
      `Tìm giúp tôi một quán cafe đẹp, hợp ghé nghỉ chân thư giãn vào Ngày ${day}`,
  },
  {
    label: 'Điểm check-in miễn phí',
    buildPrompt: (day: number) =>
      `Gợi ý một điểm tham quan miễn phí vé, thuận đường di chuyển trong Ngày ${day}`,
  },
  {
    label: 'Đổi Ngày 1 & Ngày 2',
    buildPrompt: () => `Hãy hoán đổi toàn bộ lịch trình Ngày 1 và Ngày 2 cho nhau`,
  },
] as const;

const EDIT_CHIPS = [
  {
    label: 'Cân đối lại giờ giấc cả ngày',
    buildPrompt: (_target: string, day: number) =>
      `Hãy cân đối lại thời gian và thứ tự các điểm dừng trong Ngày ${day} để không bị gấp gáp`,
  },
  {
    label: 'Chuyển điểm sang ngày khác',
    buildPrompt: (target: string) =>
      `Hãy giúp tôi chuyển điểm "${target}" sang một ngày khác thuận tiện hơn`,
  },
  {
    label: 'Đổi Ngày 1 & Ngày 2',
    buildPrompt: () => `Hãy hoán đổi toàn bộ lịch trình Ngày 1 và Ngày 2 cho nhau`,
  },
] as const;

/**
 * Shared Genie Copilot assist strip embedded in PlaceAlternativesModal, PlaceSearchDialog, and EditDestinationDialog.
 * Clearly showcases what Copilot can do:
 * - Swap place by vibe (quiet, budget, indoor)
 * - Shift place to another day
 * - Swap 2 entire days
 * - Add on-the-way dining/cafe
 * - Rebalance daily schedule time
 */
export function ModalCopilotAssist({
  context,
  placeName,
  dayNumber = 1,
  canEdit,
  onAskCopilot,
}: ModalCopilotAssistProps) {
  const [showCapabilities, setShowCapabilities] = useState(false);

  const targetName = placeName || 'điểm dừng này';

  const chips =
    context === 'swap'
      ? SWAP_CHIPS.map((c) => ({
          label: c.label,
          prompt: c.buildPrompt(targetName),
        }))
      : context === 'edit'
        ? EDIT_CHIPS.map((c) => ({
            label: c.label,
            prompt: c.buildPrompt(targetName, dayNumber),
          }))
        : DISCOVERY_CHIPS.map((c) => ({
            label: c.label,
            prompt: c.buildPrompt(dayNumber),
          }));

  const defaultPrompt =
    context === 'swap'
      ? `Gợi ý cho tôi địa điểm tương đương để thay thế cho "${targetName}"`
      : context === 'edit'
        ? `Hãy giúp tôi điều chỉnh giờ giấc và thứ tự hợp lý cho "${targetName}" trong Ngày ${dayNumber}`
        : `Gợi ý cho tôi một địa điểm phù hợp để thêm vào Ngày ${dayNumber}`;

  return (
    <div className="rounded-2xl border border-[#D0E7FF] bg-[#F5F9FF] p-3.5 space-y-3">
      {/* Header with expand toggle for Copilot capabilities */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-[#0194F3] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <i className="fa-solid fa-wand-magic-sparkles text-xs" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-[#10243A] leading-snug">
                Trợ lý Genie Copilot có thể làm gì?
              </h4>
              <button
                type="button"
                onClick={() => setShowCapabilities((v) => !v)}
                className="text-[11px] font-semibold text-[#0194F3] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{showCapabilities ? 'Thu gọn' : 'Xem 5 khả năng'}</span>
                <i
                  className={`fa-solid fa-chevron-${showCapabilities ? 'up' : 'down'} text-[9px]`}
                  aria-hidden="true"
                />
              </button>
            </div>
            <p className="text-[11px] text-[#475569] leading-relaxed mt-0.5">
              {canEdit
                ? 'Đổi điểm theo gu, chuyển ngày, đổi thứ tự 2 ngày, thêm điểm tiện đường hoặc cân đối lại thời gian chỉ bằng 1 câu lệnh.'
                : 'Nhờ Copilot gợi ý điểm tương đương để tạo bình chọn cho cả nhóm cùng chốt.'}
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Capabilities Grid */}
      {showCapabilities && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#D0E7FF]/70 text-xs">
          {COPILOT_CAPABILITIES.map((cap) => (
            <div
              key={cap.title}
              className="p-2 rounded-xl bg-white/90 border border-slate-200/80 flex items-start gap-2"
            >
              <div className="size-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <i className={`${cap.icon} ${cap.iconColor} text-[11px]`} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-[#10243A] leading-snug">{cap.title}</p>
                <p className="text-[10px] text-[#64748B] leading-tight mt-0.5">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Chips & Open Drawer Button */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onAskCopilot(chip.prompt)}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F0F7FF] text-[#10243A] hover:text-[#0194F3] border border-slate-200 hover:border-[#0194F3]/40 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            {chip.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onAskCopilot(defaultPrompt)}
          className="px-3 py-1.5 rounded-lg bg-[#0194F3] hover:bg-[#007AD0] text-white text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ml-auto shadow-xs"
        >
          <i className="fa-regular fa-comment-dots text-[11px]" aria-hidden="true" />
          <span>Mở trợ lý Copilot</span>
        </button>
      </div>
    </div>
  );
}

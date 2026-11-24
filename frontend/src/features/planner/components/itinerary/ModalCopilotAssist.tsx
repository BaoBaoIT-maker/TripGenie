'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n';

export interface ModalCopilotAssistProps {
  context: 'swap' | 'add' | 'propose' | 'edit';
  placeName?: string;
  dayNumber?: number;
  canEdit: boolean;
  onAskCopilot: (prompt: string) => void;
}

const CAPABILITY_META = [
  {
    key: 'swapVibe',
    icon: 'fa-solid fa-arrows-rotate',
    iconColor: 'text-[#0194F3]',
    titleKey: 'planner.copilot.assist.capabilities.swapVibeTitle' as const,
    descKey: 'planner.copilot.assist.capabilities.swapVibeDesc' as const,
  },
  {
    key: 'moveDay',
    icon: 'fa-regular fa-calendar-days',
    iconColor: 'text-indigo-600',
    titleKey: 'planner.copilot.assist.capabilities.moveDayTitle' as const,
    descKey: 'planner.copilot.assist.capabilities.moveDayDesc' as const,
  },
  {
    key: 'swapDays',
    icon: 'fa-solid fa-shuffle',
    iconColor: 'text-purple-600',
    titleKey: 'planner.copilot.assist.capabilities.swapDaysTitle' as const,
    descKey: 'planner.copilot.assist.capabilities.swapDaysDesc' as const,
  },
  {
    key: 'addOnWay',
    icon: 'fa-solid fa-route',
    iconColor: 'text-emerald-600',
    titleKey: 'planner.copilot.assist.capabilities.addOnWayTitle' as const,
    descKey: 'planner.copilot.assist.capabilities.addOnWayDesc' as const,
  },
  {
    key: 'balanceTime',
    icon: 'fa-regular fa-clock',
    iconColor: 'text-amber-600',
    titleKey: 'planner.copilot.assist.capabilities.balanceTimeTitle' as const,
    descKey: 'planner.copilot.assist.capabilities.balanceTimeDesc' as const,
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
  const { t } = useI18n();
  const [showCapabilities, setShowCapabilities] = useState(false);

  const targetName = placeName || t('planner.copilot.assist.thisStopFallback');

  const chips =
    context === 'swap'
      ? [
          {
            label: t('planner.copilot.assist.swapChips.quietLabel'),
            prompt: t('planner.copilot.assist.swapChips.quietPrompt', { target: targetName }),
          },
          {
            label: t('planner.copilot.assist.swapChips.budgetLabel'),
            prompt: t('planner.copilot.assist.swapChips.budgetPrompt', { target: targetName }),
          },
          {
            label: t('planner.copilot.assist.swapChips.indoorLabel'),
            prompt: t('planner.copilot.assist.swapChips.indoorPrompt', { target: targetName }),
          },
          {
            label: t('planner.copilot.assist.swapChips.shiftDayLabel'),
            prompt: t('planner.copilot.assist.swapChips.shiftDayPrompt', { target: targetName }),
          },
          {
            label: t('planner.copilot.assist.swapChips.swapDaysLabel'),
            prompt: t('planner.copilot.assist.swapChips.swapDaysPrompt'),
          },
        ]
      : context === 'edit'
        ? [
            {
              label: t('planner.copilot.assist.editChips.rebalanceLabel'),
              prompt: t('planner.copilot.assist.editChips.rebalancePrompt', { day: dayNumber }),
            },
            {
              label: t('planner.copilot.assist.editChips.shiftDayLabel'),
              prompt: t('planner.copilot.assist.editChips.shiftDayPrompt', { target: targetName }),
            },
            {
              label: t('planner.copilot.assist.editChips.swapDaysLabel'),
              prompt: t('planner.copilot.assist.editChips.swapDaysPrompt'),
            },
          ]
        : [
            {
              label: t('planner.copilot.assist.discoveryChips.foodLabel'),
              prompt: t('planner.copilot.assist.discoveryChips.foodPrompt', { day: dayNumber }),
            },
            {
              label: t('planner.copilot.assist.discoveryChips.cafeLabel'),
              prompt: t('planner.copilot.assist.discoveryChips.cafePrompt', { day: dayNumber }),
            },
            {
              label: t('planner.copilot.assist.discoveryChips.freeLabel'),
              prompt: t('planner.copilot.assist.discoveryChips.freePrompt', { day: dayNumber }),
            },
            {
              label: t('planner.copilot.assist.discoveryChips.swapDaysLabel'),
              prompt: t('planner.copilot.assist.discoveryChips.swapDaysPrompt'),
            },
          ];

  const defaultPrompt =
    context === 'swap'
      ? t('planner.copilot.assist.defaultPromptSwap', { target: targetName })
      : context === 'edit'
        ? t('planner.copilot.assist.defaultPromptEdit', { target: targetName, day: dayNumber })
        : t('planner.copilot.assist.defaultPromptAdd', { day: dayNumber });

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
                {t('planner.copilot.assist.heading')}
              </h4>
              <button
                type="button"
                onClick={() => setShowCapabilities((v) => !v)}
                className="text-[11px] font-semibold text-[#0194F3] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>
                  {showCapabilities
                    ? t('planner.copilot.assist.hideCapabilities')
                    : t('planner.copilot.assist.showCapabilities')}
                </span>
                <i
                  className={`fa-solid fa-chevron-${showCapabilities ? 'up' : 'down'} text-[9px]`}
                  aria-hidden="true"
                />
              </button>
            </div>
            <p className="text-[11px] text-[#475569] leading-relaxed mt-0.5">
              {canEdit
                ? t('planner.copilot.assist.descCanEdit')
                : t('planner.copilot.assist.descViewer')}
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Capabilities Grid */}
      {showCapabilities && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#D0E7FF]/70 text-xs">
          {CAPABILITY_META.map((cap) => (
            <div
              key={cap.key}
              className="p-2 rounded-xl bg-white/90 border border-slate-200/80 flex items-start gap-2"
            >
              <div className="size-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <i className={`${cap.icon} ${cap.iconColor} text-[11px]`} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-[#10243A] leading-snug">
                  {t(cap.titleKey)}
                </p>
                <p className="text-[10px] text-[#64748B] leading-tight mt-0.5">{t(cap.descKey)}</p>
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
          <span>{t('planner.copilot.assist.openDrawerBtn')}</span>
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';

export type SupportedLocale = 'vi' | 'en';

interface AiThinkingIndicatorProps {
  /** Domain context: 'copilot' (default) or 'advisor'. */
  context?: 'copilot' | 'advisor';
  /** Target locale: 'vi' (default) or 'en'. */
  locale?: SupportedLocale;
  /** Optional custom wrapper class. */
  className?: string;
  /** Whether to display the leading small avatar (used in Copilot view). */
  showAvatar?: boolean;
}

const DEFAULT_THINKING_TEXTS: Record<
  'copilot' | 'advisor',
  Record<SupportedLocale, [string, string, string]>
> = {
  copilot: {
    vi: [
      'Đang phân tích yêu cầu & đối chiếu lịch trình...',
      'Đang tra cứu dữ liệu thực tế & tối ưu phương án...',
      'Đang hoàn tất đề xuất...',
    ],
    en: [
      'Analyzing request & checking itinerary context...',
      'Querying live place data & optimizing route...',
      'Finalizing recommendations...',
    ],
  },
  advisor: {
    vi: [
      'Đang phân tích câu hỏi của bạn...',
      'Đang đối chiếu cẩm nang & cơ sở dữ liệu du lịch...',
      'Đang tổng hợp câu trả lời chi tiết...',
    ],
    en: [
      'Analyzing your travel inquiry...',
      'Searching travel guide & destination database...',
      'Compiling detailed recommendations...',
    ],
  },
};

const STEP_TRANSITION_DELAYS_MS = {
  STEP_1_TO_2: 1000,
  STEP_2_TO_3: 2200,
} as const;

/**
 * Minimalist Paced AI Thinking Indicator (WCAG 2.2 AA compliant).
 * 3-step universal temporal narrative with no decorative icons.
 */
export const AiThinkingIndicator = React.memo(function AiThinkingIndicator({
  context = 'copilot',
  locale,
  className = '',
  showAvatar = true,
}: AiThinkingIndicatorProps) {
  const { locale: activeLocale } = useI18n();
  const resolvedLocale = locale ?? activeLocale;
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isFading, setIsFading] = useState<boolean>(false);

  const texts =
    DEFAULT_THINKING_TEXTS[context]?.[resolvedLocale] || DEFAULT_THINKING_TEXTS[context].vi;

  useEffect(() => {
    let innerTimer1: ReturnType<typeof setTimeout> | undefined;
    let innerTimer2: ReturnType<typeof setTimeout> | undefined;

    const timer1 = setTimeout(() => {
      setIsFading(true);
      innerTimer1 = setTimeout(() => {
        setActiveStep(1);
        setIsFading(false);
      }, 150);
    }, STEP_TRANSITION_DELAYS_MS.STEP_1_TO_2);

    const timer2 = setTimeout(() => {
      setIsFading(true);
      innerTimer2 = setTimeout(() => {
        setActiveStep(2);
        setIsFading(false);
      }, 150);
    }, STEP_TRANSITION_DELAYS_MS.STEP_2_TO_3);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (innerTimer1) clearTimeout(innerTimer1);
      if (innerTimer2) clearTimeout(innerTimer2);
    };
  }, [context, resolvedLocale]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`flex items-start gap-2 max-w-[90%] sm:max-w-md ${className}`}
    >
      {showAvatar && (
        <div
          aria-hidden="true"
          className="size-7 rounded-full bg-[#0194F3] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5 border border-white"
        >
          <i className="fa-solid fa-compass text-xs" />
        </div>
      )}

      <div className="p-3 rounded-2xl rounded-tl-xs bg-white border border-slate-200/90 text-slate-700 shadow-2xs flex items-center gap-2.5 text-xs select-none min-h-[42px]">
        {/* Subtle dynamic spinner */}
        <div
          aria-hidden="true"
          className="size-3.5 rounded-full border-2 border-[#0194F3]/25 border-t-[#0194F3] animate-spin shrink-0"
        />

        {/* Dynamic narrative text without decorative icons */}
        <span
          className={`font-medium text-slate-700 leading-relaxed transition-opacity duration-150 motion-reduce:transition-none ${
            isFading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {texts[activeStep] || texts[0]}
        </span>
      </div>
    </div>
  );
});

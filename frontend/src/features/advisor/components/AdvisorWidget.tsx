'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Compass, Send, X } from 'lucide-react';
import { useAdvisorChat } from '../hooks/useAdvisorChat';
import { AdvisorDrawer } from './AdvisorDrawer';

export const PROMPT_CONFIG = {
  STORAGE_KEY: 'tripgenie_advisor_prompt_dismissed',
  APPEAR_DELAY_MS: 5_000,   // Delay 5s before popping up
  AUTO_DISMISS_MS: 12_000,  // Auto collapse bubble after 12s
  ASSISTANT_NAME: 'Genie Cố Vấn',
  STATUS_LABEL: 'Trực tuyến',
  CTA_TEXT: 'Trò chuyện ngay',
  CLOSE_LABEL: 'Đóng gợi ý trợ lý',
  DEFAULT_MESSAGE:
    'Chào bạn! Mình có thể giúp bạn gợi ý điểm tham quan, quán ăn chuẩn vị bản địa hoặc kiểm tra thời tiết chuyến đi nhé.',
  EXPLORE_MESSAGE:
    'Bạn đang tìm kiếm điểm đến mới? Hãy cho mình biết sở thích và ngân sách, mình sẽ gợi ý điểm đến hoàn hảo cho bạn!',
  ITINERARY_MESSAGE:
    'Đang xem lịch trình? Bạn có thể hỏi mình để gợi ý quán ăn ngon, phương tiện di chuyển hoặc mẹo du lịch tiết kiệm tại đây!',
};

function resolveContextualMessage(pathname: string): string {
  if (pathname.includes('/itineraries') || pathname.includes('/planner')) {
    return PROMPT_CONFIG.ITINERARY_MESSAGE;
  }
  if (pathname.includes('/explore')) {
    return PROMPT_CONFIG.EXPLORE_MESSAGE;
  }
  return PROMPT_CONFIG.DEFAULT_MESSAGE;
}

export function AdvisorWidget() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPromptVisible, setIsPromptVisible] = React.useState(false);
  const [hasBadge, setHasBadge] = React.useState(false);
  const pathname = usePathname() || '';

  const {
    messages,
    isLoading,
    isRestoring,
    sendMessage,
    startNewSession,
  } = useAdvisorChat(isOpen);

  // Check dismissal status and trigger delayed prompt
  React.useEffect(() => {
    try {
      const isDismissed =
        sessionStorage.getItem(PROMPT_CONFIG.STORAGE_KEY) === 'true';
      if (isDismissed || isOpen) return;

      const appearTimer = setTimeout(() => {
        setIsPromptVisible(true);
        setHasBadge(true);
      }, PROMPT_CONFIG.APPEAR_DELAY_MS);

      const autoDismissTimer = setTimeout(() => {
        setIsPromptVisible(false);
      }, PROMPT_CONFIG.APPEAR_DELAY_MS + PROMPT_CONFIG.AUTO_DISMISS_MS);

      return () => {
        clearTimeout(appearTimer);
        clearTimeout(autoDismissTimer);
      };
    } catch {
      // Fallback if sessionStorage is inaccessible
    }
  }, [isOpen]);

  // When drawer opens, automatically dismiss prompt bubble and badge
  React.useEffect(() => {
    if (isOpen) {
      setIsPromptVisible(false);
      setHasBadge(false);
      try {
        sessionStorage.setItem(PROMPT_CONFIG.STORAGE_KEY, 'true');
      } catch {}
    }
  }, [isOpen]);

  const handleDismissPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPromptVisible(false);
    setHasBadge(false);
    try {
      sessionStorage.setItem(PROMPT_CONFIG.STORAGE_KEY, 'true');
    } catch {}
  };

  const handleOpenFromPrompt = () => {
    setIsPromptVisible(false);
    setHasBadge(false);
    try {
      sessionStorage.setItem(PROMPT_CONFIG.STORAGE_KEY, 'true');
    } catch {}
    setIsOpen(true);
  };

  const contextualMessage = resolveContextualMessage(pathname);

  return (
    <>
      <AdvisorDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        isLoading={isLoading}
        isRestoring={isRestoring}
        onSendMessage={sendMessage}
        onNewSession={startNewSession}
      />

      {/* Proactive Conversational Prompt Bubble */}
      <aside
        aria-label="Gợi ý từ trợ lý ảo Genie"
        aria-hidden={!isPromptVisible}
        className={`fixed z-40 transition-all duration-300 motion-reduce:transition-none ${
          isPromptVisible
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-3 scale-95 pointer-events-none'
        } bottom-36 right-4 left-4 max-w-[340px] ml-auto md:bottom-24 md:right-6 md:left-auto md:w-[340px]`}
      >
        <div className="relative rounded-2xl border border-border/80 bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Compass className="size-4" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight text-foreground">
                  {PROMPT_CONFIG.ASSISTANT_NAME}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {PROMPT_CONFIG.STATUS_LABEL}
                </span>
              </div>
            </div>

            {/* Close Button with accessible 44x44px touch target */}
            <button
              type="button"
              onClick={handleDismissPrompt}
              aria-label={PROMPT_CONFIG.CLOSE_LABEL}
              className="-mr-2 -mt-2 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Contextual Message Body */}
          <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {contextualMessage}
          </p>

          {/* Primary Call-To-Action (CTA) */}
          <button
            type="button"
            onClick={handleOpenFromPrompt}
            className="mt-3.5 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Send className="size-3.5" aria-hidden="true" />
            <span>{PROMPT_CONFIG.CTA_TEXT}</span>
          </button>

          {/* Desktop Arrow Pointer */}
          <div
            className="hidden md:block absolute -bottom-2 right-6 size-4 rotate-45 border-b border-r border-border/80 bg-card/95"
            aria-hidden="true"
          />
        </div>
      </aside>

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={
          isOpen ? 'Đóng trợ lý AI Advisor' : 'Mở trợ lý du lịch AI Advisor'
        }
        aria-expanded={isOpen}
        className="fixed bottom-20 right-4 z-40 flex min-h-[52px] min-w-[52px] cursor-pointer items-center gap-2.5 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-6 md:right-6"
      >
        {isOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <div className="relative flex items-center gap-2.5">
            {/* Live Green Online Dot (no endless pulse per DESIGN.md MOTION=1 & antislop R-19) */}
            <span
              className="absolute -top-3.5 -left-3.5 flex size-3.5"
              title="Trợ lý đang trực tuyến"
            >
              <span className="relative inline-flex size-3.5 rounded-full border-2 border-background bg-emerald-500" />
            </span>

            {/* Red Badge Alert */}
            {hasBadge && (
              <span
                role="status"
                className="absolute -top-4 -right-3 flex size-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground shadow-md ring-2 ring-background animate-in zoom-in-50 duration-200"
              >
                <span className="sr-only">1 thông báo từ cố vấn du lịch</span>
                1
              </span>
            )}

            <Compass className="h-5 w-5" aria-hidden="true" />
            <span className="hidden text-sm font-semibold sm:inline">
              Hỏi Cố Vấn AI
            </span>
          </div>
        )}
      </button>
    </>
  );
}


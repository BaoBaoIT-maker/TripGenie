'use client';

import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { TripGenieMark } from '@/components/common/TripGenieMark';
import {
  ADVISOR_UI_CONSTANTS,
  AdvisorMessageItem,
  AdvisorQuickPromptItem,
} from '@/types/advisor';
import { AdvisorMessageBubble } from './AdvisorMessageBubble';

interface AdvisorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AdvisorMessageItem[];
  isLoading: boolean;
  isRestoring: boolean;
  onSendMessage: (message: string) => void;
  onNewSession: () => void;
}

const QUICK_PROMPT_ICONS: Record<
  AdvisorQuickPromptItem['category'],
  React.ReactNode
> = {
  guide: <i className="fa-solid fa-book-open text-sm text-primary" aria-hidden="true" />,
  place: <i className="fa-solid fa-utensils text-sm text-primary" aria-hidden="true" />,
  safety: <i className="fa-solid fa-shield-halved text-sm text-primary" aria-hidden="true" />,
  platform: <i className="fa-solid fa-users text-sm text-primary" aria-hidden="true" />,
};

export function AdvisorDrawer({
  isOpen,
  onClose,
  messages,
  isLoading,
  isRestoring,
  onSendMessage,
  onNewSession,
}: AdvisorDrawerProps) {
  const [inputText, setInputText] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new message or loading state change (respects prefers-reduced-motion)
  React.useEffect(() => {
    if (!isOpen) return;
    const isReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: isReducedMotion ? 'auto' : 'smooth',
    });
  }, [messages, isLoading, isOpen]);

  // Focus textarea when drawer opens on desktop
  React.useEffect(() => {
    if (!isOpen) return;
    const isMobile =
      typeof window !== 'undefined' &&
      window.innerWidth < ADVISOR_UI_CONSTANTS.MOBILE_BREAKPOINT_PX;
    if (!isMobile) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(
      e.target.scrollHeight,
      ADVISOR_UI_CONSTANTS.MAX_TEXTAREA_HEIGHT_PX,
    )}px`;
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Scrim Backdrop */}
        <Dialog.Backdrop className="dialog-backdrop-subtle fixed inset-0 z-50 bg-slate-950/35" />

        {/* Right Slide-over Drawer (Clean Editorial solid surface) */}
        <Dialog.Popup
          aria-label={ADVISOR_UI_CONSTANTS.HEADER_TITLE}
          className="advisor-drawer-popup fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-card text-card-foreground shadow-2xl outline-none sm:w-[440px] md:w-[460px]"
        >
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                <TripGenieMark className="size-7" />
              </div>
              <div className="min-w-0">
                <Dialog.Title className="truncate text-sm font-bold tracking-tight text-foreground">
                  {ADVISOR_UI_CONSTANTS.HEADER_TITLE}
                </Dialog.Title>
                <Dialog.Description className="truncate text-xs font-medium text-muted-foreground">
                  {ADVISOR_UI_CONSTANTS.HEADER_SUBTITLE}
                </Dialog.Description>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={onNewSession}
                  aria-label="Bắt đầu cuộc trò chuyện mới"
                  title="Cuộc trò chuyện mới"
                  className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <i className="fa-solid fa-rotate-left text-sm" aria-hidden="true" />
                </button>
              )}
              <Dialog.Close
                aria-label="Đóng cửa sổ tư vấn AI"
                title="Đóng (Esc)"
                className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <i className="fa-solid fa-xmark text-base" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </header>

          {/* Scrollable Message Stream */}
          <div
            aria-live="polite"
            className="custom-scroll flex-1 space-y-4 overflow-y-auto bg-background px-4 py-4"
          >
            {isRestoring ? (
              <div className="flex h-full flex-col items-center justify-center gap-2.5 text-muted-foreground">
                <i
                  className="fa-solid fa-circle-notch fa-spin text-xl text-primary"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium">
                  Đang khôi phục cuộc trò chuyện...
                </span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col justify-center gap-5 py-6">
                <div className="space-y-2 px-2 text-center">
                  <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl border border-border bg-card shadow-2xs">
                    <TripGenieMark className="size-9" />
                  </div>
                  <h3 className="text-base font-bold tracking-tight text-foreground">
                    {ADVISOR_UI_CONSTANTS.WELCOME_TITLE}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {ADVISOR_UI_CONSTANTS.WELCOME_DESCRIPTION}
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Gợi ý câu hỏi nhanh
                  </p>
                  <div className="grid gap-2">
                    {ADVISOR_UI_CONSTANTS.QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt.id}
                        type="button"
                        onClick={() => onSendMessage(prompt.prompt)}
                        className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors motion-reduce:transition-none hover:border-primary/50 hover:bg-secondary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          {QUICK_PROMPT_ICONS[prompt.category]}
                        </span>
                        <span className="flex-1 line-clamp-2">
                          {prompt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((item) => (
                  <AdvisorMessageBubble
                    key={item.id}
                    message={item}
                    onNavigate={onClose}
                  />
                ))}
                {isLoading && (
                  <div className="flex max-w-[85%] items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-xs font-medium text-muted-foreground shadow-2xs">
                    <i
                      className="fa-solid fa-circle-notch fa-spin text-sm text-primary"
                      aria-hidden="true"
                    />
                    <span>Genie đang soạn câu trả lời cho bạn...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Footer Input Area */}
          <footer className="border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Hỏi về địa điểm, cẩm nang, giá vé..."
                  rows={1}
                  disabled={isLoading}
                  spellCheck={false}
                  aria-label="Nhập câu hỏi cho trợ lý du lịch"
                  className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground transition-colors motion-reduce:transition-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50 sm:text-sm"
                  style={{
                    maxHeight: `${ADVISOR_UI_CONSTANTS.MAX_TEXTAREA_HEIGHT_PX}px`,
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                aria-label="Gửi tin nhắn"
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs transition-all motion-reduce:transition-none hover:bg-primary-hover active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isLoading ? (
                  <i
                    className="fa-solid fa-circle-notch fa-spin text-sm"
                    aria-hidden="true"
                  />
                ) : (
                  <i className="fa-solid fa-paper-plane text-sm" aria-hidden="true" />
                )}
              </button>
            </form>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

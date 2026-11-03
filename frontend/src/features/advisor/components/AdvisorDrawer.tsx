'use client';

import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  BookOpen,
  Compass,
  Loader2,
  RotateCcw,
  Send,
  ShieldAlert,
  Users,
  Utensils,
  X,
} from 'lucide-react';
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
  guide: <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />,
  place: <Utensils className="h-4 w-4 text-primary" aria-hidden="true" />,
  safety: <ShieldAlert className="h-4 w-4 text-primary" aria-hidden="true" />,
  platform: <Users className="h-4 w-4 text-primary" aria-hidden="true" />,
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
        {/* Mobile Backdrop */}
        <Dialog.Backdrop className="dialog-backdrop-subtle fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden" />

        {/* Drawer Popup with Controlled Exit Animation */}
        <Dialog.Popup
          aria-label={ADVISOR_UI_CONSTANTS.HEADER_TITLE}
          className="advisor-drawer-popup fixed inset-0 z-50 flex flex-col bg-card text-card-foreground md:inset-auto md:bottom-24 md:right-6 md:h-[650px] md:max-h-[calc(100dvh-7rem)] md:w-[420px] md:rounded-2xl md:border md:border-border md:bg-card/95 md:shadow-2xl md:backdrop-blur-md outline-none"
        >
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-primary/20 bg-primary px-4 py-3 text-primary-foreground md:rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                <Compass className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-bold tracking-tight text-primary-foreground">
                  {ADVISOR_UI_CONSTANTS.HEADER_TITLE}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-primary-foreground/85">
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
                  className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl text-primary-foreground/85 transition-colors motion-reduce:transition-none hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <Dialog.Close
                aria-label="Đóng cửa sổ tư vấn AI"
                title="Đóng (Esc)"
                className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl text-primary-foreground/85 transition-colors motion-reduce:transition-none hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </header>

          {/* Scrollable Message Stream */}
          <div
            aria-live="polite"
            className="flex-1 overflow-y-auto bg-muted/40 px-4 py-4 space-y-4"
          >
            {isRestoring ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2
                  className="h-6 w-6 animate-spin motion-reduce:animate-none text-primary"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium">
                  Đang khôi phục cuộc trò chuyện...
                </span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col justify-center gap-4 py-6">
                <div className="text-center space-y-1.5 px-2">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Compass className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Chào bạn! Mình có thể giúp gì cho bạn?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hỏi mình về lịch trình, điểm check-in hot, ẩm thực bản địa hay
                    kinh nghiệm du lịch thực tế tại Việt Nam.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Gợi ý câu hỏi nhanh:
                  </p>
                  <div className="grid gap-2">
                    {ADVISOR_UI_CONSTANTS.QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt.id}
                        type="button"
                        onClick={() => onSendMessage(prompt.prompt)}
                        className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card p-2.5 text-left text-xs text-foreground transition-all motion-reduce:transition-none hover:border-primary/40 hover:bg-primary/5 hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="shrink-0">
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
                  <AdvisorMessageBubble key={item.id} message={item} />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 rounded-2xl bg-card border border-border/80 px-4 py-3 text-xs text-muted-foreground max-w-[85%] shadow-xs">
                    <Loader2
                      className="h-4 w-4 animate-spin motion-reduce:animate-none text-primary"
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
          <footer className="border-t border-border bg-card p-3 md:rounded-b-2xl">
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
                  aria-label="Nhập câu hỏi cho trợ lý du lịch"
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground transition-colors motion-reduce:transition-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  style={{
                    maxHeight: `${ADVISOR_UI_CONSTANTS.MAX_TEXTAREA_HEIGHT_PX}px`,
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                aria-label="Gửi tin nhắn"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all motion-reduce:transition-none hover:bg-primary/90 active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

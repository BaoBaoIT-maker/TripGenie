'use client';

import * as React from 'react';
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

  // Auto-scroll to bottom on new message or loading state change
  React.useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  // Close drawer on Escape key press & lock background body scroll on mobile viewports
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const isMobile =
      window.innerWidth < ADVISOR_UI_CONSTANTS.MOBILE_BREAKPOINT_PX;
    const prevOverflow = document.body.style.overflow;
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      textareaRef.current?.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (isMobile) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ADVISOR_UI_CONSTANTS.HEADER_TITLE}
      className="fixed inset-0 z-50 flex flex-col bg-card text-card-foreground md:inset-auto md:bottom-24 md:right-6 md:h-[650px] md:max-h-[calc(100dvh-7rem)] md:w-[420px] md:rounded-2xl md:border md:border-border md:bg-card/95 md:shadow-2xl md:backdrop-blur-md"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-primary/20 bg-primary px-4 py-3 text-primary-foreground md:rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Compass className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-primary-foreground">
              {ADVISOR_UI_CONSTANTS.HEADER_TITLE}
            </h2>
            <p className="text-xs text-primary-foreground/85">
              {ADVISOR_UI_CONSTANTS.HEADER_SUBTITLE}
            </p>
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ tư vấn AI"
            title="Đóng (Esc)"
            className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl text-primary-foreground/85 transition-colors motion-reduce:transition-none hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
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
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Compass
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                <span>{ADVISOR_UI_CONSTANTS.WELCOME_TITLE}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {ADVISOR_UI_CONSTANTS.WELCOME_DESCRIPTION}
              </p>
            </div>

            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Câu hỏi gợi ý nhanh
              </p>
              <div className="grid grid-cols-1 gap-2">
                {ADVISOR_UI_CONSTANTS.QUICK_PROMPTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSendMessage(item.prompt)}
                    className="group flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-xs font-medium text-card-foreground shadow-2xs transition-all duration-150 motion-reduce:transition-none hover:border-primary/40 hover:bg-secondary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary transition-colors motion-reduce:transition-none group-hover:bg-card">
                      {QUICK_PROMPT_ICONS[item.category]}
                    </span>
                    <span className="flex-1 leading-snug">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <AdvisorMessageBubble
              key={message.id}
              message={message}
              onNavigate={onClose}
            />
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <Compass className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-xs font-medium text-muted-foreground shadow-xs">
              <Loader2
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none text-primary"
                aria-hidden="true"
              />
              <span>Đang tra cứu cẩm nang &amp; cơ sở dữ liệu địa điểm...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Footer */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-border bg-card p-3 md:rounded-b-2xl"
      >
        <div className="flex items-end gap-2 rounded-xl border border-input bg-muted/50 px-3 py-1.5 transition-colors motion-reduce:transition-none focus-within:border-primary focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/20">
          <label htmlFor="advisor-chat-input" className="sr-only">
            Nhập câu hỏi du lịch của bạn
          </label>
          <textarea
            id="advisor-chat-input"
            ref={textareaRef}
            rows={1}
            maxLength={ADVISOR_UI_CONSTANTS.MAX_INPUT_LENGTH}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Hỏi giá vé, kinh nghiệm, quán ngon..."
            className="max-h-[120px] min-h-[28px] flex-1 resize-none bg-transparent py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            aria-label="Gửi tin nhắn tư vấn"
            className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs transition-all motion-reduce:transition-none hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {isLoading ? (
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import * as React from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAdvisorChat } from '../hooks/useAdvisorChat';
import { AdvisorDrawer } from './AdvisorDrawer';

export function AdvisorWidget() {
  const [isOpen, setIsOpen] = React.useState(false);
  const {
    messages,
    isLoading,
    isRestoring,
    sendMessage,
    startNewSession,
  } = useAdvisorChat(isOpen);

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
          <>
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <span className="hidden text-sm font-semibold sm:inline">
              Hỏi Cố Vấn AI
            </span>
          </>
        )}
      </button>
    </>
  );
}

'use client';

import * as React from 'react';
import { useAdvisorChat } from '../hooks/useAdvisorChat';
import { AdvisorDrawer } from './AdvisorDrawer';

export function AdvisorWidget() {
  const [isOpen, setIsOpen] = React.useState(false);
  const fabRef = React.useRef<HTMLButtonElement>(null);

  const {
    messages,
    isLoading,
    isRestoring,
    sendMessage,
    startNewSession,
  } = useAdvisorChat(isOpen);

  // Listen for programmatic open requests (e.g. from mobile map view)
  React.useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('tripgenie:open-advisor', handleOpen);
    return () => window.removeEventListener('tripgenie:open-advisor', handleOpen);
  }, []);

  const handleCloseDrawer = () => {
    setIsOpen(false);
    fabRef.current?.focus();
  };

  return (
    <>
      <AdvisorDrawer
        isOpen={isOpen}
        onClose={handleCloseDrawer}
        messages={messages}
        isLoading={isLoading}
        isRestoring={isRestoring}
        onSendMessage={sendMessage}
        onNewSession={startNewSession}
      />

      {/* Floating Circular Chat Cloud Trigger (Fixed at bottom-right corner, aligned with Copilot) */}
      <div className="fixed bottom-6 right-4 sm:right-6 z-40 group print:hidden">
        <button
          ref={fabRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={
            isOpen ? 'Đóng cố vấn du lịch TripGenie' : 'Mở cố vấn du lịch TripGenie'
          }
          aria-expanded={isOpen}
          className="relative size-12 sm:size-14 rounded-full bg-[#0194F3] hover:bg-[#007AD0] text-white flex items-center justify-center shadow-lg shadow-blue-500/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0194F3]"
        >
          {isOpen ? (
            <i className="fa-solid fa-xmark text-lg sm:text-xl" aria-hidden="true" />
          ) : (
            <i className="fa-solid fa-comment-dots text-lg sm:text-xl" aria-hidden="true" />
          )}
        </button>

        <div className="hidden lg:block absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-xl bg-[#10243A] text-white text-xs font-bold whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Cố vấn du lịch AI
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-[#10243A]" />
        </div>
      </div>
    </>
  );
}

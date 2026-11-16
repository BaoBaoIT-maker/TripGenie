'use client';

import * as React from 'react';
import { TripGenieMark } from '@/components/common/TripGenieMark';
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

      {/* Floating Circular Chat Cloud Trigger */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={
          isOpen ? 'Đóng cố vấn du lịch TripGenie' : 'Mở cố vấn du lịch TripGenie'
        }
        aria-expanded={isOpen}
        className="fixed bottom-20 right-4 z-40 [body.mobile-map-active_&]:max-lg:hidden flex size-12 cursor-pointer items-center justify-center rounded-full bg-[#0194F3] text-white shadow-lg shadow-blue-500/25 transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:bg-[#0084DE] hover:shadow-xl hover:shadow-blue-500/35 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-6 md:right-6"
      >
        {isOpen ? (
          <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
        ) : (
          <i className="fa-solid fa-comment-dots text-xl" aria-hidden="true" />
        )}
      </button>
    </>
  );
}

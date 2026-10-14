'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { advisorService } from '@/services/advisor.service';
import {
  ADVISOR_UI_CONSTANTS,
  AdvisorMessageItem,
} from '@/types/advisor';

export function useAdvisorChat(isOpen: boolean) {
  const [messages, setMessages] = useState<AdvisorMessageItem[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const hasRestoredRef = useRef(false);

  // Restore saved session ID and message history when drawer opens for the first time
  useEffect(() => {
    if (!isOpen || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const savedSessionId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(ADVISOR_UI_CONSTANTS.STORAGE_SESSION_KEY)
        : null;

    if (!savedSessionId) return;

    setSessionId(savedSessionId);
    setIsRestoring(true);

    advisorService
      .getSessionMessages(savedSessionId)
      .then((history) => {
        if (Array.isArray(history) && history.length > 0) {
          setMessages(history);
        }
      })
      .catch(() => {
        // Session expired or deleted on server -> clear stale localStorage key
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(
            ADVISOR_UI_CONSTANTS.STORAGE_SESSION_KEY,
          );
        }
        setSessionId(undefined);
      })
      .finally(() => {
        setIsRestoring(false);
      });
  }, [isOpen]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || isLoading) return;

      const tempUserMsgId = `user-${Date.now()}`;
      const optimisticUserMessage: AdvisorMessageItem = {
        id: tempUserMsgId,
        sender: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUserMessage]);
      setIsLoading(true);

      try {
        const response = await advisorService.sendMessage({
          message: trimmed,
          sessionId,
        });

        if (response.sessionId && response.sessionId !== sessionId) {
          setSessionId(response.sessionId);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              ADVISOR_UI_CONSTANTS.STORAGE_SESSION_KEY,
              response.sessionId,
            );
          }
        }

        const agentMessage: AdvisorMessageItem = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          content: response.reply,
          places: response.places,
          citations: response.citations,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, agentMessage]);
      } catch (err) {
        const errorMessage =
          err instanceof Error && err.message
            ? err.message
            : ADVISOR_UI_CONSTANTS.FALLBACK_ERROR_MESSAGE;

        const fallbackAgentMessage: AdvisorMessageItem = {
          id: `error-${Date.now()}`,
          sender: 'agent',
          content: errorMessage,
          createdAt: new Date().toISOString(),
          isError: true,
        };

        setMessages((prev) => [...prev, fallbackAgentMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId],
  );

  const startNewSession = useCallback(async () => {
    const oldSessionId = sessionId;
    setMessages([]);
    setSessionId(undefined);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADVISOR_UI_CONSTANTS.STORAGE_SESSION_KEY);
    }

    if (oldSessionId) {
      advisorService.deleteSession(oldSessionId).catch(() => {
        // Ignore non-critical cleanup error
      });
    }
  }, [sessionId]);

  return {
    messages,
    sessionId,
    isLoading,
    isRestoring,
    sendMessage,
    startNewSession,
  };
}

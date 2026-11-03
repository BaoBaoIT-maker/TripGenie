import { apiClient } from '@/lib/api-client';
import {
  AdvisorChatRequest,
  AdvisorChatResponse,
  AdvisorMessageItem,
  AdvisorSessionSummary,
} from '@/types/advisor';

const ADVISOR_ENDPOINTS = {
  CHAT: '/advisor/chat',
  SESSIONS: '/advisor/sessions',
  SESSION_MESSAGES: (sessionId: string) =>
    `/advisor/sessions/${sessionId}/messages`,
  DELETE_SESSION: (sessionId: string) => `/advisor/sessions/${sessionId}`,
} as const;

export const advisorService = {
  async sendMessage(payload: AdvisorChatRequest): Promise<AdvisorChatResponse> {
    return apiClient<AdvisorChatResponse>(ADVISOR_ENDPOINTS.CHAT, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getSessions(): Promise<AdvisorSessionSummary[]> {
    return apiClient<AdvisorSessionSummary[]>(ADVISOR_ENDPOINTS.SESSIONS, {
      method: 'GET',
    });
  },

  async getSessionMessages(sessionId: string): Promise<AdvisorMessageItem[]> {
    return apiClient<AdvisorMessageItem[]>(
      ADVISOR_ENDPOINTS.SESSION_MESSAGES(sessionId),
      {
        method: 'GET',
      },
    );
  },

  async deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
    return apiClient<{ deleted: boolean }>(
      ADVISOR_ENDPOINTS.DELETE_SESSION(sessionId),
      {
        method: 'DELETE',
      },
    );
  },
};

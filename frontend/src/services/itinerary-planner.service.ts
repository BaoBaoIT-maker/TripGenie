import { apiClient, ApiClientError } from '@/lib/api-client';
import type {
  GenerateItineraryRequest,
  TransitPreviewRequest,
  TransitMode,
  IntercityTransit,
  ItineraryDetail,
  CopilotChatResponse,
  CopilotHistoryMessage,
  AlternativePlaceItem,
} from '@/types/itinerary';

// Re-export so callers that import ApiError from here don't break
export { ApiClientError as ApiError };

export const itineraryService = {
  previewTransit: (dto: TransitPreviewRequest) =>
    apiClient<IntercityTransit>('/itineraries/transit-preview', { method: 'POST', body: JSON.stringify(dto) }),

  generateItinerary: (dto: GenerateItineraryRequest) =>
    apiClient<ItineraryDetail>('/itineraries/generate', { method: 'POST', body: JSON.stringify(dto) }),

  getItinerary: (id: string) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}`),

  listItineraries: () =>
    apiClient<ItineraryDetail[]>('/itineraries'),

  deleteItinerary: (id: string) =>
    apiClient<{ success: boolean; id: string }>(`/itineraries/${id}`, { method: 'DELETE' }),

  cloneItinerary: (id: string) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/clone`, { method: 'POST' }),

  bulkDeleteItineraries: (ids: string[]) =>
    apiClient<{ success: boolean; count: number }>('/itineraries/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

  updateTransitMode: (id: string, transitMode: TransitMode) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/transit-mode`, { method: 'PATCH', body: JSON.stringify({ transitMode }) }),

  chatCopilot: (id: string, message: string, sessionId?: string) =>
    apiClient<CopilotChatResponse>(`/itineraries/${id}/chat`, { method: 'POST', body: JSON.stringify({ message, sessionId }) }),

  getChatHistory: (id: string, sessionId?: string) =>
    apiClient<CopilotHistoryMessage[]>(`/itineraries/${id}/chat/history${sessionId ? `?sessionId=${sessionId}` : ''}`),

  getActivityAlternatives: (id: string, destinationId: string) =>
    apiClient<AlternativePlaceItem[]>(`/itineraries/${id}/destinations/${destinationId}/alternatives`),

  directSwapActivity: (id: string, destinationId: string, newPlaceId: string) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/destinations/${destinationId}/swap`, { method: 'POST', body: JSON.stringify({ newPlaceId }) }),

  applyProposal: (id: string, toolName: string, args: Record<string, unknown>, proposalId?: string) =>
    apiClient<{ success: boolean; message: string; itinerary: ItineraryDetail }>(`/itineraries/${id}/copilot/apply-proposal`, { method: 'POST', body: JSON.stringify({ toolName, args, proposalId }) }),

  updateCoverPhoto: (id: string, coverPhoto: string) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/cover-photo`, { method: 'PATCH', body: JSON.stringify({ coverPhoto }) }),
};

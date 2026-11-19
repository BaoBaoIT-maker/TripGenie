import { apiClient, ApiClientError } from '@/lib/api-client';
import type {
  GenerateItineraryRequest,
  TransitPreviewRequest,
  TransitMode,
  IntercityTransit,
  ItineraryDetail,
  TourBriefing,
  CopilotChatResponse,
  CopilotHistoryMessage,
  AlternativePlaceItem,
  AddDestinationRequest,
  UpdateDestinationRequest,
  UpdateItineraryMetaRequest,
  UpdateItineraryLodgingRequest,
  ItineraryLodgingSuggestionsResponse,
  MoveDirection,
  TripWeatherResponse,
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

  listItineraries: (scope?: 'OWNED' | 'JOINED') =>
    apiClient<ItineraryDetail[]>(`/itineraries${scope ? `?scope=${scope}` : ''}`),

  deleteItinerary: (id: string) =>
    apiClient<{ success: boolean; id: string }>(`/itineraries/${id}`, { method: 'DELETE' }),

  cloneItinerary: (id: string) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/clone`, { method: 'POST' }),

  bulkDeleteItineraries: (ids: string[]) =>
    apiClient<{ success: boolean; count: number }>('/itineraries/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

  updateTransitMode: (id: string, transitMode: TransitMode) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/transit-mode`, { method: 'PATCH', body: JSON.stringify({ transitMode }) }),

  chatCopilot: (id: string, message: string, sessionId?: string, autoApply?: boolean) =>
    apiClient<CopilotChatResponse>(`/itineraries/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        ...(sessionId !== undefined ? { sessionId } : {}),
        ...(autoApply !== undefined ? { autoApply } : {}),
      }),
    }),

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

  updateTourBriefing: (id: string, dto: TourBriefing) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/tour-briefing`, { method: 'PATCH', body: JSON.stringify(dto) }),

  getWeather: (id: string) =>
    apiClient<TripWeatherResponse>(`/itineraries/${id}/weather`),

  updateItineraryMeta: (id: string, dto: UpdateItineraryMetaRequest) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  addDestination: (id: string, dto: AddDestinationRequest) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/destinations`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  updateDestination: (
    id: string,
    destinationId: string,
    dto: UpdateDestinationRequest,
  ) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/destinations/${destinationId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  moveDestination: (id: string, destinationId: string, direction: MoveDirection) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/destinations/${destinationId}/move`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    }),

  removeDestination: (id: string, destinationId: string) =>
    apiClient<ItineraryDetail>(`/itineraries/${id}/destinations/${destinationId}`, {
      method: 'DELETE',
    }),

  getLodgingSuggestions: (
    id: string,
    params?: { night?: number; budget?: string },
  ) => {
    const qs = new URLSearchParams();
    if (params?.night != null) qs.set('night', String(params.night));
    if (params?.budget) qs.set('budget', params.budget);
    const query = qs.toString();
    return apiClient<ItineraryLodgingSuggestionsResponse>(
      `/itineraries/${id}/lodging-suggestions${query ? `?${query}` : ''}`,
    );
  },

  updateLodging: (id: string, dto: UpdateItineraryLodgingRequest) => {
    const { placeId, fromNight, toNight } = dto;
    return apiClient<ItineraryDetail>(`/itineraries/${id}/lodging`, {
      method: 'PUT',
      body: JSON.stringify({ placeId, fromNight, toNight }),
    });
  },
};

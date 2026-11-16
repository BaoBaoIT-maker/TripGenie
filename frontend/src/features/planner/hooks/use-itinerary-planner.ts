import { useQuery, useMutation, useQueryClient, skipToken } from '@tanstack/react-query';
import { itineraryService, ApiError } from '@/services/itinerary-planner.service';
import { COPILOT_TOOL_NAMES } from '@/features/planner/utils/itinerary-schedule.util';
import { NON_RETRYABLE_HTTP_STATUS } from '@/features/planner/constants/itinerary.constants';
import type {
  GenerateItineraryRequest,
  TransitPreviewRequest,
  ItineraryDetail,
  TourBriefing,
  TransitMode,
  AddDestinationRequest,
  UpdateDestinationRequest,
  UpdateItineraryMetaRequest,
  MoveDirection,
} from '@/types/itinerary';

const TRANSIT_STALE_MS = 10 * 60 * 1000; // 10 min — pricing rarely changes mid-session
const WEATHER_STALE_MS = 10 * 60 * 1000;

export const itineraryKeys = {
  all: ['itineraries'] as const,
  lists: () => ['itineraries', 'list'] as const,
  detail: (id: string) => ['itineraries', 'detail', id] as const,
  weather: (id: string) => ['itineraries', 'weather', id] as const,
};

type ListInvalidation = 'none' | 'lists' | 'all';

/**
 * Mutation whose response is the fresh ItineraryDetail: seeds the detail cache and,
 * when requested, refreshes dependent list queries.
 */
function useItineraryDetailMutation<TVariables>(
  itineraryId: string,
  mutationFn: (variables: TVariables) => Promise<ItineraryDetail>,
  invalidate: ListInvalidation = 'none',
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (updated) => {
      queryClient.setQueryData(itineraryKeys.detail(itineraryId), updated);
      if (invalidate !== 'none') {
        queryClient.invalidateQueries({
          queryKey: invalidate === 'all' ? itineraryKeys.all : itineraryKeys.lists(),
        });
      }
    },
  });
}
/** List itineraries owned by the current authenticated user. */
export function useItinerariesListQuery(scope: 'OWNED' | 'JOINED' = 'OWNED', options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['itineraries', 'list', scope] as const,
    queryFn: () => itineraryService.listItineraries(scope),
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: options?.enabled ?? true,
  });
}

/** Preview intercity transit before the wizard submits. Disabled when params is null. */
export function useTransitPreview(params: TransitPreviewRequest | null) {
  return useQuery({
    queryKey: ['transit-preview', params],
    queryFn: params ? () => itineraryService.previewTransit(params) : skipToken,
    staleTime: TRANSIT_STALE_MS,
    retry: false,
  });
}

/** Fetch a saved itinerary by id. No retry on auth/not-found errors. */
export function useItineraryQuery(id: string) {
  return useQuery({
    queryKey: itineraryKeys.detail(id),
    queryFn: () => itineraryService.getItinerary(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
    refetchOnMount: true,
    retry: (_, err) => {
      if (err instanceof ApiError && NON_RETRYABLE_HTTP_STATUS.includes(err.status)) return false;
      return true;
    },
  });
}

/** Trigger AI generation; seed the detail cache on success for instant navigation. */
export function useGenerateItinerary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: GenerateItineraryRequest) => itineraryService.generateItinerary(dto),
    onSuccess: (data: ItineraryDetail) => {
      queryClient.setQueryData(itineraryKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
  });
}

/** Soft-delete an itinerary. If cloned by others, clones are unaffected. */
export function useDeleteItinerary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => itineraryService.deleteItinerary(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: itineraryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
  });
}

/** Clone an existing itinerary into current user's trips. */
export function useCloneItinerary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => itineraryService.cloneItinerary(id),
    onSuccess: (data: ItineraryDetail) => {
      queryClient.setQueryData(itineraryKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
  });
}

/** Soft-delete multiple itineraries in batch. */
export function useBulkDeleteItineraries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => itineraryService.bulkDeleteItineraries(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
  });
}

/** Update transit mode of an itinerary (recalculates routes, prices, budget). */
export function useUpdateTransitMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transitMode }: { id: string; transitMode: TransitMode }) =>
      itineraryService.updateTransitMode(id, transitMode),
    onSuccess: (data: ItineraryDetail) => {
      queryClient.setQueryData(itineraryKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
  });
}

/** Send a chat message to Genie Copilot with AI Tool Calling. */
export function useCopilotChat(itineraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      message,
      sessionId,
      autoApply,
    }: {
      message: string;
      sessionId?: string;
      autoApply?: boolean;
    }) => itineraryService.chatCopilot(itineraryId, message, sessionId, autoApply),
    onSuccess: (res) => {
      if (res.modified && res.itinerary) {
        queryClient.setQueryData(itineraryKeys.detail(itineraryId), res.itinerary);
      }
    },
  });
}

/** Fetch chat history for an itinerary session (enabled only for owners). */
export function useCopilotHistory(
  itineraryId: string,
  sessionId?: string,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['copilot-history', itineraryId, sessionId],
    queryFn: () => itineraryService.getChatHistory(itineraryId, sessionId),
    enabled: Boolean(itineraryId) && enabled,
  });
}

/** 1-click alternative places query for place card (Hybrid model). */
export function useActivityAlternatives(itineraryId: string, destinationId: string | null) {
  return useQuery({
    queryKey: ['activity-alternatives', itineraryId, destinationId],
    queryFn: destinationId
      ? () => itineraryService.getActivityAlternatives(itineraryId, destinationId)
      : skipToken,
    enabled: Boolean(itineraryId && destinationId),
    staleTime: 60 * 1000,
  });
}

/** 1-click direct swap on place card (Hybrid model). */
export function useDirectSwapActivity(itineraryId: string) {
  return useItineraryDetailMutation(
    itineraryId,
    ({ destinationId, newPlaceId }: { destinationId: string; newPlaceId: string }) =>
      itineraryService.directSwapActivity(itineraryId, destinationId, newPlaceId),
  );
}

/** Apply a user-confirmed proposal from Genie Copilot to update itinerary in DB. */
export function useApplyProposal(itineraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      toolName,
      args,
      proposalId,
    }: {
      toolName: string;
      args: Record<string, unknown>;
      proposalId?: string;
    }) => itineraryService.applyProposal(itineraryId, toolName, args, proposalId),
    onSuccess: (res) => {
      if (res.itinerary) {
        queryClient.setQueryData(itineraryKeys.detail(itineraryId), res.itinerary);
      }
    },
  });
}

/** Update itinerary cover photo */
export function useUpdateCoverPhoto(itineraryId: string) {
  return useItineraryDetailMutation(
    itineraryId,
    (coverPhoto: string) => itineraryService.updateCoverPhoto(itineraryId, coverPhoto),
    'all',
  );
}

/** Update itinerary tour leader & assembly briefing info */
export function useUpdateTourBriefing(itineraryId: string) {
  return useItineraryDetailMutation(
    itineraryId,
    (dto: TourBriefing) => itineraryService.updateTourBriefing(itineraryId, dto),
    'all',
  );
}

/** Add a specific place directly to a chosen day & time slot of an existing itinerary. */
export function useAddPlaceToItinerary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itineraryId,
      dayNumber,
      placeId,
      placeName,
      timeSlot,
    }: {
      itineraryId: string;
      dayNumber: number;
      placeId: string;
      placeName: string;
      timeSlot?: string;
    }) =>
      itineraryService.applyProposal(itineraryId, COPILOT_TOOL_NAMES.ADD_ACTIVITY, {
        dayNumber,
        placeId,
        query: placeName,
        timeSlot,
      }),
    onSuccess: (res, variables) => {
      if (res.itinerary) {
        queryClient.setQueryData(itineraryKeys.detail(variables.itineraryId), res.itinerary);
      }
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
  });
}

/** Fetch trip weather forecast / seasonal climate trend cached on the backend. */
export function useItineraryWeatherQuery(id: string) {
  return useQuery({
    queryKey: itineraryKeys.weather(id),
    queryFn: () => itineraryService.getWeather(id),
    enabled: Boolean(id),
    staleTime: WEATHER_STALE_MS,
    retry: (_, err) => {
      if (err instanceof ApiError && NON_RETRYABLE_HTTP_STATUS.includes(err.status)) return false;
      return true;
    },
  });
}

/** Update trip metadata (title/description for editors & owners, partySize for owners). */
export function useUpdateItineraryMeta(itineraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateItineraryMetaRequest) =>
      itineraryService.updateItineraryMeta(itineraryId, dto),
    onSuccess: (updated) => {
      queryClient.setQueryData(itineraryKeys.detail(itineraryId), updated);
      queryClient.invalidateQueries({ queryKey: itineraryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['itinerary-weather', itineraryId] });
    },
  });
}

/** Move a destination up or down within the same day (swap order + shift times). */
export function useMoveDestination(itineraryId: string) {
  return useItineraryDetailMutation(
    itineraryId,
    ({ destinationId, direction }: { destinationId: string; direction: MoveDirection }) =>
      itineraryService.moveDestination(itineraryId, destinationId, direction),
  );
}

/** Direct DB add destination into a specific day without LLM round-trip. */
export function useAddDestination(itineraryId: string) {
  return useItineraryDetailMutation(
    itineraryId,
    (dto: AddDestinationRequest) => itineraryService.addDestination(itineraryId, dto),
    'lists',
  );
}

/** Direct DB update destination (dayNumber, startTime, endTime, notes). */
export function useUpdateDestination(itineraryId: string) {
  return useItineraryDetailMutation(
    itineraryId,
    ({ destinationId, dto }: { destinationId: string; dto: UpdateDestinationRequest }) =>
      itineraryService.updateDestination(itineraryId, destinationId, dto),
  );
}

/** Direct DB remove destination from an itinerary (recomputes totalPlaces & budget). */
export function useRemoveDestination(itineraryId: string) {
  return useItineraryDetailMutation(
    itineraryId,
    (destinationId: string) => itineraryService.removeDestination(itineraryId, destinationId),
    'lists',
  );
}

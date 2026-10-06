import { useQuery, useMutation, useQueryClient, skipToken } from '@tanstack/react-query';
import { itineraryService, ApiError } from '@/services/itinerary-planner.service';
import type {
  GenerateItineraryRequest,
  TransitPreviewRequest,
  ItineraryDetail,
  TransitMode,
} from '@/types/itinerary';

const TRANSIT_STALE_MS = 10 * 60 * 1000; // 10 min — pricing rarely changes mid-session

export const itineraryKeys = {
  all: ['itineraries'] as const,
  lists: () => ['itineraries', 'list'] as const,
  detail: (id: string) => ['itineraries', 'detail', id] as const,
};

/** List all itineraries created in the system. */
export function useItinerariesListQuery() {
  return useQuery({
    queryKey: itineraryKeys.lists(),
    queryFn: () => itineraryService.listItineraries(),
    staleTime: 0,
    refetchOnMount: 'always',
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
    staleTime: 5 * 60 * 1000,
    retry: (_, err) => {
      if (err instanceof ApiError && [401, 403, 404].includes(err.status)) return false;
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
    mutationFn: ({ message, sessionId }: { message: string; sessionId?: string }) =>
      itineraryService.chatCopilot(itineraryId, message, sessionId),
    onSuccess: (res) => {
      if (res.modified && res.itinerary) {
        queryClient.setQueryData(itineraryKeys.detail(itineraryId), res.itinerary);
      }
    },
  });
}

/** Fetch chat history for an itinerary session. */
export function useCopilotHistory(itineraryId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['copilot-history', itineraryId, sessionId],
    queryFn: () => itineraryService.getChatHistory(itineraryId, sessionId),
    enabled: Boolean(itineraryId),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ destinationId, newPlaceId }: { destinationId: string; newPlaceId: string }) =>
      itineraryService.directSwapActivity(itineraryId, destinationId, newPlaceId),
    onSuccess: (updated) => {
      queryClient.setQueryData(itineraryKeys.detail(itineraryId), updated);
    },
  });
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (coverPhoto: string) => itineraryService.updateCoverPhoto(itineraryId, coverPhoto),
    onSuccess: (updated) => {
      queryClient.setQueryData(itineraryKeys.detail(itineraryId), updated);
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
  });
}


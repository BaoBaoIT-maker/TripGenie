import { useQuery, useMutation, useQueryClient, skipToken } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { itineraryService, ApiError } from '@/services/itinerary-planner.service';
import { COPILOT_TOOL_NAMES, swapStopsOptimistically } from '@/features/planner/utils/itinerary-schedule.util';
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
  UpdateItineraryLodgingRequest,
  ItineraryDayLodging,
  MoveDirection,
} from '@/types/itinerary';

const TRANSIT_STALE_MS = 10 * 60 * 1000; // 10 min — pricing rarely changes mid-session
const WEATHER_STALE_MS = 10 * 60 * 1000;
const LODGING_SUGGESTIONS_STALE_MS = 5 * 60 * 1000;

export const itineraryKeys = {
  all: ['itineraries'] as const,
  lists: () => ['itineraries', 'list'] as const,
  detail: (id: string) => ['itineraries', 'detail', id] as const,
  weather: (id: string) => ['itineraries', 'weather', id] as const,
  lodgingSuggestions: (id: string, night: number, budget?: string) =>
    ['itineraries', 'lodging-suggestions', id, night, budget ?? ''] as const,
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
  const { locale } = useI18n();
  return useQuery({
    queryKey: ['transit-preview', locale, params],
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

/** Move a destination up or down within the same day with Optimistic UI update. */
export function useMoveDestination(itineraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      destinationId,
      direction,
    }: {
      destinationId: string;
      direction: MoveDirection;
    }) =>
      itineraryService.moveDestination(itineraryId, destinationId, direction),

    onMutate: async ({ destinationId, direction }) => {
      // 1. Cancel in-flight queries so they don't overwrite optimistic cache
      await queryClient.cancelQueries({
        queryKey: itineraryKeys.detail(itineraryId),
      });

      // 2. Snapshot previous state for rollback
      const previousItinerary = queryClient.getQueryData<ItineraryDetail>(
        itineraryKeys.detail(itineraryId)
      );

      // 3. Optimistically swap stops in cache (0ms perceived latency)
      if (previousItinerary) {
        const optimisticItinerary = swapStopsOptimistically(
          previousItinerary,
          destinationId,
          direction
        );
        queryClient.setQueryData(
          itineraryKeys.detail(itineraryId),
          optimisticItinerary
        );
      }

      return { previousItinerary };
    },

    onError: (_err, _variables, context) => {
      // Rollback to previous state on failure
      if (context?.previousItinerary) {
        queryClient.setQueryData(
          itineraryKeys.detail(itineraryId),
          context.previousItinerary
        );
      }
    },

    onSuccess: (updated) => {
      // Sync official server calculation (accurate times and recalculated transit)
      queryClient.setQueryData(itineraryKeys.detail(itineraryId), updated);
    },
  });
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

/** Fetch 3 curated groups of lodging suggestions for a specific night. */
export function useLodgingSuggestionsQuery(
  itineraryId: string,
  nightNumber: number | null,
  budgetLevel?: string,
) {
  return useQuery({
    queryKey: itineraryKeys.lodgingSuggestions(
      itineraryId,
      nightNumber ?? 1,
      budgetLevel,
    ),
    queryFn:
      nightNumber != null
        ? () =>
            itineraryService.getLodgingSuggestions(itineraryId, {
              night: nightNumber,
              budget: budgetLevel,
            })
        : skipToken,
    enabled: Boolean(itineraryId && nightNumber != null),
    staleTime: LODGING_SUGGESTIONS_STALE_MS,
    placeholderData: (prev) => prev,
  });
}

/** Prefetch lodging suggestions for one or more nights into React Query cache. */
export function usePrefetchLodgingSuggestions(
  itineraryId: string,
  budgetLevel?: string,
) {
  const queryClient = useQueryClient();
  return (nightNumber: number) => {
    if (!itineraryId || nightNumber < 1) return;
    void queryClient.prefetchQuery({
      queryKey: itineraryKeys.lodgingSuggestions(
        itineraryId,
        nightNumber,
        budgetLevel,
      ),
      queryFn: () =>
        itineraryService.getLodgingSuggestions(itineraryId, {
          night: nightNumber,
          budget: budgetLevel,
        }),
      staleTime: LODGING_SUGGESTIONS_STALE_MS,
    });
  };
}

/** Update lodging for a night range and re-optimize affected day routes. */
export function useUpdateLodging(itineraryId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const detailKey = itineraryKeys.detail(itineraryId);

  return useMutation({
    mutationFn: (dto: UpdateItineraryLodgingRequest) =>
      itineraryService.updateLodging(itineraryId, dto),
    onMutate: async (dto) => {
      // 1. Cancel outgoing queries so they do not overwrite optimistic data
      await queryClient.cancelQueries({ queryKey: detailKey });

      // 2. Snapshot current state for rollback
      const previousDetail =
        queryClient.getQueryData<ItineraryDetail>(detailKey);

      // 3. Optimistically update displayed lodging in cache immediately (< 0.1ms)
      if (previousDetail?.days && dto.optimisticLodging) {
        const { fromNight } = dto;
        const toNight = dto.toNight ?? fromNight;
        const totalDays = previousDetail.days.length;

        queryClient.setQueryData<ItineraryDetail>(detailKey, (old) => {
          if (!old?.days) return old;

          const updatedDays = old.days.map((day) => {
            const isCheckOut = totalDays > 1 && day.dayNumber === totalDays;
            const targetNight = isCheckOut ? totalDays - 1 : day.dayNumber;

            if (targetNight >= fromNight && targetNight <= toNight) {
              const prevLodging = day.lodging;
              const nextLodging: ItineraryDayLodging = {
                nightNumber: targetNight,
                isCheckOutDay: isCheckOut,
                isAutoSuggested: false,
                placeId: dto.placeId,
                name:
                  dto.optimisticLodging?.name ??
                  prevLodging?.name ??
                  t('planner.lodging.updatingNameFallback'),
                address:
                  dto.optimisticLodging?.address ??
                  prevLodging?.address ??
                  null,
                latitude:
                  dto.optimisticLodging?.latitude ??
                  prevLodging?.latitude ??
                  0,
                longitude:
                  dto.optimisticLodging?.longitude ??
                  prevLodging?.longitude ??
                  0,
                ratingAvg:
                  dto.optimisticLodging?.ratingAvg ??
                  prevLodging?.ratingAvg ??
                  null,
                reviewCount: prevLodging?.reviewCount ?? null,
                priceLevel: prevLodging?.priceLevel ?? null,
                priceRange: prevLodging?.priceRange ?? null,
                pricePerNight:
                  dto.optimisticLodging?.pricePerNight ??
                  prevLodging?.pricePerNight ??
                  null,
                imageUrl:
                  dto.optimisticLodging?.imageUrl ??
                  prevLodging?.imageUrl ??
                  null,
                distanceToFirstStopKm:
                  prevLodging?.distanceToFirstStopKm ?? null,
              };
              return { ...day, lodging: nextLodging };
            }
            return day;
          });

          return { ...old, days: updatedDays };
        });
      }

      return { previousDetail };
    },
    onError: (_err, _dto, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(detailKey, context.previousDetail);
      }
    },
    onSettled: (updated) => {
      if (updated) {
        queryClient.setQueryData(detailKey, updated);
      } else {
        void queryClient.invalidateQueries({ queryKey: detailKey });
      }
      void queryClient.invalidateQueries({
        queryKey: ['itineraries', 'lodging-suggestions', itineraryId],
      });
    },
  });
}

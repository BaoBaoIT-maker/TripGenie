import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collectionService,
  CollectionSummary,
  CollectionDetail,
  CreateCollectionPayload,
  UpdateCollectionPayload,
} from '@/services/collection.service';
import { toast } from 'sonner';

export const COLLECTION_KEYS = {
  all: ['collections'] as const,
  list: () => [...COLLECTION_KEYS.all, 'list'] as const,
  savedPlaceIds: () => [...COLLECTION_KEYS.all, 'saved-place-ids'] as const,
  detail: (id: string) => [...COLLECTION_KEYS.all, 'detail', id] as const,
  containing: (placeId: string) => [...COLLECTION_KEYS.all, 'containing', placeId] as const,
};

/**
 * Fetch list of collection IDs that contain a specific place.
 */
export function useCollectionsContainingPlace(
  placeId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: COLLECTION_KEYS.containing(placeId || ''),
    queryFn: () => collectionService.getCollectionsContainingPlace(placeId || ''),
    enabled: Boolean(placeId) && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 2,
    select: (ids: string[]) => new Set<string>(ids),
  });
}

/**
 * Fetch saved place IDs for fast O(1) bookmark lookup in PlaceCard.
 */
export function useSavedPlaceIds(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: COLLECTION_KEYS.savedPlaceIds(),
    queryFn: () => collectionService.getSavedPlaceIds(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: options?.enabled ?? true,
    select: (ids: string[]) => new Set<string>(ids),
  });
}

/**
 * Optimistic favorite toggle for instant UI feedback (0ms latency).
 */
export function useToggleFavorite(options?: {
  onSaved?: (data: { isSaved: boolean; collectionId: string; placeId: string }) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      placeId,
      collectionId,
    }: {
      placeId: string;
      collectionId?: string;
    }) => collectionService.togglePlace(placeId, collectionId),

    onMutate: async ({ placeId, collectionId }) => {
      await queryClient.cancelQueries({ queryKey: COLLECTION_KEYS.savedPlaceIds() });
      if (collectionId) {
        await queryClient.cancelQueries({ queryKey: COLLECTION_KEYS.detail(collectionId) });
      }

      const prevIds =
        queryClient.getQueryData<string[]>(COLLECTION_KEYS.savedPlaceIds()) || [];

      let prevDetail: CollectionDetail | undefined;
      if (collectionId) {
        prevDetail = queryClient.getQueryData<CollectionDetail>(
          COLLECTION_KEYS.detail(collectionId),
        );
        if (prevDetail?.places) {
          const isCurrentlyIn = prevDetail.places.some((p) => p.placeId === placeId);
          if (isCurrentlyIn) {
            queryClient.setQueryData<CollectionDetail>(
              COLLECTION_KEYS.detail(collectionId),
              {
                ...prevDetail,
                places: prevDetail.places.filter((p) => p.placeId !== placeId),
                _count: {
                  places: Math.max(0, (prevDetail._count?.places ?? 1) - 1),
                },
              },
            );
          }
        }
      }

      if (!collectionId) {
        const isAlreadySaved = prevIds.includes(placeId);
        const nextIds = isAlreadySaved
          ? prevIds.filter((id) => id !== placeId)
          : [...prevIds, placeId];
        queryClient.setQueryData<string[]>(COLLECTION_KEYS.savedPlaceIds(), nextIds);
      }

      return { prevIds, prevDetail, collectionId };
    },

    onError: (err: unknown, _variables, context) => {
      if (context?.prevIds) {
        queryClient.setQueryData<string[]>(
          COLLECTION_KEYS.savedPlaceIds(),
          context.prevIds,
        );
      }
      if (context?.collectionId && context?.prevDetail) {
        queryClient.setQueryData<CollectionDetail>(
          COLLECTION_KEYS.detail(context.collectionId),
          context.prevDetail,
        );
      }
      toast.error(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật mục đã lưu. Vui lòng thử lại.',
      );
    },

    onSuccess: (data) => {
      if (options?.onSaved) {
        options.onSaved(data);
      } else {
        toast.success(
          data.isSaved
            ? 'Đã lưu địa điểm vào bộ sưu tập'
            : 'Đã xóa địa điểm khỏi bộ sưu tập',
        );
      }
    },

    onSettled: (data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: COLLECTION_KEYS.savedPlaceIds() });
      queryClient.invalidateQueries({ queryKey: COLLECTION_KEYS.list() });
      const targetColId = variables?.collectionId || data?.collectionId;
      if (targetColId) {
        queryClient.invalidateQueries({
          queryKey: COLLECTION_KEYS.detail(targetColId),
        });
      }
      if (variables?.placeId) {
        queryClient.invalidateQueries({
          queryKey: COLLECTION_KEYS.containing(variables.placeId),
        });
      }
    },
  });
}

/**
 * Add a place to a specific collection.
 */
export function useAddPlaceToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      placeId,
      notes,
    }: {
      collectionId: string;
      placeId: string;
      notes?: string;
      collectionName?: string;
    }) => collectionService.addPlace(collectionId, placeId, notes),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.collectionName
          ? `Đã thêm địa điểm vào "${variables.collectionName}"!`
          : 'Đã thêm địa điểm vào bộ sưu tập!',
      );
      queryClient.invalidateQueries({
        queryKey: COLLECTION_KEYS.detail(variables.collectionId),
      });
      queryClient.invalidateQueries({
        queryKey: COLLECTION_KEYS.savedPlaceIds(),
      });
      queryClient.invalidateQueries({
        queryKey: COLLECTION_KEYS.list(),
      });
      queryClient.invalidateQueries({
        queryKey: COLLECTION_KEYS.containing(variables.placeId),
      });
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : 'Không thể thêm địa điểm',
      );
    },
  });
}

/**
 * Fetch all collections belonging to current user.
 */
export function useCollections() {
  return useQuery({
    queryKey: COLLECTION_KEYS.list(),
    queryFn: () => collectionService.getMyCollections(),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Fetch detail of a specific collection.
 */
export function useCollectionDetail(id: string) {
  return useQuery({
    queryKey: COLLECTION_KEYS.detail(id),
    queryFn: () => collectionService.getCollectionDetail(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Create a new collection.
 */
export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCollectionPayload) =>
      collectionService.createCollection(payload),
    onSuccess: () => {
      toast.success('Đã tạo bộ sưu tập mới');
      queryClient.invalidateQueries({ queryKey: COLLECTION_KEYS.list() });
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : 'Tạo bộ sưu tập thất bại',
      );
    },
  });
}

/**
 * Update an existing collection.
 */
export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateCollectionPayload;
    }) => collectionService.updateCollection(id, payload),
    onSuccess: (updated) => {
      toast.success('Đã cập nhật bộ sưu tập');
      queryClient.invalidateQueries({ queryKey: COLLECTION_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: COLLECTION_KEYS.detail(updated.id) });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    },
  });
}

/**
 * Delete a collection.
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => collectionService.deleteCollection(id),
    onSuccess: () => {
      toast.success('Đã xóa bộ sưu tập');
      queryClient.invalidateQueries({ queryKey: COLLECTION_KEYS.all });
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : 'Xóa bộ sưu tập thất bại',
      );
    },
  });
}

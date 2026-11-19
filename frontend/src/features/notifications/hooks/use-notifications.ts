"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { notificationService } from "@/services/notification.service";
import { NOTIFICATION_CONFIG } from "../config/notification.config";
import type {
  NotificationFilter,
  NotificationListResponse,
  UnreadCountResponse,
} from "@/types/notification";

export const NOTIFICATION_QUERY_KEYS = {
  all: (userId?: string) => ["notifications", userId] as const,
  list: (userId?: string, filter?: NotificationFilter) =>
    ["notifications", userId, "list", filter] as const,
  unreadCount: (userId?: string) =>
    ["notifications", userId, "unread-count"] as const,
};

export function useNotifications(
  filter: NotificationFilter = "ALL",
  limit: number = NOTIFICATION_CONFIG.PAGE_LIMIT,
) {
  const { user } = useAuth();
  const userId = user?.id;

  return useInfiniteQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.list(userId, filter),
    queryFn: ({ pageParam }) =>
      notificationService.getNotifications({
        filter,
        limit,
        cursor: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(userId),
    staleTime: 10_000,
  });
}

export function useUnreadNotificationCount() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(userId),
    queryFn: () => notificationService.getUnreadCount(),
    enabled: Boolean(userId),
    refetchInterval: NOTIFICATION_CONFIG.POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });
}

function markAllReadInPages(
  oldData: InfiniteData<NotificationListResponse> | undefined,
  readAtIso: string,
): InfiniteData<NotificationListResponse> | undefined {
  if (!oldData) return oldData;
  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => ({
        ...item,
        readAt: item.readAt ?? readAtIso,
      })),
    })),
  };
}

function markSingleReadInPages(
  oldData: InfiniteData<NotificationListResponse> | undefined,
  notificationId: string,
  readAtIso: string,
): InfiniteData<NotificationListResponse> | undefined {
  if (!oldData) return oldData;
  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === notificationId
          ? { ...item, readAt: item.readAt ?? readAtIso }
          : item,
      ),
    })),
  };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onMutate: async (id: string) => {
      if (!userId) return;

      await queryClient.cancelQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.all(userId),
      });

      const previousUnread = queryClient.getQueryData<UnreadCountResponse>(
        NOTIFICATION_QUERY_KEYS.unreadCount(userId),
      );
      const previousAllList = queryClient.getQueryData<
        InfiniteData<NotificationListResponse>
      >(NOTIFICATION_QUERY_KEYS.list(userId, "ALL"));

      const nowIso = new Date().toISOString();

      queryClient.setQueryData<UnreadCountResponse>(
        NOTIFICATION_QUERY_KEYS.unreadCount(userId),
        (old) => ({ count: Math.max(0, (old?.count ?? 1) - 1) }),
      );

      queryClient.setQueryData<InfiniteData<NotificationListResponse>>(
        NOTIFICATION_QUERY_KEYS.list(userId, "ALL"),
        (old) => markSingleReadInPages(old, id, nowIso),
      );

      return { previousUnread, previousAllList };
    },
    onError: (_err, _id, context) => {
      if (!userId || !context) return;
      queryClient.setQueryData(
        NOTIFICATION_QUERY_KEYS.unreadCount(userId),
        context.previousUnread,
      );
      queryClient.setQueryData(
        NOTIFICATION_QUERY_KEYS.list(userId, "ALL"),
        context.previousAllList,
      );
    },
    onSettled: () => {
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: NOTIFICATION_QUERY_KEYS.all(userId),
        });
      }
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onMutate: async () => {
      if (!userId) return;

      await queryClient.cancelQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.all(userId),
      });

      const previousUnread = queryClient.getQueryData<UnreadCountResponse>(
        NOTIFICATION_QUERY_KEYS.unreadCount(userId),
      );
      const previousAllList = queryClient.getQueryData<
        InfiniteData<NotificationListResponse>
      >(NOTIFICATION_QUERY_KEYS.list(userId, "ALL"));
      const previousUnreadList = queryClient.getQueryData<
        InfiniteData<NotificationListResponse>
      >(NOTIFICATION_QUERY_KEYS.list(userId, "UNREAD"));

      const nowIso = new Date().toISOString();

      // 1. Instantly clear unread count badge on the bell icon to 0
      queryClient.setQueryData<UnreadCountResponse>(
        NOTIFICATION_QUERY_KEYS.unreadCount(userId),
        { count: 0 },
      );

      // 2. Optimistically update all items in "ALL" feed to read (keep all items visible, remove unread indicator)
      queryClient.setQueryData<InfiniteData<NotificationListResponse>>(
        NOTIFICATION_QUERY_KEYS.list(userId, "ALL"),
        (old) => markAllReadInPages(old, nowIso),
      );

      return { previousUnread, previousAllList, previousUnreadList };
    },
    onError: (_err, _variables, context) => {
      if (!userId || !context) return;
      queryClient.setQueryData(
        NOTIFICATION_QUERY_KEYS.unreadCount(userId),
        context.previousUnread,
      );
      queryClient.setQueryData(
        NOTIFICATION_QUERY_KEYS.list(userId, "ALL"),
        context.previousAllList,
      );
      queryClient.setQueryData(
        NOTIFICATION_QUERY_KEYS.list(userId, "UNREAD"),
        context.previousUnreadList,
      );
    },
    onSettled: () => {
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: NOTIFICATION_QUERY_KEYS.all(userId),
        });
      }
    },
  });
}

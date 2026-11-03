"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { notificationService } from "@/services/notification.service";
import { NOTIFICATION_CONFIG } from "../config/notification.config";
import type { NotificationFilter } from "@/types/notification";

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

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
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
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: NOTIFICATION_QUERY_KEYS.all(userId),
        });
      }
    },
  });
}

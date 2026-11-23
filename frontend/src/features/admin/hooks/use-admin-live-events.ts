"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-client";
import {
  ADMIN_LIVE_EVENT_MESSAGES,
  ADMIN_LIVE_EVENT_TYPES,
  ADMIN_ROUTES,
} from "../admin.constants";
import { ADMIN_QUERY_KEYS } from "./use-admin";

export type AdminLiveEventType =
  (typeof ADMIN_LIVE_EVENT_TYPES)[keyof typeof ADMIN_LIVE_EVENT_TYPES];

interface AdminLiveEvent {
  type: AdminLiveEventType;
  payload?: {
    placeName?: string;
    postTitle?: string;
  };
  timestamp: string;
}

/**
 * Single SSE stream attached at AdminShell level (1 connection per online Admin).
 * Immediately invalidates the relevant Admin TanStack Query caches (<100ms)
 * and alerts the Admin via Sonner toast with 1-click deep-link navigation.
 */
export function useAdminLiveEvents(enabled: boolean) {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const streamUrl = `${API_BASE_URL}/admin/live-events`;
    const es = new EventSource(streamUrl, { withCredentials: true });

    es.onmessage = (event) => {
      if (!event.data) return;

      try {
        const liveEvent = JSON.parse(event.data) as AdminLiveEvent;
        if (!liveEvent?.type) return;

        switch (liveEvent.type) {
          case ADMIN_LIVE_EVENT_TYPES.PLACE_PHOTO_SUBMITTED: {
            void queryClient.invalidateQueries({
              queryKey: ADMIN_QUERY_KEYS.placePhotosPrefix,
            });
            void queryClient.invalidateQueries({
              queryKey: ADMIN_QUERY_KEYS.dashboardStats,
            });
            toast.info(
              ADMIN_LIVE_EVENT_MESSAGES.PLACE_PHOTO_SUBMITTED(
                liveEvent.payload?.placeName
              ),
              {
                action: {
                  label: "Duyệt ngay",
                  onClick: () => router.push(ADMIN_ROUTES.PLACES_PHOTOS),
                },
              }
            );
            break;
          }

          case ADMIN_LIVE_EVENT_TYPES.POST_NEEDS_MODERATION: {
            void queryClient.invalidateQueries({
              queryKey: ADMIN_QUERY_KEYS.moderationPostsPrefix,
            });
            void queryClient.invalidateQueries({
              queryKey: ADMIN_QUERY_KEYS.dashboardStats,
            });
            toast.info(ADMIN_LIVE_EVENT_MESSAGES.POST_NEEDS_MODERATION(), {
              action: {
                label: "Kiểm duyệt",
                onClick: () => router.push(ADMIN_ROUTES.MODERATION),
              },
            });
            break;
          }

          case ADMIN_LIVE_EVENT_TYPES.REPORT_SUBMITTED: {
            void queryClient.invalidateQueries({
              queryKey: ADMIN_QUERY_KEYS.moderationReportsPrefix,
            });
            void queryClient.invalidateQueries({
              queryKey: ADMIN_QUERY_KEYS.dashboardStats,
            });
            toast.info(
              ADMIN_LIVE_EVENT_MESSAGES.REPORT_SUBMITTED(
                liveEvent.payload?.postTitle
              ),
              {
                action: {
                  label: "Xem báo cáo",
                  onClick: () => router.push(ADMIN_ROUTES.MODERATION_REPORTS),
                },
              }
            );
            break;
          }
        }
      } catch {
        // Ignore heartbeat or malformed non-JSON messages
      }
    };

    es.onerror = () => {
      // Browser EventSource handles automatic reconnect natively
    };

    return () => {
      es.close();
    };
  }, [enabled, queryClient, router]);
}

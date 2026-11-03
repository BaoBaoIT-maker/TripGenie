import { apiClient } from '@/lib/api-client';
import type {
  MarkAllReadResponse,
  MarkReadResponse,
  NotificationFilter,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/types/notification';

export const notificationService = {
  async getNotifications(params: {
    filter: NotificationFilter;
    limit?: number;
    cursor?: string | null;
  }): Promise<NotificationListResponse> {
    const query = new URLSearchParams();
    query.set('filter', params.filter);
    if (params.limit) {
      query.set('limit', String(params.limit));
    }
    if (params.cursor) {
      query.set('cursor', params.cursor);
    }

    return apiClient<NotificationListResponse>(
      `/notifications?${query.toString()}`,
    );
  },

  async getUnreadCount(): Promise<UnreadCountResponse> {
    return apiClient<UnreadCountResponse>('/notifications/unread-count');
  },

  async markRead(id: string): Promise<MarkReadResponse> {
    return apiClient<MarkReadResponse>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  async markAllRead(): Promise<MarkAllReadResponse> {
    return apiClient<MarkAllReadResponse>('/notifications/read-all', {
      method: 'PATCH',
    });
  },
};

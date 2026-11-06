import { NotificationType } from '@prisma/client';
import { NotificationFilter } from '../notifications.constants';

export interface NotificationActor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface NotificationPost {
  id: string;
  title: string;
}

export interface NotificationItinerary {
  id: string;
  title: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actor: NotificationActor | null;
  post: NotificationPost | null;
  commentId: string | null;
  itinerary?: NotificationItinerary | null;
  invitationId?: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationListResult {
  items: NotificationItem[];
  nextCursor: string | null;
}

export interface QueryNotificationsParams {
  filter?: NotificationFilter;
  limit?: number;
  cursor?: string;
}

export interface INotificationsRepository {
  list(recipientId: string, params: QueryNotificationsParams): Promise<NotificationListResult>;
  countUnread(recipientId: string): Promise<number>;
  markRead(recipientId: string, id: string): Promise<{ id: string; readAt: string }>;
  markAllRead(recipientId: string): Promise<{ updatedCount: number; readAt: string }>;
}

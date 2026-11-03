export type NotificationType =
  | 'POST_LIKED'
  | 'POST_COMMENTED'
  | 'COMMENT_REPLIED'
  | 'TRIP_INVITED'
  | 'TRIP_INVITATION_ACCEPTED'
  | 'TRIP_INVITATION_DECLINED';

export type NotificationFilter = 'ALL' | 'UNREAD';

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

export interface NotificationListResponse {
  items: NotificationItem[];
  nextCursor: string | null;
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkReadResponse {
  id: string;
  readAt: string;
}

export interface MarkAllReadResponse {
  updatedCount: number;
  readAt: string;
}

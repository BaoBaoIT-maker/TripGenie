export enum AdminLiveEventType {
  PLACE_PHOTO_SUBMITTED = 'PLACE_PHOTO_SUBMITTED',
  POST_NEEDS_MODERATION = 'POST_NEEDS_MODERATION',
  REPORT_SUBMITTED = 'REPORT_SUBMITTED',
}

export interface AdminLiveEvent<T = unknown> {
  type: AdminLiveEventType;
  payload: T;
  timestamp: string;
}

export const ADMIN_EVENTS_CONFIG = {
  REDIS_CHANNEL: 'admin:live-events',
  HEARTBEAT_INTERVAL_MS: 30_000,
} as const;

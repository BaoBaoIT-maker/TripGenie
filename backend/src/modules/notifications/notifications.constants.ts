export const NOTIFICATIONS_CONSTANTS = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
  DROPDOWN_LIMIT: 8,
  MAX_EVENT_KEY_LENGTH: 128,
  CURSOR_SEPARATOR: '::',
} as const;

export const NotificationFilter = {
  ALL: 'ALL',
  UNREAD: 'UNREAD',
} as const;

export type NotificationFilter =
  (typeof NotificationFilter)[keyof typeof NotificationFilter];

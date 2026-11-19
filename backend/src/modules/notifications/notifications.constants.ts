export const NOTIFICATIONS_CONSTANTS = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
  DROPDOWN_LIMIT: 8,
  MAX_EVENT_KEY_LENGTH: 128,
  CURSOR_SEPARATOR: '::',
  EVENT_KEY_PREFIXES: {
    POST_LIKE: 'post-like',
    POST_COMMENT: 'post-comment',
    COMMENT_REPLY: 'comment-reply',
    POST_MODERATION: 'post-moderation',
  },
} as const;

export const NotificationFilter = {
  ALL: 'ALL',
  UNREAD: 'UNREAD',
} as const;

export type NotificationFilter =
  (typeof NotificationFilter)[keyof typeof NotificationFilter];

export const NotificationTargetType = {
  POST: 'POST',
  COMMENT: 'COMMENT',
  TRIP_INVITATION: 'TRIP_INVITATION',
} as const;

export type NotificationTargetType =
  (typeof NotificationTargetType)[keyof typeof NotificationTargetType];

export const NOTIFICATIONS_ERRORS = {
  INVALID_RECIPIENT_ID: 'recipientId không phải UUID hợp lệ',
  INVALID_ACTOR_ID: 'actorId không phải UUID hợp lệ',
  INVALID_TARGET_ID: 'targetId không phải UUID hợp lệ',
  INVALID_METADATA_OBJECT: 'Metadata phải là một object',
  METADATA_NON_EMPTY_NOT_ALLOWED:
    'Metadata trong MVP chỉ chấp nhận object rỗng {}',
  TARGET_TYPE_MISMATCH: (type: string, expected: string) =>
    `${type} phải có targetType là ${expected}`,
  INVALID_NOTIFICATION_TYPE: (type: string) =>
    `NotificationType không hợp lệ: ${type}`,
  INVALID_CURSOR: 'Cursor phân trang không hợp lệ',
} as const;

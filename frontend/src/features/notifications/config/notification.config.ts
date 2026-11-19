export const NOTIFICATION_CONFIG = {
  DROPDOWN_LIMIT: 8,
  PAGE_LIMIT: 20,
  POLL_INTERVAL_MS: 30_000,
  BADGE_CEILING: 99,
  PANEL_MAX_WIDTH: 380,
  PAGE_MAX_WIDTH: 760,
  ACTOR_FALLBACK_NAME: 'Một người dùng',
  SYSTEM_ACTOR_NAME: 'Hệ thống TripGenie',
  MODERATION_MESSAGES: {
    POST_APPROVED_SUFFIX: 'của bạn đã được phê duyệt và hiển thị công khai trên cộng đồng.',
    POST_FLAGGED_SUFFIX: 'của bạn đang chờ Quản trị viên duyệt thủ công',
    POST_REJECTED_SUFFIX: 'không được phê duyệt do vi phạm tiêu chuẩn cộng đồng',
  },
} as const;

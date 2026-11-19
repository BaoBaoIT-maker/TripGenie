export const COMMUNITY_CONFIG = {
  MODERATION_CHECK_DELAY_MS: 3500,
  INFO_TOAST_DURATION_MS: 5000,
  DISCOVERY_STALE_TIME_MS: 60 * 1000,
  GROUPS_STALE_TIME_MS: 60 * 1000,
  MESSAGES: {
    MODERATION_APPROVED:
      'Bài viết của bạn đã được duyệt và hiển thị công khai trên cộng đồng!',
    MODERATION_FLAGGED_FALLBACK:
      'Bài viết chưa thể kiểm duyệt tự động và đang chờ Quản trị viên duyệt thủ công.',
    MODERATION_REJECTED_PREFIX: 'Bài viết không vượt qua kiểm duyệt',
    MODERATION_REJECTED_FALLBACK: 'Vi phạm tiêu chuẩn cộng đồng',
    POST_NOT_FOUND_OR_DELETED:
      'Bài viết không còn tồn tại hoặc đã bị xóa, không thể kiểm duyệt được nữa.',
    POST_CREATED_PENDING:
      'Đã đăng bài viết! Hiện chỉ bạn và Quản trị viên thấy bài này trong khi chờ AI kiểm duyệt.',
    POST_CREATED_SUCCESS: 'Đã đăng bài chia sẻ lên cộng đồng!',
    POST_UPDATED_PENDING:
      'Đã lưu chỉnh sửa. Bài viết tạm ẩn với cộng đồng (chỉ bạn và Quản trị viên thấy) trong khi kiểm duyệt lại.',
    AI_REVIEWING_NOTE: 'Đang được AI kiểm duyệt tự động',
    ERROR_CREATE_POST: 'Không thể đăng bài viết',
    ERROR_UPDATE_POST: 'Không thể cập nhật bài viết',
  },
} as const;

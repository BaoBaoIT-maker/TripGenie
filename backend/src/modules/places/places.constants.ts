export const PLACE_PHOTO_CONTRIBUTION_CONFIG = {
  CLOUDINARY_FOLDER: 'tripgenie/places/contributions',
  SOURCE_TAG: 'user_contribution',
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_CAPTION_LENGTH: 200,
  ALLOWED_IMAGE_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ] as const,
  MESSAGES: {
    SUCCESS:
      'Đã gửi ảnh đóng góp thành công! Ảnh sẽ hiển thị sau khi Quản trị viên phê duyệt.',
    FILE_REQUIRED: 'Vui lòng chọn 1 tệp hình ảnh để đóng góp.',
    VIDEO_REJECTED:
      'Không hỗ trợ tải lên video. Vui lòng chỉ chọn hình ảnh (JPG, PNG, WebP).',
    INVALID_MIME:
      'Định dạng tệp không hợp lệ. Chỉ chấp nhận hình ảnh JPG, PNG hoặc WebP.',
    FILE_TOO_LARGE: 'Kích thước ảnh vượt quá giới hạn tối đa 10MB.',
    PLACE_NOT_FOUND: 'Không tìm thấy địa điểm du lịch hoặc địa điểm đã bị ẩn.',
    STORAGE_UNAVAILABLE: 'Dịch vụ lưu trữ ảnh hiện chưa sẵn sàng.',
  },
} as const;

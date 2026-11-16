export const ADMIN_CONSTANTS = {
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  DASHBOARD: {
    NEW_USERS_WINDOW_DAYS: 7,
  },
  VALIDATION: {
    MIN_REASON_LENGTH: 3,
    MAX_REASON_LENGTH: 500,
    MAX_NOTES_LENGTH: 500,
    MIN_PLACE_NAME_LENGTH: 2,
    MAX_PLACE_NAME_LENGTH: 255,
    MAX_ADDRESS_LENGTH: 500,
    MAX_PHONE_LENGTH: 30,
    MIN_GROUP_NAME_LENGTH: 2,
    MAX_GROUP_NAME_LENGTH: 120,
    MAX_GROUP_SLUG_LENGTH: 120,
    MAX_GROUP_SUBTITLE_LENGTH: 255,
    MAX_GROUP_DESCRIPTION_LENGTH: 1000,
  },
  COORDINATES: {
    MIN_LAT: -90,
    MAX_LAT: 90,
    MIN_LNG: -180,
    MAX_LNG: 180,
  },
  MODERATION: {
    HIGH_PRIORITY_REPORT_THRESHOLD: 20,
    MAX_AI_INPUT_CHARS: 1500,
    MAX_AI_OUTPUT_TOKENS: 80,
    AI_TIMEOUT_MS: 2500,
    DEFAULT_GEMINI_MODEL: 'gemini-2.5-flash',
    DEFAULT_GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
  },
  AUDIT_TARGET_TYPES: {
    USER: 'USER',
    PLACE: 'PLACE',
    COMMUNITY_POST: 'COMMUNITY_POST',
    POST_COMMENT: 'POST_COMMENT',
    COMMUNITY_GROUP: 'COMMUNITY_GROUP',
    CONTENT_REPORT: 'CONTENT_REPORT',
    TRAVEL_AREA: 'TRAVEL_AREA',
    SYSTEM_SETTING: 'SYSTEM_SETTING',
  },
  REDIS_KEYS: {
    AI_MODERATION_ENABLED: 'system:config:ai_moderation_enabled',
  },
  MESSAGES: {
    BAN_SUCCESS: 'Đã khóa tài khoản thành công',
    UNBAN_SUCCESS: 'Đã mở khóa tài khoản thành công',
    PROMOTE_SUCCESS: 'Đã thăng quyền Quản trị viên thành công',
    DEFAULT_UNBAN_NOTE: 'Mở khóa tài khoản người dùng',
    DEFAULT_PROMOTE_NOTE: 'Thăng quyền Quản trị viên (ADMIN)',
    REASON_REQUIRED: 'Lý do khóa tài khoản không được để trống',
    REASON_MIN_LENGTH: 'Lý do khóa tài khoản phải có ít nhất 3 ký tự',
    REASON_MAX_LENGTH: 'Lý do khóa tài khoản không vượt quá 500 ký tự',
    CREATE_PLACE_SUCCESS: 'Đã tạo địa điểm mới thành công',
    UPDATE_PLACE_SUCCESS: 'Đã cập nhật địa điểm thành công',
    DELETE_PLACE_SUCCESS: 'Đã xóa địa điểm an toàn thành công',
    DEFAULT_CREATE_PLACE_NOTE: 'Tạo mới địa điểm du lịch',
    DEFAULT_UPDATE_PLACE_NOTE: 'Cập nhật thông tin địa điểm du lịch',
    DEFAULT_DELETE_PLACE_NOTE: 'Xóa mềm địa điểm du lịch',
    CREATE_GROUP_SUCCESS: 'Đã tạo chủ đề cộng đồng mới thành công',
    UPDATE_GROUP_SUCCESS: 'Đã cập nhật chủ đề cộng đồng thành công',
    DELETE_GROUP_SUCCESS: 'Đã xóa chủ đề cộng đồng an toàn thành công',
    DEFAULT_CREATE_GROUP_NOTE: 'Tạo mới chủ đề cộng đồng',
    DEFAULT_UPDATE_GROUP_NOTE: 'Cập nhật chủ đề cộng đồng',
    DEFAULT_DELETE_GROUP_NOTE: 'Xóa mềm chủ đề cộng đồng',
    UPDATE_MODERATION_CONFIG_SUCCESS: 'Đã cập nhật cấu hình kiểm duyệt AI thành công',
    APPROVE_POST_SUCCESS: 'Đã phê duyệt bài viết hiển thị lên cộng đồng',
    REJECT_POST_SUCCESS: 'Đã từ chối bài viết thành công',
    RESOLVE_REPORT_SUCCESS: 'Đã xử lý báo cáo vi phạm thành công',
    DELETE_COMMENT_SUCCESS: 'Đã gỡ bình luận vi phạm thành công',
    PENDING_MANUAL_MODERATION_NOTE: 'Đang chờ Quản trị viên duyệt thủ công',
    AUTO_APPROVED_CLEAN_NOTE: 'Duyệt tự động (văn bản hợp lệ)',
    HARD_BLOCKLIST_REJECT_NOTE: 'Chứa từ ngữ bị cấm hoặc quảng cáo vi phạm tiêu chuẩn cộng đồng',
    FALLBACK_FLAGGED_NOTE: 'Nội dung chứa từ khóa nhạy cảm, cần Quản trị viên duyệt thủ công',
  },
} as const;

/**
 * Tier 1: Hard Blocklist (0.05ms, 0 AI tokens) — Bilingual Vietnamese & English.
 * Unambiguously toxic profanity, illegal gambling, or adult spam that is never valid in travel posts.
 */
export const MODERATION_HARD_BLOCK_PATTERNS: readonly RegExp[] = [
  /\b(đm|đkm|đcm|vcl|vkl|đéo|đĩ|lồn|cặc|buồi|chó đẻ|óc chó|mẹ mày|bố mày)\b/i,
  /\b(fuck|motherfucker|bitch|asshole|cunt|whore|slut|dickhead)\b/i,
  /\b(nhà cái|cá độ|tài xỉu|nổ hũ|xóc đĩa|lô đề|kubet|bet88|fun88|w88|fb88|gái gọi|thuốc lắc|ma túy|cần sa|onlyfans|pornhub|xvideos)\b/i,
];

/**
 * Tier 2: Ambiguous / Context-dependent Triggers (0.05ms, 0 AI tokens) — Bilingual Vietnamese & English.
 * Words that can be legitimate travel reviews ("không chặt chém", "đẹp chết mê") OR malicious attacks/scams.
 * Comments only invoke Tier 3 Gemini AI if they match one of these triggers.
 */
export const MODERATION_SUSPICIOUS_PATTERNS: readonly RegExp[] = [
  /\b(lừa đảo|lừa|chặt chém|bóc phốt|phốt|scam|rip-off|fraud|tẩy chay)\b/i,
  /\b(chuyển khoản|đặt cọc|cọc trước|zalo|telegram|inbox|ib ngay|vé giá rẻ|xả vé|deposit|wire transfer)\b/i,
  /\b(chết|giết|máu|đánh nhau|chém|đâm|kill|die|dead|blood)\b/i,
  /\b(ngu|điên|rác rưởi|bẩn thỉu|mất dạy|vô học|lũ|bọn|stupid|idiot|trash|garbage|disgusting)\b/i,
  /(?:\+84|0)[35789]\d{8}\b/, // Vietnamese phone numbers in comments/posts (potential spam)
  /https?:\/\/[^\s]+/i, // External links
];

export const ADMIN_ERROR_CODES = {
  NOT_AN_ADMIN: 'ADMIN_NOT_AN_ADMIN',
  USER_NOT_FOUND: 'ADMIN_USER_NOT_FOUND',
  CANNOT_MANAGE_ADMIN: 'ADMIN_CANNOT_MANAGE_ADMIN',
  USER_ALREADY_BANNED: 'ADMIN_USER_ALREADY_BANNED',
  USER_NOT_BANNED: 'ADMIN_USER_NOT_BANNED',
  USER_ALREADY_ADMIN: 'ADMIN_USER_ALREADY_ADMIN',
  PLACE_NOT_FOUND: 'ADMIN_PLACE_NOT_FOUND',
  INVALID_COORDINATES: 'ADMIN_INVALID_COORDINATES',
  COORDINATES_OUTSIDE_AREA: 'ADMIN_COORDINATES_OUTSIDE_AREA',
  CATEGORY_NOT_FOUND: 'ADMIN_CATEGORY_NOT_FOUND',
  CANNOT_DELETE_DEFAULT_GROUP: 'ADMIN_CANNOT_DELETE_DEFAULT_GROUP',
  INVALID_GROUP_SLUG: 'ADMIN_INVALID_GROUP_SLUG',
  PLACE_REFERENCED: 'ADMIN_PLACE_REFERENCED',
  GROUP_NOT_FOUND: 'ADMIN_GROUP_NOT_FOUND',
  GROUP_SLUG_EXISTS: 'ADMIN_GROUP_SLUG_EXISTS',
  AREA_NOT_FOUND: 'ADMIN_AREA_NOT_FOUND',
  POST_NOT_FOUND: 'ADMIN_POST_NOT_FOUND',
  POST_ALREADY_MODERATED: 'ADMIN_POST_ALREADY_MODERATED',
  COMMENT_NOT_FOUND: 'ADMIN_COMMENT_NOT_FOUND',
  REPORT_NOT_FOUND: 'ADMIN_REPORT_NOT_FOUND',
  CONTENT_VIOLATES_POLICY: 'COMMUNITY_CONTENT_VIOLATES_POLICY',
} as const;

export const ADMIN_ERRORS = {
  NOT_AN_ADMIN: {
    code: ADMIN_ERROR_CODES.NOT_AN_ADMIN,
    message: 'Bạn không có quyền truy cập tài nguyên này',
  },
  USER_NOT_FOUND: {
    code: ADMIN_ERROR_CODES.USER_NOT_FOUND,
    message: 'Không tìm thấy người dùng',
  },
  CANNOT_MANAGE_ADMIN: {
    code: ADMIN_ERROR_CODES.CANNOT_MANAGE_ADMIN,
    message: 'Không được phép thực hiện thao tác quản trị trên tài khoản Admin',
  },
  USER_ALREADY_BANNED: {
    code: ADMIN_ERROR_CODES.USER_ALREADY_BANNED,
    message: 'Tài khoản người dùng này đã bị khóa từ trước',
  },
  USER_NOT_BANNED: {
    code: ADMIN_ERROR_CODES.USER_NOT_BANNED,
    message: 'Tài khoản người dùng này đang hoạt động bình thường, không thể mở khóa',
  },
  USER_ALREADY_ADMIN: {
    code: ADMIN_ERROR_CODES.USER_ALREADY_ADMIN,
    message: 'Tài khoản này đã có quyền Quản trị viên',
  },
  PLACE_NOT_FOUND: {
    code: ADMIN_ERROR_CODES.PLACE_NOT_FOUND,
    message: 'Không tìm thấy địa điểm',
  },
  INVALID_COORDINATES: {
    code: ADMIN_ERROR_CODES.INVALID_COORDINATES,
    message: 'Tọa độ địa lý không hợp lệ theo chuẩn WGS84 (-90 đến 90 cho vĩ độ, -180 đến 180 cho kinh độ)',
  },
  COORDINATES_OUTSIDE_AREA: {
    code: ADMIN_ERROR_CODES.COORDINATES_OUTSIDE_AREA,
    message: 'Tọa độ địa điểm nằm ngoài phạm vi địa lý của vùng điểm đến đã chọn',
  },
  CATEGORY_NOT_FOUND: {
    code: ADMIN_ERROR_CODES.CATEGORY_NOT_FOUND,
    message: 'Không tìm thấy danh mục địa điểm',
  },
  CANNOT_DELETE_DEFAULT_GROUP: {
    code: ADMIN_ERROR_CODES.CANNOT_DELETE_DEFAULT_GROUP,
    message: 'Không thể xóa hoặc vô hiệu hóa chủ đề cộng đồng mặc định của hệ thống',
  },
  INVALID_GROUP_SLUG: {
    code: ADMIN_ERROR_CODES.INVALID_GROUP_SLUG,
    message: 'Đường dẫn định danh (slug) của chủ đề không hợp lệ',
  },
  PLACE_REFERENCED: {
    code: ADMIN_ERROR_CODES.PLACE_REFERENCED,
    message: 'Địa điểm đang được sử dụng trong lịch trình của người dùng, không thể xóa cứng',
  },
  GROUP_NOT_FOUND: {
    code: ADMIN_ERROR_CODES.GROUP_NOT_FOUND,
    message: 'Không tìm thấy chủ đề cộng đồng',
  },
  GROUP_SLUG_EXISTS: {
    code: ADMIN_ERROR_CODES.GROUP_SLUG_EXISTS,
    message: 'Đường dẫn định danh (slug) của chủ đề đã tồn tại',
  },
  AREA_NOT_FOUND: {
    code: ADMIN_ERROR_CODES.AREA_NOT_FOUND,
    message: 'Không tìm thấy vùng điểm đến du lịch',
  },
  POST_NOT_FOUND: {
    code: ADMIN_ERROR_CODES.POST_NOT_FOUND,
    message: 'Không tìm thấy bài viết cần kiểm duyệt',
  },
  POST_ALREADY_MODERATED: {
    code: ADMIN_ERROR_CODES.POST_ALREADY_MODERATED,
    message: 'Bài viết này đã được xử lý kiểm duyệt trước đó',
  },
  COMMENT_NOT_FOUND: {
    code: ADMIN_ERROR_CODES.COMMENT_NOT_FOUND,
    message: 'Không tìm thấy bình luận',
  },
  REPORT_NOT_FOUND: {
    code: ADMIN_ERROR_CODES.REPORT_NOT_FOUND,
    message: 'Không tìm thấy báo cáo vi phạm',
  },
  CONTENT_VIOLATES_POLICY: {
    code: ADMIN_ERROR_CODES.CONTENT_VIOLATES_POLICY,
    message: 'Nội dung chứa từ ngữ vi phạm tiêu chuẩn cộng đồng và đã bị chặn',
  },
} as const;

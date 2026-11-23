import type {
  AdminAuditAction,
  AdminPlaceImageStatus,
  AdminPostModerationStatus,
} from "@/types/admin";

export const ADMIN_QUERY_CONFIG = {
  LIST_STALE_TIME_MS: 5_000,
  STATS_STALE_TIME_MS: 10_000,
  STATS_POLL_INTERVAL_MS: 60_000, // Fallback safety net; primary updates arrive via Admin SSE (<100ms)
  REF_DATA_STALE_TIME_MS: 10 * 60 * 1000,
} as const;

export const ADMIN_LIVE_EVENT_TYPES = {
  PLACE_PHOTO_SUBMITTED: "PLACE_PHOTO_SUBMITTED",
  POST_NEEDS_MODERATION: "POST_NEEDS_MODERATION",
  REPORT_SUBMITTED: "REPORT_SUBMITTED",
} as const;

export const ADMIN_TAB_QUERY_PARAMS = {
  KEY: "tab",
  PLACES_PHOTOS: "photos",
  MODERATION_REPORTS: "reports",
  MODERATION_REJECTED: "rejected",
  MODERATION_BANNED_WORDS: "banned-words",
} as const;

export const ADMIN_ROUTES = {
  DASHBOARD: "/admin/dashboard",
  MODERATION: "/admin/moderation",
  MODERATION_REPORTS: `/admin/moderation?${ADMIN_TAB_QUERY_PARAMS.KEY}=${ADMIN_TAB_QUERY_PARAMS.MODERATION_REPORTS}`,
  PLACES: "/admin/places",
  PLACES_PHOTOS: `/admin/places?${ADMIN_TAB_QUERY_PARAMS.KEY}=${ADMIN_TAB_QUERY_PARAMS.PLACES_PHOTOS}`,
  USERS: "/admin/users",
  COMMUNITY: "/admin/community",
  AUDIT_LOGS: "/admin/audit-logs",
} as const;

export const ADMIN_LIVE_EVENT_MESSAGES = {
  PLACE_PHOTO_SUBMITTED: (placeName?: string) =>
    placeName
      ? `Có ảnh đóng góp mới cho "${placeName}" đang chờ duyệt`
      : "Có ảnh địa điểm đóng góp mới đang chờ duyệt",
  POST_NEEDS_MODERATION: () => "Có bài viết cộng đồng mới cần kiểm duyệt",
  REPORT_SUBMITTED: (postTitle?: string) =>
    postTitle
      ? `Có báo cáo vi phạm mới cho bài "${postTitle}"`
      : "Có báo cáo vi phạm mới từ cộng đồng",
} as const;

export const ADMIN_MODERATION_QUEUE_STATUSES: AdminPostModerationStatus[] = [
  "FLAGGED",
  "PENDING",
];

export const PLACE_PHOTO_UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_FILE_SIZE_MB: 10,
  MAX_CAPTION_LENGTH: 200,
  ACCEPT_ATTR: "image/jpeg,image/png,image/webp",
  ALLOWED_IMAGE_MIME_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ] as readonly string[],
} as const;

export const PLACE_PHOTO_UPLOAD_MESSAGES = {
  UPLOAD_SUCCESS: "Đã gửi ảnh thành công! Đang chờ Quản trị viên duyệt.",
  UNAUTHORIZED: "Vui lòng đăng nhập để đóng góp ảnh cho địa điểm này.",
  UPLOAD_FAILED_FALLBACK: "Không thể tải ảnh lên lúc này. Vui lòng thử lại.",
  BEFORE_UNLOAD_WARNING: "Ảnh của bạn đang được tải lên. Bạn có chắc muốn rời trang?",
} as const;

export const PLACE_PHOTO_STATUS_META: Record<
  AdminPlaceImageStatus,
  { label: string; badgeClass: string }
> = {
  PENDING: {
    label: "Chờ duyệt",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  APPROVED: {
    label: "Đã duyệt",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  REJECTED: {
    label: "Đã từ chối",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

export const ADMIN_UI_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  DASHBOARD_AUDIT_LIMIT: 5,
  SEARCH_DEBOUNCE_MS: 300,
  MIN_BAN_REASON_LENGTH: 3,
  FALLBACK_PLACE_IMAGE:
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80",
  FALLBACK_GROUP_IMAGE:
    "https://images.unsplash.com/photo-1528127269322-539801943592?w=300&auto=format&fit=crop&q=80",
} as const;

export interface AdminSidebarNavGroup {
  groupLabel: string;
  items: {
    href: string;
    label: string;
    iconClass: string;
    badgeKey?: "moderation" | "users" | "places" | "groups" | "audit";
  }[];
}

export const ADMIN_SIDEBAR_NAV: AdminSidebarNavGroup[] = [
  {
    groupLabel: "Tổng quan",
    items: [
      {
        href: "/admin/dashboard",
        label: "Bảng điều khiển",
        iconClass: "fa-solid fa-table-columns",
      },
      {
        href: "/admin/moderation",
        label: "Kiểm duyệt & Báo cáo",
        iconClass: "fa-solid fa-shield-halved",
        badgeKey: "moderation",
      },
    ],
  },
  {
    groupLabel: "Quản lý dữ liệu",
    items: [
      {
        href: "/admin/users",
        label: "Người dùng",
        iconClass: "fa-solid fa-users",
        badgeKey: "users",
      },
      {
        href: "/admin/places",
        label: "Địa điểm du lịch",
        iconClass: "fa-solid fa-map-location-dot",
        badgeKey: "places",
      },
      {
        href: "/admin/community",
        label: "Chủ đề cộng đồng",
        iconClass: "fa-solid fa-layer-group",
        badgeKey: "groups",
      },
    ],
  },
  {
    groupLabel: "An ninh",
    items: [
      {
        href: "/admin/audit-logs",
        label: "Nhật ký kiểm toán",
        iconClass: "fa-solid fa-clipboard-list",
      },
    ],
  },
];

export const ADMIN_AUDIT_ACTION_STYLES: Record<
  AdminAuditAction,
  { label: string; badgeClass: string }
> = {
  CREATE: {
    label: "CREATE",
    badgeClass: "bg-[#E8F4FD] text-[#0194F3]",
  },
  UPDATE: {
    label: "UPDATE",
    badgeClass: "bg-sky-50 text-sky-700",
  },
  APPROVE: {
    label: "APPROVE",
    badgeClass: "bg-emerald-50 text-emerald-700",
  },
  UNBAN: {
    label: "UNBAN",
    badgeClass: "bg-emerald-50 text-emerald-700",
  },
  DELETE: {
    label: "DELETE",
    badgeClass: "bg-rose-50 text-rose-600",
  },
  REJECT: {
    label: "REJECT",
    badgeClass: "bg-rose-50 text-rose-600",
  },
  BAN: {
    label: "BAN",
    badgeClass: "bg-rose-50 text-rose-600",
  },
};

export function formatAdminDateTime(isoString?: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAdminDateOnly(isoString?: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

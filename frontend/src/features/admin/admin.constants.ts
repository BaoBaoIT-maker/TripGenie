import type { AdminAuditAction } from "@/types/admin";

export const ADMIN_UI_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  DASHBOARD_AUDIT_LIMIT: 5,
  SEARCH_DEBOUNCE_MS: 300,
  MIN_BAN_REASON_LENGTH: 3,
  HIGH_PRIORITY_REPORT_THRESHOLD: 20,
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

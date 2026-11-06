export const TRIP_COMPANIONS_CONFIG = {
  MAX_AVATAR_PREVIEWS: 5,
  POLLING_INTERVAL_MS: 30_000,
  ROLES: {
    OWNER: 'Chủ chuyến đi',
    EDITOR: 'Chỉnh sửa',
    VIEWER: 'Chỉ xem',
  },
  CONFIRMATIONS: {
    REMOVE_MEMBER: (name: string) => `Bạn có chắc chắn muốn xóa "${name}" khỏi chuyến đi?`,
    LEAVE_TRIP: 'Bạn có chắc chắn muốn rời khỏi chuyến đi này không?',
  },
} as const;

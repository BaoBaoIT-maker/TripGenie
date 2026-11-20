export const TRIP_COMPANIONS_CONFIG = {
  MAX_AVATAR_PREVIEWS: 5,
  POLLING_INTERVAL_MS: 30_000,
  PROPOSALS_POLLING_INTERVAL_MS: 8_000,
  PROPOSAL_NOTES_MAX_LENGTH: 400,
  ROLES: {
    OWNER: 'Chủ chuyến đi',
    EDITOR: 'Chỉnh sửa',
    VIEWER: 'Chỉ xem',
  },
  PROPOSAL_STATUS_META: {
    PENDING: {
      label: 'Đang bình chọn',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    APPROVED: {
      label: 'Đã duyệt',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    REJECTED: {
      label: 'Đã từ chối',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    },
  },
  PROPOSAL_MESSAGES: {
    CREATE_SUCCESS: 'Đã gửi đề xuất vào bình chọn nhóm!',
    CREATE_ERROR: 'Không thể gửi đề xuất bình chọn',
    VOTE_ERROR: 'Không thể cập nhật lượt bình chọn',
    APPROVE_SUCCESS: 'Đã duyệt đề xuất và cập nhật lịch trình!',
    REJECT_SUCCESS: 'Đã từ chối đề xuất',
    RESOLVE_ERROR: 'Không thể xử lý đề xuất này',
    WITHDRAW_SUCCESS: 'Đã rút lại đề xuất bình chọn',
    WITHDRAW_ERROR: 'Không thể rút lại đề xuất',
  },
  CONFIRMATIONS: {
    REMOVE_MEMBER: (name: string) => `Bạn có chắc chắn muốn xóa "${name}" khỏi chuyến đi?`,
    LEAVE_TRIP: 'Bạn có chắc chắn muốn rời khỏi chuyến đi này không?',
  },
  LIVE_NOTIFICATIONS: {
    PROPOSAL_VOTED: (name?: string | null) => `${name || 'Một thành viên'} vừa bình chọn đề xuất!`,
    PROPOSAL_CREATED: (name?: string | null) => `${name || 'Một thành viên'} vừa gửi một đề xuất bình chọn mới!`,
    PROPOSAL_RESOLVED: (approved: boolean, name?: string | null) =>
      approved
        ? `${name || 'Trưởng nhóm'} vừa duyệt đề xuất và cập nhật lịch trình!`
        : `${name || 'Trưởng nhóm'} vừa từ chối đề xuất bình chọn.`,
    PROPOSAL_WITHDRAWN: (name?: string | null) => `${name || 'Một thành viên'} đã rút lại đề xuất bình chọn.`,
    STOPS_REORDERED: (name?: string | null) => `${name || 'Một thành viên'} vừa thay đổi thứ tự điểm dừng!`,
  },
} as const;

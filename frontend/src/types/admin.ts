export type AdminAuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "BAN"
  | "UNBAN";

export type AdminPlaceStatus = "ACTIVE" | "INACTIVE" | "MERGED";

export type AdminPostModerationStatus =
  | "PENDING"
  | "APPROVED"
  | "FLAGGED"
  | "REJECTED";

export type AdminReportStatus =
  | "PENDING"
  | "REVIEWED"
  | "RESOLVED"
  | "DISMISSED";

export type AdminReportType =
  | "SPAM"
  | "INAPPROPRIATE"
  | "FALSE_INFO"
  | "COPYRIGHT"
  | "OTHER";

export interface AdminPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface AdminPaginatedResponse<T> {
  items: T[];
  meta: AdminPaginationMeta;
}

export interface AdminCategoryBreakdownItem {
  id: number;
  name: string;
  nameVi: string | null;
  slug: string;
  placeCount: number;
}

export interface AdminDashboardStats {
  users: {
    total: number;
    active: number;
    banned: number;
    newThisWeek: number;
  };
  places: {
    total: number;
    active: number;
    inactive: number;
    pendingPhotos: number;
    byCategory: AdminCategoryBreakdownItem[];
  };
  community: {
    approvedPosts: number;
    totalComments: number;
    activeGroups: number;
  };
  moderation: {
    pendingPosts: number;
    flaggedPosts: number;
    rejectedPosts: number;
    pendingReports: number;
    highPriorityReportAlerts: number;
    highPriorityReportThreshold: number;
  };
}

export interface AdminAuditLogItem {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: AdminAuditAction;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  notes: string | null;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  } | null;
}

export interface AdminUserItem {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    posts: number;
    itineraries: number;
    reviews: number;
  };
}

export interface AdminPlaceImageItem {
  id?: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  displayOrder?: number;
  isPrimary?: boolean;
  caption?: string | null;
}

export interface AdminPlaceItem {
  id: string;
  name: string;
  nameNormalized: string | null;
  description: string | null;
  categoryId: number | null;
  areaId: number | null;
  address: string;
  latitude: number;
  longitude: number;
  priceLevel: "FREE" | "LOW" | "MEDIUM" | "HIGH" | "LUXURY" | null;
  phone: string | null;
  website: string | null;
  ratingAvg: number;
  reviewCount: number;
  imageCount: number;
  tags: string[];
  status: AdminPlaceStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: number;
    name: string;
    nameVi: string | null;
    slug: string;
  } | null;
  area?: {
    id: number;
    name: string;
    nameVi: string | null;
    slug: string;
    type: string;
  } | null;
  images?: AdminPlaceImageItem[];
  _count?: {
    destinations: number;
    collectionPlaces: number;
    reviews: number;
  };
}

export interface AdminCommunityGroupItem {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  iconUrl: string | null;
  coverUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  postCount: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    posts: number;
  };
}

export interface AdminModerationPostItem {
  id: string;
  userId: string;
  groupId: string | null;
  title: string;
  caption: string | null;
  mediaUrls: string[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  moderationStatus: AdminPostModerationStatus;
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    username: string | null;
    avatarUrl: string | null;
  } | null;
  group?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface AdminContentReportItem {
  id: string;
  reporterId: string;
  targetType: "POST" | "COMMENT" | "PLACE_REVIEW" | "PLACE";
  targetId: string;
  reportType: AdminReportType;
  description: string | null;
  status: AdminReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  targetReportCount: number;
  isHighPriorityAlert: boolean;
  reporter?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  targetPost?: {
    id: string;
    title: string;
    caption: string | null;
    mediaUrls: string[];
    moderationStatus: AdminPostModerationStatus;
    commentCount: number;
    createdAt: string;
    user?: {
      id: string;
      fullName: string;
      email: string;
      username: string | null;
      avatarUrl: string | null;
    } | null;
    group?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  } | null;
}

export interface AdminModerationReportsResponse {
  items: AdminContentReportItem[];
  meta: AdminPaginationMeta & {
    highPriorityAlertCount: number;
    highPriorityReportThreshold: number;
  };
}

export interface AdminModerationConfig {
  aiModerationEnabled: boolean;
  highPriorityReportThreshold: number;
}

export interface QueryAdminAuditLogsParams {
  page?: number;
  limit?: number;
  action?: AdminAuditAction;
  targetType?: string;
}

export interface QueryAdminUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface QueryAdminPlacesParams {
  page?: number;
  limit?: number;
  search?: string;
  areaId?: number;
  categoryId?: number;
  status?: AdminPlaceStatus;
}

export interface CreateOrUpdateAdminPlacePayload {
  name: string;
  description?: string;
  categoryId?: number;
  areaId?: number;
  address: string;
  latitude: number;
  longitude: number;
  priceLevel?: "FREE" | "LOW" | "MEDIUM" | "HIGH" | "LUXURY";
  phone?: string;
  website?: string;
  tags?: string[];
  status?: AdminPlaceStatus;
  images?: {
    imageUrl: string;
    thumbnailUrl?: string;
    isPrimary?: boolean;
    displayOrder?: number;
  }[];
}

export interface QueryAdminCommunityGroupsParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface CreateOrUpdateAdminGroupPayload {
  name: string;
  subtitle?: string;
  description?: string;
  iconUrl?: string;
  coverUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface QueryAdminModerationPostsParams {
  page?: number;
  limit?: number;
  status?: AdminPostModerationStatus;
  statuses?: AdminPostModerationStatus[];
  search?: string;
}

export type AdminPlaceImageStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdminPlacePhotoContributionItem {
  id: string;
  placeId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  isPrimary: boolean;
  source: string | null;
  status: AdminPlaceImageStatus;
  moderationNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  place: {
    id: string;
    name: string;
    slug?: string | null;
    address: string;
    area?: {
      id: number;
      name: string;
      nameVi: string | null;
    } | null;
  } | null;
  uploadedBy?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  reviewedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface QueryAdminPlacePhotosParams {
  page?: number;
  limit?: number;
  status?: AdminPlaceImageStatus;
  search?: string;
}

export interface QueryAdminReportsParams {
  page?: number;
  limit?: number;
  status?: AdminReportStatus;
  highPriorityOnly?: boolean;
}

export type BannedWordCategory =
  | "PROFANITY"
  | "ADULT"
  | "SCAM"
  | "GAMBLING"
  | "OTHER";

export type BannedWordAction = "BLOCK" | "REVIEW";

export interface AdminBannedWordItem {
  id: string;
  word: string;
  category: BannedWordCategory;
  action: BannedWordAction;
  isActive: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    fullName: string;
    username: string | null;
  } | null;
}

export interface CreateBannedWordPayload {
  word: string;
  category: BannedWordCategory;
  action?: BannedWordAction;
  notes?: string;
}

export interface UpdateBannedWordPayload {
  category?: BannedWordCategory;
  action?: BannedWordAction;
  notes?: string;
  isActive?: boolean;
}

export interface QueryAdminBannedWordsParams {
  page?: number;
  limit?: number;
  category?: BannedWordCategory;
  action?: BannedWordAction;
  isActive?: boolean;
  search?: string;
}


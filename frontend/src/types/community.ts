export type CommunitySortMode = "LATEST" | "TRENDING" | "MOST_CLONED";

export interface CommunityAuthorSummary {
  id: string;
  username: string | null;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  isVerifiedCreator?: boolean;
}

export interface CommunityLinkedItinerarySummary {
  id: string;
  title: string;
  destination: string | null;
  areaId: number | null;
  areaName: string | null;
  areaSlug: string | null;
  startDate: string | null;
  endDate: string | null;
  totalPlaces: number;
  budgetLevel: "LOW" | "MEDIUM" | "HIGH" | "LUXURY" | null;
  estimatedCost: number | null;
  coverPhoto: string | null;
}

export interface CommunityGroupSummary {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description?: string | null;
  iconUrl?: string | null;
  coverUrl?: string | null;
  coverImageUrl?: string | null;
  isDefault: boolean;
  postCount: number;
  sortOrder: number;
}

export interface CommunityPostItem {
  id: string;
  userId: string;
  groupId?: string | null;
  itineraryId: string | null;
  title: string;
  caption: string | null;
  mediaUrls: string[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  cloneCount: number;
  isLiked: boolean;
  isBookmarked?: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: CommunityAuthorSummary;
  group?: CommunityGroupSummary | null;
  itinerary: CommunityLinkedItinerarySummary | null;
}

export interface TopCreatorSummary {
  id?: string;
  username?: string | null;
  fullName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isVerified?: boolean;
  isVerifiedCreator?: boolean;
  author?: CommunityAuthorSummary;
  postCount: number;
  publicItineraryCount: number;
  totalLikesReceived?: number;
  totalClonesReceived: number;
}

export interface SidebarDiscoveryResponse {
  message?: string;
  groups: CommunityGroupSummary[];
  topClonedPosts: CommunityPostItem[];
  checkinHighlights: CommunityPostItem[];
  topCreators: TopCreatorSummary[];
}

export type CommunityReportType =
  | "SPAM"
  | "INAPPROPRIATE"
  | "FALSE_INFO"
  | "COPYRIGHT"
  | "OTHER";

export interface ReportCommunityPostPayload {
  reportType: CommunityReportType;
  description?: string;
}

export interface CreateCommunityGroupPayload {
  name: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  iconUrl?: string;
  coverUrl?: string;
  coverImageUrl?: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface CommunityCommentItem {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  replyToName: string | null;
  content: string;
  createdAt: string;
  author: CommunityAuthorSummary;
  isOptimistic?: boolean;
}

export interface MatchedCreatorSummary extends CommunityAuthorSummary {
  postCount: number;
}

export interface CommunityFeedResponse {
  message: string;
  items: CommunityPostItem[];
  nextCursor: string | null;
  matchedCreators?: MatchedCreatorSummary[];
}

export interface CreatorProfileData {
  user: CommunityAuthorSummary & { createdAt: string };
  stats: {
    postCount: number;
    totalLikesReceived: number;
    totalClonesReceived: number;
    publicItineraryCount: number;
  };
  posts: CommunityPostItem[];
  publicItineraries: CommunityLinkedItinerarySummary[];
}

export interface UploadedMediaItem {
  url: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: "IMAGE" | "VIDEO";
}

export interface CreateCommunityPostPayload {
  title: string;
  caption?: string;
  mediaUrls?: string[];
  tags?: string[];
  itineraryId?: string;
  groupId?: string;
}

export interface UpdateCommunityPostPayload {
  title: string;
  caption?: string;
  tags?: string[];
  groupId?: string;
}

/**
 * Legacy mock compatibility interface
 */
export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  destination: string;
  authorName: string;
  authorAvatar: string;
  authorBio?: string;
  createdAt: string;
  images: string[];
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  linkedPlannerId?: string;
  linkedPlannerTitle?: string;
  tags: string[];
}

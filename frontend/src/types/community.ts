export type CommunitySortMode = "LATEST" | "TRENDING" | "MOST_CLONED";

export interface CommunityAuthorSummary {
  id: string;
  username: string | null;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
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

export interface CommunityPostItem {
  id: string;
  userId: string;
  itineraryId: string | null;
  title: string;
  caption: string | null;
  mediaUrls: string[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  cloneCount: number;
  isLiked: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: CommunityAuthorSummary;
  itinerary: CommunityLinkedItinerarySummary | null;
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
}

export interface UpdateCommunityPostPayload {
  title: string;
  caption?: string;
  tags?: string[];
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

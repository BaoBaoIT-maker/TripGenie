import { BudgetLevel } from '@prisma/client';
import { CommunitySortMode } from '../community.constants';

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
  startDate: Date | null;
  endDate: Date | null;
  totalPlaces: number;
  budgetLevel: BudgetLevel | null;
  estimatedCost: number | null;
  coverPhoto: string | null;
}

export interface CommunityPostView {
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
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: CommunityAuthorSummary;
  itinerary: CommunityLinkedItinerarySummary | null;
}

export interface CommunityCommentView {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  replyToName: string | null;
  content: string;
  createdAt: Date;
  author: CommunityAuthorSummary;
}

export interface MatchedCreatorSummary extends CommunityAuthorSummary {
  postCount: number;
}

export interface FindFeedParams {
  cursor?: string;
  limit: number;
  sort: CommunitySortMode;
  areaId?: number;
  authorId?: string;
  tag?: string;
  search?: string;
  viewerId?: string;
}

export interface FeedPageResult {
  items: CommunityPostView[];
  nextCursor: string | null;
  matchedCreators?: MatchedCreatorSummary[];
}

export interface CreatePostData {
  userId: string;
  title: string;
  caption?: string | null;
  mediaUrls: string[];
  tags: string[];
  itineraryId?: string | null;
}

export interface CreatorProfileData {
  user: CommunityAuthorSummary & { createdAt: Date };
  stats: {
    postCount: number;
    totalLikesReceived: number;
    totalClonesReceived: number;
    publicItineraryCount: number;
  };
  posts: CommunityPostView[];
  publicItineraries: CommunityLinkedItinerarySummary[];
}

/** Minimal comment projection used for ownership checks and reply-target resolution. */
export interface CommentAccessView {
  id: string;
  postId: string;
  userId: string;
  postOwnerId: string;
  parentId: string | null;
  authorFullName: string;
}

export interface ICommunityRepository {
  findFeedPosts(params: FindFeedParams): Promise<FeedPageResult>;
  findPostById(postId: string, viewerId?: string): Promise<CommunityPostView | null>;
  findItineraryOwner(itineraryId: string): Promise<{ id: string; creatorId: string } | null>;
  createPost(data: CreatePostData): Promise<CommunityPostView>;
  updatePost(
    postId: string,
    data: { title: string; caption?: string | null; tags: string[] },
    viewerId?: string,
  ): Promise<CommunityPostView>;
  softDeletePost(postId: string): Promise<void>;
  togglePostLike(
    postId: string,
    userId: string,
  ): Promise<{ isLiked: boolean; likeCount: number }>;
  findPostComments(postId: string, limit?: number): Promise<CommunityCommentView[]>;
  findCommentById(commentId: string): Promise<CommentAccessView | null>;
  createComment(
    postId: string,
    userId: string,
    content: string,
    parentId?: string | null,
    replyToName?: string | null,
  ): Promise<{ comment: CommunityCommentView; commentCount: number }>;
  softDeleteComment(
    commentId: string,
    postId: string,
  ): Promise<{ commentCount: number }>;
  getCreatorProfile(
    targetUserIdOrUsername: string,
    viewerId?: string,
  ): Promise<CreatorProfileData | null>;
}
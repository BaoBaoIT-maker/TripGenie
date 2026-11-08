import {
  BudgetLevel,
  PostModerationStatus,
  ReportStatus,
  ReportType,
} from '@prisma/client';
import { CommunitySortMode } from '../community.constants';

export interface CommunityAuthorSummary {
  id: string;
  username: string | null;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
}

export interface CommunityGroupSummary {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  iconUrl: string | null;
  coverUrl: string | null;
  isDefault: boolean;
  sortOrder: number;
  postCount: number;
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
  groupId: string | null;
  itineraryId: string | null;
  title: string;
  caption: string | null;
  mediaUrls: string[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  cloneCount: number;
  isLiked: boolean;
  moderationStatus: PostModerationStatus;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: CommunityAuthorSummary;
  group: Pick<
    CommunityGroupSummary,
    'id' | 'name' | 'slug' | 'iconUrl' | 'isDefault'
  > | null;
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

export interface TopCreatorSummary extends CommunityAuthorSummary {
  author: CommunityAuthorSummary;
  postCount: number;
  publicItineraryCount: number;
  totalLikesReceived: number;
  totalClonesReceived: number;
}

export interface SidebarDiscoveryData {
  groups: CommunityGroupSummary[];
  topClonedPosts: CommunityPostView[];
  checkinHighlights: CommunityPostView[];
  topCreators: TopCreatorSummary[];
}

export interface FindFeedParams {
  cursor?: string;
  limit: number;
  sort: CommunitySortMode;
  groupId?: string;
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
  groupId?: string | null;
  title: string;
  caption?: string | null;
  mediaUrls: string[];
  tags: string[];
  itineraryId?: string | null;
}

export interface CreateCommentData {
  postId: string;
  userId: string;
  content: string;
  replyTargetCommentId?: string | null;
  replyToName?: string | null;
}

export interface CommentContextResult {
  comment: CommunityCommentView;
  parent: CommunityCommentView | null;
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

export interface CreateCommunityGroupData {
  name: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  coverUrl?: string | null;
  isDefault?: boolean;
  sortOrder?: number;
  createdBy: string;
}

export interface CreatePostReportData {
  postId: string;
  reportedBy: string;
  reportType: ReportType;
  description?: string | null;
}

export interface PostReportResult {
  id: string;
  postId: string;
  reportType: ReportType;
  status: ReportStatus;
  alreadyReported: boolean;
}

export interface ICommunityRepository {
  findActiveGroups(): Promise<CommunityGroupSummary[]>;
  findGroupByIdOrSlug(identifier: string): Promise<CommunityGroupSummary | null>;
  findDefaultGroup(): Promise<CommunityGroupSummary | null>;
  createCommunityGroup(data: CreateCommunityGroupData): Promise<CommunityGroupSummary>;
  getSidebarDiscovery(viewerId?: string): Promise<SidebarDiscoveryData>;
  findFeedPosts(params: FindFeedParams): Promise<FeedPageResult>;
  findPostById(postId: string, viewerId?: string): Promise<CommunityPostView | null>;
  findItineraryOwner(itineraryId: string): Promise<{ id: string; creatorId: string } | null>;
  createPost(data: CreatePostData): Promise<CommunityPostView>;
  updatePost(
    postId: string,
    data: { title: string; caption?: string | null; tags: string[]; groupId?: string | null },
    viewerId?: string,
  ): Promise<CommunityPostView>;
  softDeletePost(postId: string): Promise<void>;
  togglePostLike(
    postId: string,
    userId: string,
  ): Promise<{ isLiked: boolean; likeCount: number }>;
  reportPost(data: CreatePostReportData): Promise<PostReportResult>;
  findPostComments(postId: string, limit?: number): Promise<CommunityCommentView[]>;
  findCommentById(commentId: string): Promise<CommentAccessView | null>;
  getCommentContext(
    postId: string,
    commentId: string,
  ): Promise<CommentContextResult | null>;
  createComment(
    data: CreateCommentData,
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

import { PostModerationStatus, Prisma, UserRole } from '@prisma/client';
import { COMMUNITY_CONSTANTS } from '../community.constants';
import {
  CommunityAuthorSummary,
  CommunityCommentView,
  CommunityGroupSummary,
  CommunityLinkedItinerarySummary,
  CommunityPostView,
} from '../interfaces/community-repository.interface';

export const AUTHOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  bio: true,
  role: true,
  isVerifiedCreator: true,
} as const;

export const GROUP_MINI_SELECT = {
  id: true,
  name: true,
  slug: true,
  iconUrl: true,
  isDefault: true,
} as const;

export const GROUP_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  subtitle: true,
  description: true,
  iconUrl: true,
  coverUrl: true,
  isDefault: true,
  sortOrder: true,
  postCount: true,
} as const;

export const ITINERARY_SUMMARY_SELECT = {
  id: true,
  title: true,
  destination: true,
  areaId: true,
  startDate: true,
  endDate: true,
  totalPlaces: true,
  budgetLevel: true,
  estimatedCost: true,
  aiPreferences: true,
  area: {
    select: {
      name: true,
      nameVi: true,
      slug: true,
    },
  },
} as const;

export type RawItinerarySummaryRow = Prisma.ItineraryGetPayload<{
  select: typeof ITINERARY_SUMMARY_SELECT;
}>;

export type RawCommunityGroupRow = Prisma.CommunityGroupGetPayload<{
  select: typeof GROUP_SUMMARY_SELECT;
}>;

export type RawCommunityPostRow = Prisma.CommunityPostGetPayload<{
  include: {
    user: { select: typeof AUTHOR_SELECT };
    group: { select: typeof GROUP_MINI_SELECT };
    itinerary: { select: typeof ITINERARY_SUMMARY_SELECT };
  };
}> & {
  likes?: Array<{ userId: string }>;
};

export type RawPostCommentRow = Prisma.PostCommentGetPayload<{
  include: {
    user: { select: typeof AUTHOR_SELECT };
  };
}>;

export interface CreatorMeritMetrics {
  postCount: number;
  totalLikesReceived: number;
  totalClonesReceived: number;
}

export function mapAuthorSummary(
  user: {
    id: string;
    username: string | null;
    fullName: string;
    avatarUrl: string | null;
    bio: string | null;
    role?: UserRole;
    isVerifiedCreator?: boolean;
  },
  metrics?: CreatorMeritMetrics,
): CommunityAuthorSummary {
  const meetsMeritThreshold = Boolean(
    metrics &&
      metrics.postCount >= COMMUNITY_CONSTANTS.CREATOR_AUTO_VERIFY_MIN_POSTS &&
      (metrics.totalClonesReceived >= COMMUNITY_CONSTANTS.CREATOR_AUTO_VERIFY_MIN_CLONES ||
        metrics.totalLikesReceived >= COMMUNITY_CONSTANTS.CREATOR_AUTO_VERIFY_MIN_LIKES),
  );

  return {
    id: user.id,
    username: user.username ?? null,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    isVerified: Boolean(
      user.isVerifiedCreator ||
        user.role === UserRole.ADMIN ||
        meetsMeritThreshold,
    ),
  };
}

export function mapGroupSummary(raw: RawCommunityGroupRow): CommunityGroupSummary {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    subtitle: raw.subtitle ?? null,
    description: raw.description ?? null,
    iconUrl: raw.iconUrl ?? null,
    coverUrl: raw.coverUrl ?? null,
    isDefault: Boolean(raw.isDefault),
    sortOrder: raw.sortOrder ?? 0,
    postCount: raw.postCount ?? 0,
  };
}

export function mapItinerarySummary(
  raw: RawItinerarySummaryRow | null | undefined,
): CommunityLinkedItinerarySummary | null {
  if (!raw) return null;
  const prefs =
    raw.aiPreferences && typeof raw.aiPreferences === 'object' && !Array.isArray(raw.aiPreferences)
      ? (raw.aiPreferences as Record<string, unknown>)
      : {};
  const coverPhoto =
    (typeof prefs.coverPhoto === 'string' && prefs.coverPhoto) ||
    (typeof prefs.coverImage === 'string' && prefs.coverImage) ||
    null;

  return {
    id: raw.id,
    title: raw.title,
    destination: raw.destination ?? null,
    areaId: raw.areaId ?? null,
    areaName: raw.area?.nameVi || raw.area?.name || raw.destination || null,
    areaSlug: raw.area?.slug ?? null,
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    totalPlaces: raw.totalPlaces ?? 0,
    budgetLevel: raw.budgetLevel ?? null,
    estimatedCost: raw.estimatedCost != null ? Number(raw.estimatedCost) : null,
    coverPhoto,
  };
}

export function mapPostView(row: RawCommunityPostRow): CommunityPostView {
  return {
    id: row.id,
    userId: row.userId,
    groupId: row.groupId ?? null,
    itineraryId: row.itineraryId ?? null,
    title: row.title,
    caption: row.caption ?? null,
    mediaUrls: Array.isArray(row.mediaUrls) ? row.mediaUrls : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    likeCount: row.likeCount ?? 0,
    commentCount: row.commentCount ?? 0,
    cloneCount: row.cloneCount ?? 0,
    isLiked: Array.isArray(row.likes) && row.likes.length > 0,
    moderationStatus: row.moderationStatus ?? PostModerationStatus.APPROVED,
    editedAt: row.editedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: mapAuthorSummary(row.user),
    group: row.group
      ? {
          id: row.group.id,
          name: row.group.name,
          slug: row.group.slug,
          iconUrl: row.group.iconUrl ?? null,
          isDefault: Boolean(row.group.isDefault),
        }
      : null,
    itinerary: mapItinerarySummary(row.itinerary),
  };
}

export function mapCommentView(row: RawPostCommentRow): CommunityCommentView {
  return {
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    parentId: row.parentId ?? null,
    replyToName: row.replyToName ?? null,
    content: row.content,
    createdAt: row.createdAt,
    author: mapAuthorSummary(row.user),
  };
}

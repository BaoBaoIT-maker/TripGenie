import { Prisma } from '@prisma/client';
import {
  CommunityAuthorSummary,
  CommunityCommentView,
  CommunityLinkedItinerarySummary,
  CommunityPostView,
} from '../interfaces/community-repository.interface';

export const AUTHOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  bio: true,
  isVerified: true,
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

export type RawCommunityPostRow = Prisma.CommunityPostGetPayload<{
  include: {
    user: { select: typeof AUTHOR_SELECT };
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

export function mapAuthorSummary(user: {
  id: string;
  username: string | null;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
}): CommunityAuthorSummary {
  return {
    id: user.id,
    username: user.username ?? null,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    isVerified: Boolean(user.isVerified),
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
    itineraryId: row.itineraryId ?? null,
    title: row.title,
    caption: row.caption ?? null,
    mediaUrls: Array.isArray(row.mediaUrls) ? row.mediaUrls : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    likeCount: row.likeCount ?? 0,
    commentCount: row.commentCount ?? 0,
    cloneCount: row.cloneCount ?? 0,
    isLiked: Array.isArray(row.likes) && row.likes.length > 0,
    editedAt: row.editedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: mapAuthorSummary(row.user),
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

import { apiClient } from "@/lib/api-client";
import type {
  CommunityCommentItem,
  CommunityFeedResponse,
  CommunityPostItem,
  CommunitySortMode,
  CreateCommunityPostPayload,
  UpdateCommunityPostPayload,
  CreatorProfileData,
  UploadedMediaItem,
} from "@/types/community";

export const COMMUNITY_UI_CONSTANTS = {
  MAX_MEDIA_FILES: 6,
  MAX_TITLE_LENGTH: 255,
  MAX_CAPTION_LENGTH: 5000,
  MAX_COMMENT_LENGTH: 1500,
  DEFAULT_FEED_PAGE_SIZE: 10,
  SEARCH_DEBOUNCE_MS: 300,
  ACCEPTED_MEDIA_MIMES:
    "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime",
  POPULAR_TAGS: [
    "#DaLat",
    "#DaNang",
    "#PhuQuoc",
    "#HoiAn",
    "#SanMay",
    "#FoodTour",
  ],
} as const;

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

export interface CommunityFeedQuery {
  cursor?: string;
  limit?: number;
  sort?: CommunitySortMode;
  areaId?: number;
  authorId?: string;
  tag?: string;
  search?: string;
}

export const communityService = {
  uploadMedia: async (
    files: File[]
  ): Promise<{ mediaUrls: string[]; items: UploadedMediaItem[] }> => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    return apiClient<{ mediaUrls: string[]; items: UploadedMediaItem[] }>(
      "/community/media/upload",
      {
        method: "POST",
        body: formData,
      }
    );
  },

  getFeed: async (query: CommunityFeedQuery = {}): Promise<CommunityFeedResponse> => {
    const params = new URLSearchParams();
    if (query.cursor) params.set("cursor", query.cursor);
    if (query.limit) params.set("limit", String(query.limit));
    if (query.sort) params.set("sort", query.sort);
    if (query.areaId) params.set("areaId", String(query.areaId));
    if (query.authorId) params.set("authorId", query.authorId);
    if (query.tag) params.set("tag", query.tag);
    if (query.search) params.set("search", query.search);

    const qs = params.toString();
    return apiClient<CommunityFeedResponse>(`/community/posts${qs ? `?${qs}` : ""}`);
  },

  getPostById: async (id: string): Promise<{ post: CommunityPostItem }> =>
    apiClient<{ post: CommunityPostItem }>(`/community/posts/${id}`),

  createPost: async (
    payload: CreateCommunityPostPayload
  ): Promise<{ post: CommunityPostItem }> =>
    apiClient<{ post: CommunityPostItem }>("/community/posts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updatePost: async (
    id: string,
    payload: UpdateCommunityPostPayload
  ): Promise<{ post: CommunityPostItem }> =>
    apiClient<{ post: CommunityPostItem }>(`/community/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deletePost: async (id: string): Promise<{ success: boolean; id: string }> =>
    apiClient<{ success: boolean; id: string }>(`/community/posts/${id}`, {
      method: "DELETE",
    }),

  toggleLike: async (
    postId: string
  ): Promise<{ postId: string; isLiked: boolean; likeCount: number }> =>
    apiClient<{ postId: string; isLiked: boolean; likeCount: number }>(
      `/community/posts/${postId}/like`,
      { method: "POST" }
    ),

  getComments: async (
    postId: string
  ): Promise<{ comments: CommunityCommentItem[] }> =>
    apiClient<{ comments: CommunityCommentItem[] }>(
      `/community/posts/${postId}/comments`
    ),

  getCommentContext: async (
    postId: string,
    commentId: string
  ): Promise<{ comment: CommunityCommentItem; parent: CommunityCommentItem | null }> =>
    apiClient<{ comment: CommunityCommentItem; parent: CommunityCommentItem | null }>(
      `/community/posts/${postId}/comments/${commentId}/context`
    ),

  createComment: async (
    postId: string,
    content: string,
    parentId?: string,
    replyToName?: string
  ): Promise<{ comment: CommunityCommentItem; commentCount: number }> =>
    apiClient<{ comment: CommunityCommentItem; commentCount: number }>(
      `/community/posts/${postId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content, parentId, replyToName }),
      }
    ),

  deleteComment: async (
    commentId: string
  ): Promise<{
    success: boolean;
    commentId: string;
    postId: string;
    commentCount: number;
  }> =>
    apiClient<{
      success: boolean;
      commentId: string;
      postId: string;
      commentCount: number;
    }>(`/community/comments/${commentId}`, {
      method: "DELETE",
    }),

  getCreatorProfile: async (
    identifier: string
  ): Promise<{ profile: CreatorProfileData }> =>
    apiClient<{ profile: CreatorProfileData }>(
      `/community/creators/${encodeURIComponent(identifier)}`
    ),
};

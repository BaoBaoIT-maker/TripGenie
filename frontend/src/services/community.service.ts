import { apiClient, API_BASE_URL } from "@/lib/api-client";
import type {
  CommunityCommentItem,
  CommunityFeedResponse,
  CommunityGroupSummary,
  CommunityPostItem,
  CommunitySortMode,
  CreateCommunityGroupPayload,
  CreateCommunityPostPayload,
  ReportCommunityPostPayload,
  SidebarDiscoveryResponse,
  UpdateCommunityPostPayload,
  CreatorProfileData,
  UploadedMediaItem,
} from "@/types/community";

export const COMMUNITY_UI_CONSTANTS = {
  MAX_MEDIA_FILES: 6,
  MAX_TITLE_LENGTH: 255,
  MAX_CAPTION_LENGTH: 5000,
  MAX_COMMENT_LENGTH: 1500,
  MAX_REPORT_DESCRIPTION_LENGTH: 1000,
  DEFAULT_FEED_PAGE_SIZE: 10,
  SEARCH_DEBOUNCE_MS: 300,
  STORY_DURATION_MS: 5000,
  POST_HIGHLIGHT_DURATION_MS: 3200,
  STORY_CAROUSEL_SCROLL_STEP_PX: 260,
  DEFAULT_GROUP_SLUG: "cong-dong-chung",
  DEFAULT_GROUP_DISPLAY_NAME: "Cộng đồng chung TripGenie",
  VIDEO_THUMBNAIL_FRAGMENT: "#t=0.1",
  VERIFIED_LOCAL_BADGE_PREFIX: "Thổ địa",
  ITINERARY_SHARE_BADGE_PREFIX: "Chia sẻ lộ trình",
  DEFAULT_MEMBER_BADGE: "Thành viên TripGenie",
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
  return /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(url);
}

// ponytail: W3C Media Fragments (#t=0.1) instructs the browser decoder to paint the first non-black frame without server-side FFmpeg thumbnail extraction; upgrade to CDN poster URLs if switching IMediaStorageProvider to Cloudflare Stream / S3.
export function getVideoThumbnailSrc(url: string): string {
  if (!url || url.includes("#t=")) return url;
  return `${url}${COMMUNITY_UI_CONSTANTS.VIDEO_THUMBNAIL_FRAGMENT}`;
}

export interface PostAuthorSubtitleInfo {
  handle: string;
  groupBadge: { name: string; slug: string; isDefault: boolean } | null;
  contextLabel: string;
}

export function deriveHandleFromFullName(fullName: string): string {
  const normalized = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return normalized ? `@${normalized}` : "@member";
}

export function resolvePostAuthorSubtitle(
  post: Pick<CommunityPostItem, "author" | "group" | "itinerary">
): PostAuthorSubtitleInfo {
  const handle = post.author.username
    ? `@${post.author.username}`
    : deriveHandleFromFullName(post.author.fullName);

  const groupBadge = post.group
    ? {
        name: post.group.name,
        slug: post.group.slug,
        isDefault: Boolean(post.group.isDefault),
      }
    : null;

  const contextLabel =
    groupBadge?.name || COMMUNITY_UI_CONSTANTS.DEFAULT_GROUP_DISPLAY_NAME;

  return {
    handle,
    groupBadge,
    contextLabel,
  };
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

export function formatTripDuration(
  startDate?: string | null,
  endDate?: string | null,
  compact = false
): string | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const nights = Math.max(0, diffDays - 1);
  if (compact) {
    return nights > 0 ? `${diffDays}N${nights}Đ` : `${diffDays} Ngày`;
  }
  return nights > 0 ? `${diffDays} Ngày ${nights} Đêm` : `${diffDays} Ngày`;
}

export interface CommunityFeedQuery {
  cursor?: string;
  limit?: number;
  sort?: CommunitySortMode;
  areaId?: number;
  groupId?: string;
  authorId?: string;
  tag?: string;
  search?: string;
}

export const communityService = {
  uploadMedia: async (
    files: File[],
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<{ mediaUrls: string[]; items: UploadedMediaItem[] }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}/community/media/upload`;

      xhr.open("POST", url, true);
      xhr.withCredentials = true;

      if (signal) {
        if (signal.aborted) {
          reject(new DOMException("Đã hủy tải tệp lên", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          xhr.abort();
          reject(new DOMException("Đã hủy tải tệp lên", "AbortError"));
        });
      }

      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = Math.min(
              100,
              Math.max(0, Math.round((event.loaded / event.total) * 100))
            );
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const raw = JSON.parse(xhr.responseText);
            // Unwrap standard NestJS ApiResponse envelope if present
            const payload =
              raw && typeof raw === "object" && "data" in raw && raw.data
                ? raw.data
                : raw;
            resolve(payload);
          } catch {
            reject(new Error("Phản hồi từ máy chủ không hợp lệ"));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.message || "Tải lên tệp thất bại"));
          } catch {
            reject(new Error(`Tải lên tệp thất bại (HTTP ${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error("Lỗi kết nối máy chủ khi tải tệp"));
      };

      xhr.onabort = () => {
        reject(new DOMException("Đã hủy tải tệp lên", "AbortError"));
      };

      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      xhr.send(formData);
    });
  },

  getGroups: async (): Promise<{ groups: CommunityGroupSummary[] }> =>
    apiClient<{ groups: CommunityGroupSummary[] }>("/community/groups"),

  createGroup: async (
    payload: CreateCommunityGroupPayload
  ): Promise<{ message: string; group: CommunityGroupSummary }> =>
    apiClient<{ message: string; group: CommunityGroupSummary }>(
      "/community/groups",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  getSidebarDiscovery: async (): Promise<SidebarDiscoveryResponse> =>
    apiClient<SidebarDiscoveryResponse>("/community/sidebar-discovery"),

  getFeed: async (query: CommunityFeedQuery = {}): Promise<CommunityFeedResponse> => {
    const params = new URLSearchParams();
    if (query.cursor) params.set("cursor", query.cursor);
    if (query.limit) params.set("limit", String(query.limit));
    if (query.sort) params.set("sort", query.sort);
    if (query.areaId) params.set("areaId", String(query.areaId));
    if (query.groupId) params.set("groupId", query.groupId);
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

  reportPost: async (
    postId: string,
    payload: ReportCommunityPostPayload
  ): Promise<{
    message: string;
    report: { id: string; status: string; alreadyReported: boolean };
  }> =>
    apiClient<{
      message: string;
      report: { id: string; status: string; alreadyReported: boolean };
    }>(`/community/posts/${postId}/report`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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

"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  communityService,
  CommunityFeedQuery,
} from "@/services/community.service";
import { itineraryService } from "@/services/itinerary-planner.service";
import type {
  CommunityCommentItem,
  CommunityFeedResponse,
  CommunityPostItem,
  CreateCommunityGroupPayload,
  CreateCommunityPostPayload,
  ReportCommunityPostPayload,
  SidebarDiscoveryResponse,
  UpdateCommunityPostPayload,
  CreatorProfileData,
} from "@/types/community";
import { useAuth } from "@/features/auth/hooks/use-auth";

export const COMMUNITY_QUERY_KEYS = {
  all: ["community"] as const,
  sidebarDiscovery: ["community", "sidebar-discovery"] as const,
  groups: ["community", "groups"] as const,
  feed: (filters: Omit<CommunityFeedQuery, "cursor">) =>
    ["community", "feed", filters] as const,
  post: (postId: string) => ["community", "post", postId] as const,
  comments: (postId: string) => ["community", "comments", postId] as const,
  commentContext: (postId: string, commentId: string) =>
    ["community", "comments", postId, "context", commentId] as const,
  creator: (identifier: string) =>
    ["community", "creator", identifier] as const,
};

function updatePostInFeedPages(
  oldData: InfiniteData<CommunityFeedResponse> | undefined,
  postId: string,
  updater: (post: CommunityPostItem) => CommunityPostItem
): InfiniteData<CommunityFeedResponse> | undefined {
  if (!oldData) return oldData;
  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === postId ? updater(item) : item
      ),
    })),
  };
}

export function useCommunitySidebarDiscovery(
  initialData?: SidebarDiscoveryResponse | null
) {
  return useQuery({
    queryKey: COMMUNITY_QUERY_KEYS.sidebarDiscovery,
    queryFn: () => communityService.getSidebarDiscovery(),
    initialData: initialData ?? undefined,
    staleTime: 60 * 1000,
  });
}

export function useCommunityGroups(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: COMMUNITY_QUERY_KEYS.groups,
    queryFn: async () => {
      const res = await communityService.getGroups();
      return res.groups;
    },
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useCommunityFeed(
  filters: Omit<CommunityFeedQuery, "cursor"> = {},
  initialFirstPage?: CommunityFeedResponse | null
) {
  const isDefaultUnfilteredFeed =
    (!filters.sort || filters.sort === "LATEST") &&
    !filters.groupId &&
    !filters.tag &&
    !filters.search &&
    !filters.areaId &&
    !filters.authorId;

  return useInfiniteQuery({
    queryKey: COMMUNITY_QUERY_KEYS.feed(filters),
    queryFn: ({ pageParam }) =>
      communityService.getFeed({
        ...filters,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData:
      isDefaultUnfilteredFeed && initialFirstPage
        ? {
            pages: [initialFirstPage],
            pageParams: [undefined],
          }
        : undefined,
  });
}

export function usePostComments(postId: string | null, enabled = true) {
  return useQuery({
    queryKey: COMMUNITY_QUERY_KEYS.comments(postId || ""),
    queryFn: async () => {
      if (!postId) return [];
      const res = await communityService.getComments(postId);
      return res.comments;
    },
    enabled: Boolean(postId) && enabled,
  });
}

export function useCommunityPost(postId: string | null, enabled = true) {
  return useQuery({
    queryKey: COMMUNITY_QUERY_KEYS.post(postId || ""),
    queryFn: async () => {
      if (!postId) return null;
      const res = await communityService.getPostById(postId);
      return res.post;
    },
    enabled: Boolean(postId) && enabled,
  });
}

export function useCommentContext(
  postId: string | null,
  commentId: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: COMMUNITY_QUERY_KEYS.commentContext(postId || "", commentId || ""),
    queryFn: async () => {
      if (!postId || !commentId) return null;
      return communityService.getCommentContext(postId, commentId);
    },
    enabled: Boolean(postId && commentId) && enabled,
    retry: false,
  });
}

export function useCreatorProfile(identifier: string) {
  return useQuery({
    queryKey: COMMUNITY_QUERY_KEYS.creator(identifier),
    queryFn: async () => {
      const res = await communityService.getCreatorProfile(identifier);
      return res.profile;
    },
    enabled: Boolean(identifier),
  });
}

export function useUploadCommunityMedia() {
  return useMutation({
    mutationFn: (files: File[]) => communityService.uploadMedia(files),
    onError: (err: Error) => {
      toast.error(err.message || "Tải lên ảnh/video thất bại");
    },
  });
}

export function useCreateCommunityPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCommunityPostPayload) =>
      communityService.createPost(payload),
    onSuccess: () => {
      toast.success("Đã đăng bài chia sẻ lên cộng đồng!");
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Không thể đăng bài viết");
    },
  });
}

export function useUpdateCommunityPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: UpdateCommunityPostPayload;
    }) => communityService.updatePost(postId, payload),
    onSuccess: () => {
      toast.success("Đã cập nhật bài viết!");
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Không thể cập nhật bài viết");
    },
  });
}

export function useDeleteCommunityPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => communityService.deletePost(postId),
    onSuccess: () => {
      toast.success("Đã xóa bài viết");
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Không thể xóa bài viết");
    },
  });
}

export function useCreateCommunityGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCommunityGroupPayload) =>
      communityService.createGroup(payload),
    onSuccess: (res) => {
      toast.success(res.message || "Đã tạo nhóm cộng đồng mới!");
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Không thể tạo nhóm cộng đồng");
    },
  });
}

export function useReportCommunityPost() {
  return useMutation({
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: ReportCommunityPostPayload;
    }) => communityService.reportPost(postId, payload),
    onSuccess: (res) => {
      toast.success(
        res.message || "Đã gửi báo cáo bài viết để Ban quản trị xem xét"
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Không thể gửi báo cáo bài viết");
    },
  });
}

/**
 * Optimistic UI Toggle Like (0ms latency with snapshot rollback on error)
 */
export function useTogglePostLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => communityService.toggleLike(postId),
    onMutate: async (postId: string) => {
      await queryClient.cancelQueries({ queryKey: ["community"] });

      const previousFeeds = queryClient.getQueriesData<
        InfiniteData<CommunityFeedResponse>
      >({
        queryKey: ["community", "feed"],
      });

      const previousProfiles = queryClient.getQueriesData<CreatorProfileData>({
        queryKey: ["community", "creator"],
      });

      const previousSidebar =
        queryClient.getQueryData<SidebarDiscoveryResponse>(
          COMMUNITY_QUERY_KEYS.sidebarDiscovery
        );

      // Optimistically update all feed caches
      queryClient.setQueriesData<InfiniteData<CommunityFeedResponse>>(
        { queryKey: ["community", "feed"] },
        (old) =>
          updatePostInFeedPages(old, postId, (post) => {
            const nextLiked = !post.isLiked;
            const nextCount = Math.max(
              0,
              post.likeCount + (nextLiked ? 1 : -1)
            );
            return {
              ...post,
              isLiked: nextLiked,
              likeCount: nextCount,
            };
          })
      );

      // Optimistically update sidebar discovery check-in highlights & top cloned posts
      if (previousSidebar) {
        const updatePostItem = (post: CommunityPostItem) => {
          if (post.id !== postId) return post;
          const nextLiked = !post.isLiked;
          return {
            ...post,
            isLiked: nextLiked,
            likeCount: Math.max(0, post.likeCount + (nextLiked ? 1 : -1)),
          };
        };
        queryClient.setQueryData<SidebarDiscoveryResponse>(
          COMMUNITY_QUERY_KEYS.sidebarDiscovery,
          {
            ...previousSidebar,
            topClonedPosts: previousSidebar.topClonedPosts.map(updatePostItem),
            checkinHighlights:
              previousSidebar.checkinHighlights.map(updatePostItem),
          }
        );
      }

      // Optimistically update creator profile caches
      queryClient.setQueriesData<CreatorProfileData>(
        { queryKey: ["community", "creator"] },
        (old) => {
          if (!old) return old;
          let delta = 0;
          const updatedPosts = old.posts.map((post) => {
            if (post.id !== postId) return post;
            const nextLiked = !post.isLiked;
            delta = nextLiked ? 1 : -1;
            return {
              ...post,
              isLiked: nextLiked,
              likeCount: Math.max(0, post.likeCount + delta),
            };
          });
          return {
            ...old,
            stats: {
              ...old.stats,
              totalLikesReceived: Math.max(
                0,
                old.stats.totalLikesReceived + delta
              ),
            },
            posts: updatedPosts,
          };
        }
      );

      return { previousFeeds, previousProfiles, previousSidebar };
    },
    onError: (err: Error, _postId, context) => {
      if (context?.previousFeeds) {
        context.previousFeeds.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousProfiles) {
        context.previousProfiles.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousSidebar) {
        queryClient.setQueryData(
          COMMUNITY_QUERY_KEYS.sidebarDiscovery,
          context.previousSidebar
        );
      }
      toast.error(err.message || "Vui lòng đăng nhập để thả tim bài viết");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["community"] });
    },
  });
}

/**
 * Optimistic UI Create Comment (0ms latency with snapshot rollback on error)
 */
export function useCreatePostComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      postId,
      content,
      parentId,
      replyToName,
    }: {
      postId: string;
      content: string;
      parentId?: string;
      replyToName?: string;
    }) => communityService.createComment(postId, content, parentId, replyToName),
    onMutate: async ({ postId, content, parentId, replyToName }) => {
      const commentsKey = COMMUNITY_QUERY_KEYS.comments(postId);
      await queryClient.cancelQueries({ queryKey: commentsKey });

      const previousComments =
        queryClient.getQueryData<CommunityCommentItem[]>(commentsKey) ?? [];
      const previousFeeds = queryClient.getQueriesData<
        InfiniteData<CommunityFeedResponse>
      >({
        queryKey: ["community", "feed"],
      });

      const optimisticComment: CommunityCommentItem = {
        id: `optimistic-${Date.now()}`,
        postId,
        userId: user?.id || "me",
        parentId: parentId || null,
        replyToName: replyToName || null,
        content,
        createdAt: new Date().toISOString(),
        isOptimistic: true,
        author: {
          id: user?.id || "me",
          username: user?.username || null,
          fullName: user?.fullName || "Bạn",
          avatarUrl: user?.avatarUrl || null,
          bio: null,
          isVerified: Boolean(user?.role === "ADMIN"),
        },
      };

      queryClient.setQueryData<CommunityCommentItem[]>(commentsKey, [
        ...previousComments,
        optimisticComment,
      ]);

      queryClient.setQueriesData<InfiniteData<CommunityFeedResponse>>(
        { queryKey: ["community", "feed"] },
        (old) =>
          updatePostInFeedPages(old, postId, (post) => ({
            ...post,
            commentCount: post.commentCount + 1,
          }))
      );

      return { previousComments, previousFeeds, postId };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.postId) {
        queryClient.setQueryData(
          COMMUNITY_QUERY_KEYS.comments(context.postId),
          context.previousComments
        );
      }
      if (context?.previousFeeds) {
        context.previousFeeds.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(err.message || "Không thể gửi bình luận");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: COMMUNITY_QUERY_KEYS.comments(variables.postId),
      });
      queryClient.invalidateQueries({ queryKey: ["community", "feed"] });
    },
  });
}

export function useDeletePostComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
    }: {
      commentId: string;
      postId: string;
    }) => communityService.deleteComment(commentId),
    onSuccess: (_res, vars) => {
      toast.success("Đã xóa bình luận");
      queryClient.invalidateQueries({
        queryKey: COMMUNITY_QUERY_KEYS.comments(vars.postId),
      });
      queryClient.invalidateQueries({ queryKey: ["community", "feed"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Không thể xóa bình luận");
    },
  });
}

export function useCloneCommunityItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itineraryId: string) =>
      itineraryService.cloneItinerary(itineraryId),
    onSuccess: () => {
      toast.success("Đã nhân bản lịch trình về tài khoản của bạn!");
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["planners"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Không thể nhân bản lịch trình");
    },
  });
}

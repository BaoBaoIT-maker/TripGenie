"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  InfiniteData,
  QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  communityService,
  CommunityFeedQuery,
} from "@/services/community.service";
import { itineraryService } from "@/services/itinerary-planner.service";
import { userService } from "@/services/user.service";
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
import { ApiClientError } from "@/lib/api-client";
import { useI18n, type TranslationKey } from "@/i18n";
import { COMMUNITY_CONFIG } from "../config/community.config";

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

function removePostFromFeedPages(
  oldData: InfiniteData<CommunityFeedResponse> | undefined,
  postId: string
): InfiniteData<CommunityFeedResponse> | undefined {
  if (!oldData) return oldData;
  return {
    ...oldData,
    pages: oldData.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== postId),
    })),
  };
}

function scheduleModerationOutcomeCheck(
  queryClient: QueryClient,
  postId: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): void {
  setTimeout(async () => {
    try {
      const res = await communityService.getPostById(postId);
      const latest = res?.post;
      if (!latest) return;

      queryClient.setQueriesData<InfiniteData<CommunityFeedResponse>>(
        { queryKey: ["community", "feed"] },
        (old) => updatePostInFeedPages(old, postId, () => latest)
      );

      if (latest.moderationStatus === "APPROVED") {
        toast.success(t("community.toasts.moderationApproved"));
      } else if (latest.moderationStatus === "FLAGGED") {
        toast.warning(
          latest.moderationNote ||
            t("community.toasts.moderationFlagged")
        );
      } else if (latest.moderationStatus === "REJECTED") {
        toast.error(
          `${t("community.toasts.moderationRejectedPrefix")}: ${
            latest.moderationNote ||
            t("community.toasts.moderationRejectedFallback")
          }`
        );
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        queryClient.setQueriesData<InfiniteData<CommunityFeedResponse>>(
          { queryKey: ["community", "feed"] },
          (old) => removePostFromFeedPages(old, postId)
        );
        toast.error(t("community.toasts.postNotFound"));
      }
    } finally {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
    }
  }, COMMUNITY_CONFIG.MODERATION_CHECK_DELAY_MS);
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

export function useCreatorProfile(
  identifier: string,
  initialData?: CreatorProfileData
) {
  return useQuery({
    queryKey: COMMUNITY_QUERY_KEYS.creator(identifier),
    queryFn: async () => {
      const res = await communityService.getCreatorProfile(identifier);
      return res.profile;
    },
    enabled: Boolean(identifier),
    initialData,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.statusCode === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const { refetchUser } = useAuth();
  const { t } = useI18n();

  return useMutation({
    mutationFn: (data: { fullName?: string; bio?: string; avatarUrl?: string }) =>
      userService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
      refetchUser();
      toast.success(t("community.toasts.profileUpdated"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("community.toasts.profileUpdateFailed"));
    },
  });
}

export function useUploadCommunityMedia() {
  const { t } = useI18n();
  return useMutation({
    mutationFn: (files: File[]) => communityService.uploadMedia(files),
    onError: (err: Error) => {
      toast.error(err.message || t("community.toasts.uploadFailed"));
    },
  });
}

export function useCreateCommunityPost() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: (payload: CreateCommunityPostPayload) =>
      communityService.createPost(payload),
    onSuccess: (data) => {
      const newPost = data?.post;
      if (!newPost) return;

      // Post-response injection: hiển thị ngay trên đầu bảng tin cho tác giả và Admin.
      queryClient.setQueriesData<InfiniteData<CommunityFeedResponse>>(
        { queryKey: ["community", "feed"] },
        (old) => {
          if (!old) return old;
          const firstPage = old.pages[0];
          if (firstPage?.items.some((p) => p.id === newPost.id)) return old;
          return {
            ...old,
            pages: [
              { ...firstPage, items: [newPost, ...(firstPage?.items ?? [])] },
              ...old.pages.slice(1),
            ],
          };
        }
      );

      queryClient.setQueriesData<CreatorProfileData>(
        { queryKey: ["community", "creator"] },
        (old) => {
          if (!old || old.user.id !== newPost.userId) return old;
          if (old.posts.some((p) => p.id === newPost.id)) return old;
          return {
            ...old,
            posts: [newPost, ...old.posts],
          };
        }
      );

      if (newPost.moderationStatus === "PENDING") {
        toast.info(t("community.toasts.postCreatedPending"), {
          duration: COMMUNITY_CONFIG.INFO_TOAST_DURATION_MS,
        });
        scheduleModerationOutcomeCheck(queryClient, newPost.id, t);
      } else {
        toast.success(t("community.toasts.postCreatedSuccess"));
        queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t("community.toasts.postCreateError"));
    },
  });
}

export function useUpdateCommunityPost() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: UpdateCommunityPostPayload;
    }) => communityService.updatePost(postId, payload),
    onSuccess: (data, { postId }) => {
      const updatedPost = data?.post;
      const isPending = updatedPost?.moderationStatus === "PENDING";
      queryClient.setQueriesData<InfiniteData<CommunityFeedResponse>>(
        { queryKey: ["community", "feed"] },
        (old) =>
          updatePostInFeedPages(old, postId, (post) =>
            updatedPost
              ? { ...post, ...updatedPost }
              : {
                  ...post,
                  moderationStatus: "APPROVED" as const,
                  moderationNote: null,
                }
          )
      );
      if (isPending) {
        toast.info(t("community.toasts.postUpdatedPending"), {
          duration: COMMUNITY_CONFIG.INFO_TOAST_DURATION_MS,
        });
        return;
      }
      toast.success(t("community.toasts.postUpdatedSuccess"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("community.toasts.postUpdateError"));
    },
  });
}

export function useDeleteCommunityPost() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: (postId: string) => communityService.deletePost(postId),
    onMutate: async (postId: string) => {
      await queryClient.cancelQueries({ queryKey: ["community", "feed"] });
      // Snapshot + optimistic remove
      const previousFeeds = queryClient.getQueriesData<
        InfiniteData<CommunityFeedResponse>
      >({ queryKey: ["community", "feed"] });

      queryClient.setQueriesData<InfiniteData<CommunityFeedResponse>>(
        { queryKey: ["community", "feed"] },
        (old) => removePostFromFeedPages(old, postId)
      );
      return { previousFeeds };
    },
    onSuccess: () => {
      toast.success(t("community.toasts.postDeleted"));
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
    },
    onError: (err: Error, _postId, context) => {
      // Rollback
      context?.previousFeeds?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error(err.message || t("community.toasts.postDeleteError"));
    },
  });
}

export function useCreateCommunityGroup() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: (payload: CreateCommunityGroupPayload) =>
      communityService.createGroup(payload),
    onSuccess: (res) => {
      toast.success(res.message || t("community.toasts.groupCreated"));
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || t("community.toasts.groupCreateError"));
    },
  });
}

export function useReportCommunityPost() {
  const { t } = useI18n();
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
        res.message || t("community.toasts.reportSent")
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || t("community.toasts.reportError"));
    },
  });
}

/**
 * Optimistic UI Toggle Like (0ms latency with snapshot rollback on error)
 */
export function useTogglePostLike() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

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
      toast.error(err.message || t("community.toasts.loginToLike"));
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
  const { t } = useI18n();

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
          fullName: user?.fullName || t("community.youFallback"),
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
      toast.error(err.message || t("community.toasts.commentCreateError"));
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
  const { t } = useI18n();

  return useMutation({
    mutationFn: ({
      commentId,
    }: {
      commentId: string;
      postId: string;
    }) => communityService.deleteComment(commentId),
    onSuccess: (_res, vars) => {
      toast.success(t("community.toasts.commentDeleted"));
      queryClient.invalidateQueries({
        queryKey: COMMUNITY_QUERY_KEYS.comments(vars.postId),
      });
      queryClient.invalidateQueries({ queryKey: ["community", "feed"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t("community.toasts.commentDeleteError"));
    },
  });
}

export function useCloneCommunityItinerary() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: (itineraryId: string) =>
      itineraryService.cloneItinerary(itineraryId),
    onSuccess: () => {
      toast.success(t("community.toasts.itineraryCloned"));
      queryClient.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["planners"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t("community.toasts.itineraryCloneError"));
    },
  });
}

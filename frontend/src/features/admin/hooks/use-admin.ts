"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { adminService } from "@/services/admin.service";
import { placeService } from "@/services/place.service";
import type {
  AdminDashboardStats,
  AdminModerationConfig,
  AdminModerationPostItem,
  AdminContentReportItem,
  AdminPaginatedResponse,
  AdminPlacePhotoContributionItem,
  CreateBannedWordPayload,
  CreateOrUpdateAdminGroupPayload,
  CreateOrUpdateAdminPlacePayload,
  QueryAdminAuditLogsParams,
  QueryAdminBannedWordsParams,
  QueryAdminCommunityGroupsParams,
  QueryAdminModerationPostsParams,
  QueryAdminPlacePhotosParams,
  QueryAdminPlacesParams,
  QueryAdminReportsParams,
  QueryAdminUsersParams,
  UpdateBannedWordPayload,
} from "@/types/admin";
import { ADMIN_QUERY_CONFIG } from "../admin.constants";

export const ADMIN_QUERY_KEYS = {
  all: ["admin"] as const,
  dashboardStats: ["admin", "dashboard-stats"] as const,
  placeReferences: ["admin", "place-references"] as const,
  auditLogsPrefix: ["admin", "audit-logs"] as const,
  auditLogs: (params?: QueryAdminAuditLogsParams) =>
    ["admin", "audit-logs", params ?? {}] as const,
  usersPrefix: ["admin", "users"] as const,
  users: (params?: QueryAdminUsersParams) =>
    ["admin", "users", params ?? {}] as const,
  placesPrefix: ["admin", "places"] as const,
  places: (params?: QueryAdminPlacesParams) =>
    ["admin", "places", params ?? {}] as const,
  placePhotosPrefix: ["admin", "place-photos"] as const,
  placePhotos: (params?: QueryAdminPlacePhotosParams) =>
    ["admin", "place-photos", params ?? {}] as const,
  groupsPrefix: ["admin", "community-groups"] as const,
  groups: (params?: QueryAdminCommunityGroupsParams) =>
    ["admin", "community-groups", params ?? {}] as const,
  moderationConfig: ["admin", "moderation-config"] as const,
  moderationPostsPrefix: ["admin", "moderation-posts"] as const,
  moderationPosts: (params?: QueryAdminModerationPostsParams) =>
    ["admin", "moderation-posts", params ?? {}] as const,
  moderationReportsPrefix: ["admin", "moderation-reports"] as const,
  moderationReports: (params?: QueryAdminReportsParams) =>
    ["admin", "moderation-reports", params ?? {}] as const,
  bannedWordsPrefix: ["admin", "banned-words"] as const,
  bannedWords: (params?: QueryAdminBannedWordsParams) =>
    ["admin", "banned-words", params ?? {}] as const,
  communityPublicPrefix: ["community"] as const,
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Shared optimistic helper: removes an item by ID from all active paginated caches
 * under a query prefix and returns snapshots + the removed item (if present) for lossless rollback.
 */
async function optimisticallyRemoveFromPaginatedCache<T extends { id: string }>(
  qc: QueryClient,
  queryKeyPrefix: readonly unknown[],
  targetId: string
) {
  await qc.cancelQueries({ queryKey: queryKeyPrefix });
  const snapshots = qc.getQueriesData<AdminPaginatedResponse<T>>({
    queryKey: queryKeyPrefix,
  });

  let removedItem: T | undefined;
  for (const [key, data] of snapshots) {
    if (!data?.items) continue;
    const match = data.items.find((item) => item.id === targetId);
    if (!match) continue;
    if (!removedItem) removedItem = match;
    qc.setQueryData<AdminPaginatedResponse<T>>(key, {
      ...data,
      items: data.items.filter((item) => item.id !== targetId),
      meta: {
        ...data.meta,
        total: Math.max(0, data.meta.total - 1),
      },
    });
  }

  return { snapshots, removedItem };
}

function restorePaginatedSnapshots<T>(
  qc: QueryClient,
  snapshots?: Array<[readonly unknown[], T | undefined]>
) {
  if (!snapshots) return;
  for (const [key, data] of snapshots) {
    qc.setQueryData(key, data);
  }
}

export function useAdminDashboardStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.dashboardStats,
    queryFn: () => adminService.getDashboardStats(),
    enabled: options?.enabled ?? true,
    staleTime: ADMIN_QUERY_CONFIG.STATS_STALE_TIME_MS,
    refetchInterval: ADMIN_QUERY_CONFIG.STATS_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useAdminPlaceReferences(enabled = true) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.placeReferences,
    queryFn: async () => {
      const [travelAreas, categories] = await Promise.all([
        placeService.getTravelAreas().catch(() => []),
        placeService.getCategories().catch(() => []),
      ]);
      return { travelAreas, categories };
    },
    enabled,
    staleTime: ADMIN_QUERY_CONFIG.REF_DATA_STALE_TIME_MS,
  });
}

export function useAdminAuditLogs(params?: QueryAdminAuditLogsParams) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.auditLogs(params),
    queryFn: () => adminService.getAuditLogs(params),
    placeholderData: keepPreviousData,
    staleTime: ADMIN_QUERY_CONFIG.LIST_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useAdminUsers(params?: QueryAdminUsersParams) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.users(params),
    queryFn: () => adminService.getUsers(params),
    placeholderData: keepPreviousData,
    staleTime: ADMIN_QUERY_CONFIG.LIST_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useBanAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminService.banUser(userId, reason),
    onSuccess: (res) => {
      toast.success(res.message || "Đã khóa tài khoản thành công");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.usersPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể khóa tài khoản"));
    },
  });
}

export function useUnbanAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminService.unbanUser(userId),
    onSuccess: (res) => {
      toast.success(res.message || "Đã mở khóa tài khoản");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.usersPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể mở khóa tài khoản"));
    },
  });
}

export function usePromoteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, notes }: { userId: string; notes?: string }) =>
      adminService.promoteUser(userId, notes),
    onSuccess: (res) => {
      toast.success(res.message || "Đã thăng quyền Quản trị viên");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.usersPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể thăng quyền Quản trị viên"));
    },
  });
}

export function useAdminPlaces(
  params?: QueryAdminPlacesParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.places(params),
    queryFn: () => adminService.getPlaces(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
    staleTime: ADMIN_QUERY_CONFIG.LIST_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useCreateAdminPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrUpdateAdminPlacePayload) =>
      adminService.createPlace(payload),
    onSuccess: (res) => {
      toast.success(res.message || "Đã tạo địa điểm du lịch mới");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.placesPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể tạo địa điểm"));
    },
  });
}

export function useUpdateAdminPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      placeId,
      payload,
    }: {
      placeId: string;
      payload: Partial<CreateOrUpdateAdminPlacePayload>;
    }) => adminService.updatePlace(placeId, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Đã cập nhật địa điểm");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.placesPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể cập nhật địa điểm"));
    },
  });
}

export function useDeleteAdminPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (placeId: string) => adminService.deletePlace(placeId),
    onSuccess: (res) => {
      toast.success(res.message || "Đã xóa mềm địa điểm");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.placesPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể xóa địa điểm"));
    },
  });
}

export function useAdminPlacePhotoContributions(
  params?: QueryAdminPlacePhotosParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.placePhotos(params),
    queryFn: () => adminService.getPlacePhotoContributions(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
    staleTime: ADMIN_QUERY_CONFIG.LIST_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useApproveAdminPlacePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      imageId,
      setAsPrimary,
      note,
    }: {
      imageId: string;
      setAsPrimary?: boolean;
      note?: string;
    }) => adminService.approvePlacePhoto(imageId, { setAsPrimary, note }),
    onMutate: async ({ imageId }) => {
      const { snapshots: photoSnapshots, removedItem } =
        await optimisticallyRemoveFromPaginatedCache<AdminPlacePhotoContributionItem>(
          qc,
          ADMIN_QUERY_KEYS.placePhotosPrefix,
          imageId
        );
      const prevStats = qc.getQueryData<AdminDashboardStats>(
        ADMIN_QUERY_KEYS.dashboardStats
      );
      // Only decrement pendingPhotos when the photo was actually in PENDING status
      // (restoring a REJECTED photo must NOT falsely decrement pendingPhotos)
      if (prevStats && removedItem?.status === "PENDING") {
        qc.setQueryData<AdminDashboardStats>(ADMIN_QUERY_KEYS.dashboardStats, {
          ...prevStats,
          places: {
            ...prevStats.places,
            pendingPhotos: Math.max(0, prevStats.places.pendingPhotos - 1),
          },
        });
      }
      return { photoSnapshots, prevStats };
    },
    onSuccess: (res) => {
      toast.success(res.message || "Đã phê duyệt ảnh đóng góp");
    },
    onError: (err, _vars, ctx) => {
      restorePaginatedSnapshots(qc, ctx?.photoSnapshots);
      if (ctx?.prevStats) {
        qc.setQueryData(ADMIN_QUERY_KEYS.dashboardStats, ctx.prevStats);
      }
      toast.error(getErrorMessage(err, "Không thể phê duyệt ảnh đóng góp"));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.placePhotosPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.placesPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
  });
}

export function useRejectAdminPlacePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ imageId, reason }: { imageId: string; reason?: string }) =>
      adminService.rejectPlacePhoto(imageId, { reason }),
    onMutate: async ({ imageId }) => {
      const { snapshots: photoSnapshots, removedItem } =
        await optimisticallyRemoveFromPaginatedCache<AdminPlacePhotoContributionItem>(
          qc,
          ADMIN_QUERY_KEYS.placePhotosPrefix,
          imageId
        );
      const prevStats = qc.getQueryData<AdminDashboardStats>(
        ADMIN_QUERY_KEYS.dashboardStats
      );
      if (prevStats && removedItem?.status === "PENDING") {
        qc.setQueryData<AdminDashboardStats>(ADMIN_QUERY_KEYS.dashboardStats, {
          ...prevStats,
          places: {
            ...prevStats.places,
            pendingPhotos: Math.max(0, prevStats.places.pendingPhotos - 1),
          },
        });
      }
      return { photoSnapshots, prevStats };
    },
    onSuccess: (res) => {
      toast.success(res.message || "Đã từ chối ảnh đóng góp");
    },
    onError: (err, _vars, ctx) => {
      restorePaginatedSnapshots(qc, ctx?.photoSnapshots);
      if (ctx?.prevStats) {
        qc.setQueryData(ADMIN_QUERY_KEYS.dashboardStats, ctx.prevStats);
      }
      toast.error(getErrorMessage(err, "Không thể từ chối ảnh đóng góp"));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.placePhotosPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.placesPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
  });
}

export function useAdminCommunityGroups(
  params?: QueryAdminCommunityGroupsParams
) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.groups(params),
    queryFn: () => adminService.getCommunityGroups(params),
    placeholderData: keepPreviousData,
    staleTime: ADMIN_QUERY_CONFIG.LIST_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useCreateAdminCommunityGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrUpdateAdminGroupPayload) =>
      adminService.createCommunityGroup(payload),
    onSuccess: (res) => {
      toast.success(res.message || "Đã tạo chủ đề cộng đồng mới");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.groupsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.communityPublicPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể tạo chủ đề cộng đồng"));
    },
  });
}

export function useUpdateAdminCommunityGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string;
      payload: Partial<CreateOrUpdateAdminGroupPayload>;
    }) => adminService.updateCommunityGroup(groupId, payload),
    onSuccess: (res) => {
      toast.success(res.message || "Đã cập nhật chủ đề cộng đồng");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.groupsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.communityPublicPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể cập nhật chủ đề cộng đồng"));
    },
  });
}

export function useDeleteAdminCommunityGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => adminService.deleteCommunityGroup(groupId),
    onSuccess: (res) => {
      toast.success(res.message || "Đã xóa mềm chủ đề cộng đồng");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.groupsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.communityPublicPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể xóa chủ đề cộng đồng"));
    },
  });
}

export function useAdminModerationConfig() {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.moderationConfig,
    queryFn: () => adminService.getModerationConfig(),
    staleTime: ADMIN_QUERY_CONFIG.STATS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateAdminModerationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aiModerationEnabled: boolean) =>
      adminService.updateModerationConfig(aiModerationEnabled),
    onMutate: async (aiModerationEnabled) => {
      await qc.cancelQueries({ queryKey: ADMIN_QUERY_KEYS.moderationConfig });
      const prevConfig = qc.getQueryData<AdminModerationConfig>(
        ADMIN_QUERY_KEYS.moderationConfig
      );
      if (prevConfig) {
        qc.setQueryData<AdminModerationConfig>(
          ADMIN_QUERY_KEYS.moderationConfig,
          { ...prevConfig, aiModerationEnabled }
        );
      }
      return { prevConfig };
    },
    onSuccess: (res) => {
      toast.success(res.message);
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevConfig) {
        qc.setQueryData(ADMIN_QUERY_KEYS.moderationConfig, ctx.prevConfig);
      }
      toast.error(getErrorMessage(err, "Không thể cập nhật cấu hình AI"));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.moderationConfig });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
  });
}

export function useAdminModerationPosts(
  params?: QueryAdminModerationPostsParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.moderationPosts(params),
    queryFn: () => adminService.getModerationPosts(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
    staleTime: ADMIN_QUERY_CONFIG.LIST_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useApproveAdminPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, reason }: { postId: string; reason?: string }) =>
      adminService.approvePost(postId, reason),
    onMutate: async ({ postId }) => {
      const { snapshots: postSnapshots } =
        await optimisticallyRemoveFromPaginatedCache<AdminModerationPostItem>(
          qc,
          ADMIN_QUERY_KEYS.moderationPostsPrefix,
          postId
        );
      return { postSnapshots };
    },
    onSuccess: (res) => {
      toast.success(res.message || "Đã phê duyệt bài viết");
    },
    onError: (err, _vars, ctx) => {
      restorePaginatedSnapshots(qc, ctx?.postSnapshots);
      toast.error(
        getErrorMessage(
          err,
          "Bài viết đã bị xóa hoặc không thể kiểm duyệt được nữa"
        )
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.moderationPostsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.communityPublicPrefix });
    },
  });
}

export function useRejectAdminPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, reason }: { postId: string; reason?: string }) =>
      adminService.rejectPost(postId, reason),
    onMutate: async ({ postId }) => {
      const { snapshots: postSnapshots } =
        await optimisticallyRemoveFromPaginatedCache<AdminModerationPostItem>(
          qc,
          ADMIN_QUERY_KEYS.moderationPostsPrefix,
          postId
        );
      return { postSnapshots };
    },
    onSuccess: (res) => {
      toast.success(res.message || "Đã từ chối bài viết");
    },
    onError: (err, _vars, ctx) => {
      restorePaginatedSnapshots(qc, ctx?.postSnapshots);
      toast.error(
        getErrorMessage(
          err,
          "Bài viết đã bị xóa hoặc không thể kiểm duyệt được nữa"
        )
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.moderationPostsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.communityPublicPrefix });
    },
  });
}

export function useAdminModerationReports(
  params?: QueryAdminReportsParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.moderationReports(params),
    queryFn: () => adminService.getModerationReports(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
    staleTime: ADMIN_QUERY_CONFIG.LIST_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useResolveAdminReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reportId,
      action,
      resolutionNote,
      rejectTargetPost,
    }: {
      reportId: string;
      action: "RESOLVE" | "DISMISS";
      resolutionNote?: string;
      rejectTargetPost?: boolean;
    }) =>
      adminService.resolveReport(reportId, {
        action,
        resolutionNote,
        rejectTargetPost,
      }),
    onMutate: async ({ reportId }) => {
      const { snapshots: reportSnapshots } =
        await optimisticallyRemoveFromPaginatedCache<AdminContentReportItem>(
          qc,
          ADMIN_QUERY_KEYS.moderationReportsPrefix,
          reportId
        );
      return { reportSnapshots };
    },
    onSuccess: (res) => {
      toast.success(res.message || "Đã xử lý báo cáo");
    },
    onError: (err, _vars, ctx) => {
      restorePaginatedSnapshots(qc, ctx?.reportSnapshots);
      toast.error(getErrorMessage(err, "Không thể xử lý báo cáo"));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.moderationReportsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.moderationPostsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.communityPublicPrefix });
    },
  });
}

export function useAdminBannedWords(
  params?: QueryAdminBannedWordsParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.bannedWords(params),
    queryFn: () => adminService.getBannedWords(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
    staleTime: ADMIN_QUERY_CONFIG.LIST_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

export function useCreateAdminBannedWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBannedWordPayload) =>
      adminService.createBannedWord(payload),
    onSuccess: (res) => {
      const scopeLabel =
        res.action === "REVIEW" ? "từ khóa AI duyệt (T2)" : "từ cấm (T1)";
      toast.success(`Đã thêm ${scopeLabel}: "${res.word}"`);
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.bannedWordsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể thêm từ khóa kiểm duyệt"));
    },
  });
}

export function useUpdateAdminBannedWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateBannedWordPayload;
    }) => adminService.updateBannedWord(id, payload),
    onSuccess: (res) => {
      toast.success(`Đã cập nhật từ khóa: "${res.word}"`);
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.bannedWordsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(
        getErrorMessage(err, "Không thể cập nhật từ khóa kiểm duyệt")
      );
    },
  });
}

export function useToggleAdminBannedWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminService.toggleBannedWord(id, isActive),
    onSuccess: (res) => {
      toast.success(
        `${res.isActive ? "Đã kích hoạt" : "Đã vô hiệu hóa"} từ cấm: "${res.word}"`
      );
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.bannedWordsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể cập nhật từ cấm"));
    },
  });
}

export function useDeleteAdminBannedWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteBannedWord(id),
    onSuccess: (res) => {
      toast.success(res.message || "Đã xóa từ cấm");
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.bannedWordsPrefix });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.auditLogsPrefix });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể xóa từ cấm"));
    },
  });
}

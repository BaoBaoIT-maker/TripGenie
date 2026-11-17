"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { adminService } from "@/services/admin.service";
import type {
  CreateOrUpdateAdminGroupPayload,
  CreateOrUpdateAdminPlacePayload,
  QueryAdminAuditLogsParams,
  QueryAdminCommunityGroupsParams,
  QueryAdminModerationPostsParams,
  QueryAdminPlacesParams,
  QueryAdminReportsParams,
  QueryAdminUsersParams,
} from "@/types/admin";

export const ADMIN_QUERY_KEYS = {
  all: ["admin"] as const,
  dashboardStats: ["admin", "dashboard-stats"] as const,
  auditLogs: (params?: QueryAdminAuditLogsParams) =>
    ["admin", "audit-logs", params ?? {}] as const,
  users: (params?: QueryAdminUsersParams) =>
    ["admin", "users", params ?? {}] as const,
  places: (params?: QueryAdminPlacesParams) =>
    ["admin", "places", params ?? {}] as const,
  groups: (params?: QueryAdminCommunityGroupsParams) =>
    ["admin", "community-groups", params ?? {}] as const,
  moderationConfig: ["admin", "moderation-config"] as const,
  moderationPosts: (params?: QueryAdminModerationPostsParams) =>
    ["admin", "moderation-posts", params ?? {}] as const,
  moderationReports: (params?: QueryAdminReportsParams) =>
    ["admin", "moderation-reports", params ?? {}] as const,
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.dashboardStats,
    queryFn: () => adminService.getDashboardStats(),
    staleTime: 15_000,
  });
}

export function useAdminAuditLogs(params?: QueryAdminAuditLogsParams) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.auditLogs(params),
    queryFn: () => adminService.getAuditLogs(params),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUsers(params?: QueryAdminUsersParams) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.users(params),
    queryFn: () => adminService.getUsers(params),
    placeholderData: keepPreviousData,
  });
}

export function useBanAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminService.banUser(userId, reason),
    onSuccess: (res) => {
      toast.success(res.message || "Đã khóa tài khoản thành công");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
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
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
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
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể thăng quyền Quản trị viên"));
    },
  });
}

export function useAdminPlaces(params?: QueryAdminPlacesParams) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.places(params),
    queryFn: () => adminService.getPlaces(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateAdminPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrUpdateAdminPlacePayload) =>
      adminService.createPlace(payload),
    onSuccess: (res) => {
      toast.success(res.message || "Đã tạo địa điểm du lịch mới");
      qc.invalidateQueries({ queryKey: ["admin", "places"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
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
      qc.invalidateQueries({ queryKey: ["admin", "places"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
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
      qc.invalidateQueries({ queryKey: ["admin", "places"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể xóa địa điểm"));
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
  });
}

export function useCreateAdminCommunityGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrUpdateAdminGroupPayload) =>
      adminService.createCommunityGroup(payload),
    onSuccess: (res) => {
      toast.success(res.message || "Đã tạo chủ đề cộng đồng mới");
      qc.invalidateQueries({ queryKey: ["admin", "community-groups"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
      qc.invalidateQueries({ queryKey: ["community"] });
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
      qc.invalidateQueries({ queryKey: ["admin", "community-groups"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
      qc.invalidateQueries({ queryKey: ["community"] });
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
      qc.invalidateQueries({ queryKey: ["admin", "community-groups"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
      qc.invalidateQueries({ queryKey: ["community"] });
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
  });
}

export function useUpdateAdminModerationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aiModerationEnabled: boolean) =>
      adminService.updateModerationConfig(aiModerationEnabled),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.moderationConfig });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể cập nhật cấu hình AI"));
    },
  });
}

export function useAdminModerationPosts(
  params?: QueryAdminModerationPostsParams
) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.moderationPosts(params),
    queryFn: () => adminService.getModerationPosts(params),
    placeholderData: keepPreviousData,
  });
}

export function useApproveAdminPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, reason }: { postId: string; reason?: string }) =>
      adminService.approvePost(postId, reason),
    onSuccess: (res) => {
      toast.success(res.message || "Đã phê duyệt bài viết");
      qc.invalidateQueries({ queryKey: ["admin", "moderation-posts"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể phê duyệt bài viết"));
    },
  });
}

export function useRejectAdminPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, reason }: { postId: string; reason?: string }) =>
      adminService.rejectPost(postId, reason),
    onSuccess: (res) => {
      toast.success(res.message || "Đã từ chối bài viết");
      qc.invalidateQueries({ queryKey: ["admin", "moderation-posts"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể từ chối bài viết"));
    },
  });
}

export function useAdminModerationReports(params?: QueryAdminReportsParams) {
  return useQuery({
    queryKey: ADMIN_QUERY_KEYS.moderationReports(params),
    queryFn: () => adminService.getModerationReports(params),
    placeholderData: keepPreviousData,
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
    onSuccess: (res) => {
      toast.success(res.message || "Đã xử lý báo cáo");
      qc.invalidateQueries({ queryKey: ["admin", "moderation-reports"] });
      qc.invalidateQueries({ queryKey: ["admin", "moderation-posts"] });
      qc.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.dashboardStats });
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Không thể xử lý báo cáo"));
    },
  });
}

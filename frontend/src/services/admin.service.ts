import { apiClient } from "@/lib/api-client";
import type {
  AdminAuditLogItem,
  AdminBannedWordItem,
  AdminCommunityGroupItem,
  AdminDashboardStats,
  AdminModerationConfig,
  AdminModerationPostItem,
  AdminModerationReportsResponse,
  AdminPaginatedResponse,
  AdminPlaceItem,
  AdminUserItem,
  CreateBannedWordPayload,
  CreateOrUpdateAdminGroupPayload,
  CreateOrUpdateAdminPlacePayload,
  QueryAdminAuditLogsParams,
  QueryAdminBannedWordsParams,
  QueryAdminCommunityGroupsParams,
  QueryAdminModerationPostsParams,
  QueryAdminPlacesParams,
  QueryAdminReportsParams,
  QueryAdminUsersParams,
} from "@/types/admin";

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const adminService = {
  getDashboardStats: (): Promise<AdminDashboardStats> =>
    apiClient<AdminDashboardStats>("/admin/dashboard/stats"),

  getAuditLogs: (
    params?: QueryAdminAuditLogsParams
  ): Promise<AdminPaginatedResponse<AdminAuditLogItem>> =>
    apiClient<AdminPaginatedResponse<AdminAuditLogItem>>(
      `/admin/audit-logs${buildQueryString(params as Record<string, unknown>)}`
    ),

  getUsers: (
    params?: QueryAdminUsersParams
  ): Promise<AdminPaginatedResponse<AdminUserItem>> =>
    apiClient<AdminPaginatedResponse<AdminUserItem>>(
      `/admin/users${buildQueryString(params as Record<string, unknown>)}`
    ),

  banUser: (
    userId: string,
    reason: string
  ): Promise<{ success: boolean; message: string; userId: string }> =>
    apiClient(`/admin/users/${userId}/ban`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),

  unbanUser: (
    userId: string
  ): Promise<{ success: boolean; message: string; userId: string }> =>
    apiClient(`/admin/users/${userId}/unban`, {
      method: "PATCH",
      body: JSON.stringify({}),
    }),

  promoteUser: (
    userId: string,
    notes?: string
  ): Promise<{ success: boolean; message: string; userId: string }> =>
    apiClient(`/admin/users/${userId}/promote`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    }),

  getPlaces: (
    params?: QueryAdminPlacesParams
  ): Promise<AdminPaginatedResponse<AdminPlaceItem>> =>
    apiClient<AdminPaginatedResponse<AdminPlaceItem>>(
      `/admin/places${buildQueryString(params as Record<string, unknown>)}`
    ),

  createPlace: (
    payload: CreateOrUpdateAdminPlacePayload
  ): Promise<{ success: boolean; message: string; data: AdminPlaceItem }> =>
    apiClient("/admin/places", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updatePlace: (
    placeId: string,
    payload: Partial<CreateOrUpdateAdminPlacePayload>
  ): Promise<{ success: boolean; message: string; data: AdminPlaceItem }> =>
    apiClient(`/admin/places/${placeId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deletePlace: (
    placeId: string
  ): Promise<{ success: boolean; message: string; placeId: string }> =>
    apiClient(`/admin/places/${placeId}`, {
      method: "DELETE",
    }),

  getCommunityGroups: (
    params?: QueryAdminCommunityGroupsParams
  ): Promise<AdminPaginatedResponse<AdminCommunityGroupItem>> =>
    apiClient<AdminPaginatedResponse<AdminCommunityGroupItem>>(
      `/admin/community/groups${buildQueryString(params as Record<string, unknown>)}`
    ),

  createCommunityGroup: (
    payload: CreateOrUpdateAdminGroupPayload
  ): Promise<{
    success: boolean;
    message: string;
    data: AdminCommunityGroupItem;
  }> =>
    apiClient("/admin/community/groups", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCommunityGroup: (
    groupId: string,
    payload: Partial<CreateOrUpdateAdminGroupPayload>
  ): Promise<{
    success: boolean;
    message: string;
    data: AdminCommunityGroupItem;
  }> =>
    apiClient(`/admin/community/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteCommunityGroup: (
    groupId: string
  ): Promise<{ success: boolean; message: string; groupId: string }> =>
    apiClient(`/admin/community/groups/${groupId}`, {
      method: "DELETE",
    }),

  getModerationConfig: (): Promise<AdminModerationConfig> =>
    apiClient<AdminModerationConfig>("/admin/moderation/config"),

  updateModerationConfig: (
    aiModerationEnabled: boolean
  ): Promise<{
    success: boolean;
    message: string;
    aiModerationEnabled: boolean;
  }> =>
    apiClient("/admin/moderation/config", {
      method: "PATCH",
      body: JSON.stringify({ aiModerationEnabled }),
    }),

  getModerationPosts: (
    params?: QueryAdminModerationPostsParams
  ): Promise<AdminPaginatedResponse<AdminModerationPostItem>> =>
    apiClient<AdminPaginatedResponse<AdminModerationPostItem>>(
      `/admin/moderation/posts${buildQueryString(params as Record<string, unknown>)}`
    ),

  approvePost: (
    postId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    message: string;
    data: AdminModerationPostItem;
  }> =>
    apiClient(`/admin/moderation/posts/${postId}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),

  rejectPost: (
    postId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    message: string;
    data: AdminModerationPostItem;
  }> =>
    apiClient(`/admin/moderation/posts/${postId}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),

  getModerationReports: (
    params?: QueryAdminReportsParams
  ): Promise<AdminModerationReportsResponse> =>
    apiClient<AdminModerationReportsResponse>(
      `/admin/moderation/reports${buildQueryString(params as Record<string, unknown>)}`
    ),

  resolveReport: (
    reportId: string,
    payload: {
      action: "RESOLVE" | "DISMISS";
      resolutionNote?: string;
      rejectTargetPost?: boolean;
    }
  ): Promise<{ success: boolean; message: string; reportId: string }> =>
    apiClient(`/admin/moderation/reports/${reportId}/resolve`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  getBannedWords: (
    params?: QueryAdminBannedWordsParams
  ): Promise<AdminPaginatedResponse<AdminBannedWordItem>> =>
    apiClient<AdminPaginatedResponse<AdminBannedWordItem>>(
      `/admin/banned-words${buildQueryString(params as Record<string, unknown>)}`
    ),

  createBannedWord: (
    payload: CreateBannedWordPayload
  ): Promise<AdminBannedWordItem> =>
    apiClient<AdminBannedWordItem>("/admin/banned-words", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  toggleBannedWord: (
    id: string,
    isActive: boolean
  ): Promise<AdminBannedWordItem> =>
    apiClient<AdminBannedWordItem>(`/admin/banned-words/${id}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),

  deleteBannedWord: (
    id: string
  ): Promise<{ success: boolean; message: string; id: string }> =>
    apiClient(`/admin/banned-words/${id}`, {
      method: "DELETE",
    }),
};

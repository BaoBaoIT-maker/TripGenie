import type { ReactNode } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { adminService } from "@/services/admin.service";
import {
  ADMIN_QUERY_KEYS,
  useApproveAdminPlacePhoto,
  useApproveAdminPost,
} from "@/features/admin/hooks/use-admin";
import type {
  AdminDashboardStats,
  AdminModerationPostItem,
  AdminPaginatedResponse,
  AdminPlacePhotoContributionItem,
} from "@/types/admin";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/services/admin.service", () => ({
  adminService: {
    approvePost: vi.fn(),
    rejectPost: vi.fn(),
    approvePlacePhoto: vi.fn(),
    rejectPlacePhoto: vi.fn(),
  },
}));

describe("Admin Optimistic UI Hooks", () => {
  let queryClient: QueryClient;

  const createWrapper = () =>
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("optimistically removes an approved post immediately and rolls back on failure", async () => {
    const queryKey = ADMIN_QUERY_KEYS.moderationPosts({
      page: 1,
      statuses: ["FLAGGED", "PENDING"],
    });
    const seed: AdminPaginatedResponse<AdminModerationPostItem> = {
      items: [
        {
          id: "post-1",
          userId: "u1",
          groupId: null,
          title: "Kinh nghiệm đi Đà Lạt",
          caption: "Rất đẹp",
          mediaUrls: [],
          tags: [],
          likeCount: 0,
          commentCount: 0,
          moderationStatus: "FLAGGED",
          moderationNote: null,
          moderatedAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    queryClient.setQueryData(queryKey, seed);

    let rejectApi!: (err: Error) => void;
    vi.mocked(adminService.approvePost).mockImplementation(
      () =>
        new Promise((_res, rej) => {
          rejectApi = rej;
        })
    );

    const { result } = renderHook(() => useApproveAdminPost(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ postId: "post-1" });
    });

    // 0ms optimistic removal before API settles
    await waitFor(() => {
      const current =
        queryClient.getQueryData<AdminPaginatedResponse<AdminModerationPostItem>>(
          queryKey
        );
      expect(current?.items).toHaveLength(0);
      expect(current?.meta.total).toBe(0);
    });

    // API failure triggers rollback
    act(() => {
      rejectApi(new Error("Network failure"));
    });

    await waitFor(() => {
      const rolledBack =
        queryClient.getQueryData<AdminPaginatedResponse<AdminModerationPostItem>>(
          queryKey
        );
      expect(rolledBack?.items).toHaveLength(1);
      expect(rolledBack?.items[0].id).toBe("post-1");
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("optimistically removes a pending place photo and decrements pendingPhotos stat", async () => {
    const photosKey = ADMIN_QUERY_KEYS.placePhotos({
      page: 1,
      status: "PENDING",
    });
    const photoSeed: AdminPaginatedResponse<AdminPlacePhotoContributionItem> = {
      items: [
        {
          id: "photo-1",
          placeId: "place-1",
          imageUrl: "https://res.cloudinary.com/demo/image/upload/p1.jpg",
          thumbnailUrl: null,
          caption: "Mặt tiền quán",
          isPrimary: false,
          source: "user_contribution",
          status: "PENDING",
          moderationNote: null,
          reviewedAt: null,
          createdAt: new Date().toISOString(),
          place: { id: "place-1", name: "Cà phê Biển", address: "Đà Nẵng" },
        },
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    const statsSeed: AdminDashboardStats = {
      users: { total: 10, active: 10, banned: 0, newThisWeek: 1 },
      places: { total: 50, active: 50, inactive: 0, pendingPhotos: 3, byCategory: [] },
      community: { approvedPosts: 5, totalComments: 2, activeGroups: 2 },
      moderation: {
        pendingPosts: 0,
        flaggedPosts: 0,
        rejectedPosts: 0,
        pendingReports: 0,
        highPriorityReportAlerts: 0,
        highPriorityReportThreshold: 20,
      },
    };
    queryClient.setQueryData(photosKey, photoSeed);
    queryClient.setQueryData(ADMIN_QUERY_KEYS.dashboardStats, statsSeed);

    vi.mocked(adminService.approvePlacePhoto).mockResolvedValue({
      success: true,
      message: "Đã phê duyệt ảnh đóng góp",
      image: { ...photoSeed.items[0], status: "APPROVED" },
    });

    const { result } = renderHook(() => useApproveAdminPlacePhoto(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ imageId: "photo-1", setAsPrimary: true });
    });

    await waitFor(() => {
      const photos =
        queryClient.getQueryData<
          AdminPaginatedResponse<AdminPlacePhotoContributionItem>
        >(photosKey);
      const stats = queryClient.getQueryData<AdminDashboardStats>(
        ADMIN_QUERY_KEYS.dashboardStats
      );
      expect(photos?.items).toHaveLength(0);
      expect(stats?.places.pendingPhotos).toBe(2);
    });
  });

  it("does NOT decrement pendingPhotos when restoring a previously REJECTED photo", async () => {
    const rejectedKey = ADMIN_QUERY_KEYS.placePhotos({
      page: 1,
      status: "REJECTED",
    });
    const rejectedSeed: AdminPaginatedResponse<AdminPlacePhotoContributionItem> = {
      items: [
        {
          id: "photo-rejected-1",
          placeId: "place-1",
          imageUrl: "https://res.cloudinary.com/demo/image/upload/p-rej.jpg",
          thumbnailUrl: null,
          caption: "Ảnh bị từ chối nhầm",
          isPrimary: false,
          source: "user_contribution",
          status: "REJECTED",
          moderationNote: "Nhầm lẫn",
          reviewedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          place: { id: "place-1", name: "Cà phê Biển", address: "Đà Nẵng" },
        },
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    const statsSeed: AdminDashboardStats = {
      users: { total: 10, active: 10, banned: 0, newThisWeek: 1 },
      places: { total: 50, active: 50, inactive: 0, pendingPhotos: 3, byCategory: [] },
      community: { approvedPosts: 5, totalComments: 2, activeGroups: 2 },
      moderation: {
        pendingPosts: 0,
        flaggedPosts: 0,
        rejectedPosts: 0,
        pendingReports: 0,
        highPriorityReportAlerts: 0,
        highPriorityReportThreshold: 20,
      },
    };
    queryClient.setQueryData(rejectedKey, rejectedSeed);
    queryClient.setQueryData(ADMIN_QUERY_KEYS.dashboardStats, statsSeed);

    vi.mocked(adminService.approvePlacePhoto).mockResolvedValue({
      success: true,
      message: "Đã phê duyệt ảnh đóng góp",
      image: { ...rejectedSeed.items[0], status: "APPROVED" },
    });

    const { result } = renderHook(() => useApproveAdminPlacePhoto(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ imageId: "photo-rejected-1" });
    });

    await waitFor(() => {
      const photos =
        queryClient.getQueryData<
          AdminPaginatedResponse<AdminPlacePhotoContributionItem>
        >(rejectedKey);
      const stats = queryClient.getQueryData<AdminDashboardStats>(
        ADMIN_QUERY_KEYS.dashboardStats
      );
      expect(photos?.items).toHaveLength(0);
      // Must remain 3 (not falsely decremented to 2)
      expect(stats?.places.pendingPhotos).toBe(3);
    });
  });
});

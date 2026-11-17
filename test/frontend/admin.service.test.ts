import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "@/lib/api-client";
import { resolvePostLoginRedirect } from "@/lib/safe-redirect";
import { adminService } from "@/services/admin.service";
import {
  ADMIN_SIDEBAR_NAV,
  ADMIN_UI_CONSTANTS,
  formatAdminDateOnly,
  formatAdminDateTime,
} from "@/features/admin/admin.constants";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
}));

describe("Admin Frontend Service & Constants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defines 6 canonical admin routes across 3 sidebar groups", () => {
    const allRoutes = ADMIN_SIDEBAR_NAV.flatMap((g) =>
      g.items.map((i) => i.href)
    );
    expect(allRoutes).toEqual([
      "/admin/dashboard",
      "/admin/moderation",
      "/admin/users",
      "/admin/places",
      "/admin/community",
      "/admin/audit-logs",
    ]);
    expect(ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE).toBe(20);
    expect(ADMIN_UI_CONSTANTS.HIGH_PRIORITY_REPORT_THRESHOLD).toBe(20);
  });

  it("routes ADMIN users directly to /admin/dashboard after login", () => {
    expect(resolvePostLoginRedirect("ADMIN", null)).toBe("/admin/dashboard");
    expect(resolvePostLoginRedirect("ADMIN", "/")).toBe("/admin/dashboard");
    expect(resolvePostLoginRedirect("ADMIN", "/explore")).toBe(
      "/admin/dashboard"
    );
    expect(resolvePostLoginRedirect("ADMIN", "/admin/places")).toBe(
      "/admin/places"
    );
    expect(resolvePostLoginRedirect("USER", null, "/")).toBe("/");
    expect(resolvePostLoginRedirect("USER", "/community", "/")).toBe(
      "/community"
    );
  });

  it("formats admin date strings safely", () => {
    expect(formatAdminDateTime(null)).toBe("—");
    expect(formatAdminDateOnly(undefined)).toBe("—");
    expect(formatAdminDateOnly("2026-11-16T12:00:00.000Z")).toContain("2026");
  });

  it("calls getPlaces with server-side pagination and filter query parameters", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      items: [],
      meta: { total: 0, page: 2, limit: 20, totalPages: 1 },
    });

    await adminService.getPlaces({
      page: 2,
      limit: 20,
      areaId: 3,
      categoryId: 5,
      search: "Đà Lạt",
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/admin/places?page=2&limit=20&areaId=3&categoryId=5&search=%C4%90%C3%A0+L%E1%BA%A1t"
    );
  });

  it("calls createCommunityGroup without requiring manual slug input", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      message: "OK",
      data: { id: "g-1", name: "Săn Mây Đà Lạt", slug: "san-may-da-lat" },
    });

    await adminService.createCommunityGroup({
      name: "Săn Mây Đà Lạt",
      subtitle: "Đà Lạt, Cầu Đất",
      coverUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    });

    expect(apiClient).toHaveBeenCalledWith("/admin/community/groups", {
      method: "POST",
      body: JSON.stringify({
        name: "Săn Mây Đà Lạt",
        subtitle: "Đà Lạt, Cầu Đất",
        coverUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      }),
    });
  });

  it("calls resolveReport with DISMISS to protect authors against mass-reporting", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      message: "OK",
      reportId: "rep-1",
    });

    await adminService.resolveReport("rep-1", {
      action: "DISMISS",
      resolutionNote: "Bác bỏ report ảo",
      rejectTargetPost: false,
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/admin/moderation/reports/rep-1/resolve",
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "DISMISS",
          resolutionNote: "Bác bỏ report ảo",
          rejectTargetPost: false,
        }),
      }
    );
  });
});

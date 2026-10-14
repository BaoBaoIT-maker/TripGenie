import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/common/Navbar";
import { BottomNav } from "@/components/common/BottomNav";
import { useAuth } from "@/features/auth/hooks/use-auth";

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore",
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
  })),
}));

describe("Map Navigation", () => {
  it("renders desktop navigation links properly", () => {
    render(<Navbar />);
    const link = screen.getByRole("link", { name: /Khám phá/i });
    expect(link).toHaveAttribute("href", "/explore");
  });

  it("renders authenticated user menu without Base UI context error", () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      user: {
        id: "user-1",
        fullName: "Test User",
        email: "test@example.com",
        username: "testuser",
        avatarUrl: null,
      } as any,
      isAuthenticated: true,
      logout: vi.fn(),
    } as any);

    render(<Navbar />);
    expect(screen.getByRole("button", { name: /Địa điểm đã lưu/i })).toBeInTheDocument();
  });

  it("keeps five mobile items and links map to explore split view", () => {
    render(<BottomNav />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /Bản đồ/i })).toHaveAttribute("href", "/explore?view=split");
    expect(screen.queryByRole("link", { name: /Đã lưu/i })).not.toBeInTheDocument();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/common/Navbar";
import { BottomNav } from "@/components/common/BottomNav";
import { useAuth } from "@/features/auth/hooks/use-auth";

let mockPathname = "/explore";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
  })),
}));

describe("Map Navigation", () => {
  beforeEach(() => {
    mockPathname = "/explore";
    mockSearchParams = new URLSearchParams();
  });

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

  it("marks only Explore as active when on /explore without view=split", () => {
    mockPathname = "/explore";
    mockSearchParams = new URLSearchParams("");
    render(<BottomNav />);

    const exploreLink = screen.getByRole("link", { name: /Khám phá/i });
    const mapLink = screen.getByRole("link", { name: /Bản đồ/i });

    expect(exploreLink).toHaveClass("text-primary");
    expect(mapLink).not.toHaveClass("text-primary");
  });

  it("marks only Map as active when on /explore with view=split", () => {
    mockPathname = "/explore";
    mockSearchParams = new URLSearchParams("view=split");
    render(<BottomNav />);

    const exploreLink = screen.getByRole("link", { name: /Khám phá/i });
    const mapLink = screen.getByRole("link", { name: /Bản đồ/i });

    expect(mapLink).toHaveClass("text-primary");
    expect(exploreLink).not.toHaveClass("text-primary");
  });
});

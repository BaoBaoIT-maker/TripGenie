import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/common/Navbar";
import { MobileNavSheet } from "@/components/common/MobileNavSheet";
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

vi.mock("@/features/notifications/components/NotificationBell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

describe("Navigation System", () => {
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

  it("renders mobile navigation drawer trigger", () => {
    render(<MobileNavSheet triggerVariant="light" />);
    expect(screen.getByRole("button", { name: /Mở menu điều hướng di động/i })).toBeInTheDocument();
  });
});

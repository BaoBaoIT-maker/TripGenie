import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { NotificationList } from "@/features/notifications/components/NotificationList";
import type { NotificationItem } from "@/types/notification";

vi.mock("@/features/notifications/hooks/use-notifications", () => ({
  useMarkNotificationRead: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

describe("NotificationList component", () => {
  it("renders empty state when items is empty and filter is ALL", () => {
    render(<NotificationList items={[]} filter="ALL" />);
    expect(screen.getByText("Bạn chưa có thông báo nào")).toBeInTheDocument();
  });

  it("renders empty state when items is empty and filter is UNREAD", () => {
    render(<NotificationList items={[]} filter="UNREAD" />);
    expect(screen.getByText("Bạn đã đọc hết thông báo")).toBeInTheDocument();
  });

  it("renders notifications with actor name, post title, and interaction type", () => {
    const mockItems: NotificationItem[] = [
      {
        id: "notif-1",
        type: "POST_LIKED",
        actor: {
          id: "u-2",
          fullName: "Bảo Ngọc",
          avatarUrl: null,
        },
        post: {
          id: "post-1",
          title: "Chuyến đi Đà Lạt mùa hoa dã quỳ",
        },
        commentId: null,
        createdAt: new Date().toISOString(),
        readAt: null,
      },
      {
        id: "notif-2",
        type: "POST_COMMENTED",
        actor: {
          id: "u-3",
          fullName: "Hoàng Nam",
          avatarUrl: null,
        },
        post: {
          id: "post-1",
          title: "Chuyến đi Đà Lạt mùa hoa dã quỳ",
        },
        commentId: "cmt-1",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        readAt: new Date().toISOString(),
      },
    ];

    render(<NotificationList items={mockItems} filter="ALL" />);

    expect(screen.getByText("Bảo Ngọc")).toBeInTheDocument();
    expect(screen.getByText("đã thích bài viết:")).toBeInTheDocument();
    expect(screen.getByText("Hoàng Nam")).toBeInTheDocument();
    expect(screen.getByText("đã bình luận về bài viết:")).toBeInTheDocument();
  });
});

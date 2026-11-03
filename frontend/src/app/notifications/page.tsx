"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { Bell, CheckCheck, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { NotificationFilter, NotificationItem } from "@/types/notification";
import { NOTIFICATION_CONFIG } from "@/features/notifications/config/notification.config";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
} from "@/features/notifications/hooks/use-notifications";
import { NotificationList } from "@/features/notifications/components/NotificationList";

function NotificationsPageContent() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [filter, setFilter] = useState<NotificationFilter>("ALL");

  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.count ?? 0;

  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useNotifications(filter, NOTIFICATION_CONFIG.PAGE_LIMIT);

  const markAllMutation = useMarkAllNotificationsRead();

  // Deduplicate items across pages by id
  const items = useMemo(() => {
    if (!data?.pages) return [];
    const map = new Map<string, NotificationItem>();
    for (const page of data.pages) {
      for (const item of page.items) {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      }
    }
    return Array.from(map.values());
  }, [data]);

  const handleMarkAll = () => {
    if (unreadCount > 0 && !markAllMutation.isPending) {
      markAllMutation.mutate();
    }
  };

  if (isAuthLoading) {
    return (
      <div className="max-w-[760px] mx-auto w-full px-4 py-8 space-y-6">
        <div className="h-10 w-48 rounded-xl bg-muted/50 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto w-full px-4 py-16 text-center space-y-5">
        <div className="rounded-3xl border border-border bg-card p-8 space-y-4 shadow-xs">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Bell className="size-6" />
          </div>
          <h1 className="text-xl font-bold font-heading text-foreground">
            Vui lòng đăng nhập để xem thông báo
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Đăng nhập để nhận thông báo tức thì khi có người thích, bình luận hoặc phản hồi bài viết cộng đồng của bạn.
          </p>
          <div className="pt-2">
            <Link href="/login?next=/notifications">
              <Button className="rounded-xl font-semibold gap-2 px-6 h-10 text-xs cursor-pointer">
                <LogIn className="size-4" />
                <span>Đăng nhập ngay</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const badgeText =
    unreadCount > NOTIFICATION_CONFIG.BADGE_CEILING
      ? `${NOTIFICATION_CONFIG.BADGE_CEILING}+`
      : unreadCount > 0
      ? String(unreadCount)
      : null;

  return (
    <div className="max-w-[760px] mx-auto w-full px-4 py-6 sm:py-8 space-y-5 pb-20">
      {/* Filter Tabs & Quick Action */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer min-h-[38px] ${
              filter === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setFilter("UNREAD")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer min-h-[38px] ${
              filter === "UNREAD"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Chưa đọc {badgeText && `(${badgeText})`}
          </button>
        </div>

        <button
          type="button"
          onClick={handleMarkAll}
          disabled={unreadCount === 0 || markAllMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <CheckCheck className="size-4" />
          <span className="hidden sm:inline">Đánh dấu tất cả đã đọc</span>
          <span className="sm:hidden">Đã đọc tất cả</span>
        </button>
      </div>

      {/* Notification Stream with Date Grouping */}
      <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-5 shadow-xs">
        <NotificationList
          items={items}
          filter={filter}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
          showDateGroups={true}
        />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[760px] mx-auto w-full px-4 py-8 space-y-6">
          <div className="h-10 w-48 rounded-xl bg-muted/50 animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <NotificationsPageContent />
    </Suspense>
  );
}

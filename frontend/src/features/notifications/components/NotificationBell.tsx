"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { NotificationFilter } from "@/types/notification";
import { NOTIFICATION_CONFIG } from "../config/notification.config";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
} from "../hooks/use-notifications";
import { NotificationList } from "./NotificationList";

export function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.count ?? 0;

  const {
    data: listData,
    isLoading,
    isError,
    refetch,
  } = useNotifications(filter, NOTIFICATION_CONFIG.DROPDOWN_LIMIT);

  const markAllMutation = useMarkAllNotificationsRead();

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  const items = listData?.pages.flatMap((page) => page.items) ?? [];

  const handleMarkAll = () => {
    if (unreadCount > 0 && !markAllMutation.isPending) {
      markAllMutation.mutate();
    }
  };

  const badgeText =
    unreadCount > NOTIFICATION_CONFIG.BADGE_CEILING
      ? `${NOTIFICATION_CONFIG.BADGE_CEILING}+`
      : unreadCount > 0
      ? String(unreadCount)
      : null;

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `Thông báo (${unreadCount} chưa đọc)`
            : "Thông báo"
        }
        className="relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full text-foreground/80 hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Bell className="size-5" />
        {badgeText && (
          <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-xs">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Bảng thông báo"
          className="absolute right-0 top-full mt-2 w-[360px] sm:w-[380px] max-w-[calc(100vw-24px)] bg-background border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <h2 className="text-base font-bold text-foreground">Thông báo</h2>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unreadCount === 0 || markAllMutation.isPending}
              title="Đánh dấu tất cả đã đọc"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <CheckCheck className="size-3.5" />
              <span>Đã đọc tất cả</span>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 px-4 pt-2 pb-1 border-b border-border/40">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filter === "UNREAD"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Chưa đọc {unreadCount > 0 && `(${badgeText})`}
            </button>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto px-2 py-2">
            <NotificationList
              items={items}
              filter={filter}
              isLoading={isLoading}
              isError={isError}
              onRetry={refetch}
              onItemClick={() => setIsOpen(false)}
            />
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-border/60 bg-muted/20 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-block w-full py-1.5 text-xs font-bold text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg transition-colors"
            >
              Xem tất cả thông báo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

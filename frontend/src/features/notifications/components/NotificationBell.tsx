"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { NotificationFilter, NotificationItem } from "@/types/notification";
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

  // Close on outside click or escape
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

  const items = useMemo(() => {
    if (!listData?.pages) return [];
    const map = new Map<string, NotificationItem>();
    for (const page of listData.pages) {
      for (const item of page.items) {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      }
    }
    return Array.from(map.values());
  }, [listData]);

  const handleMarkAll = () => {
    if (unreadCount > 0 && !markAllMutation.isPending) {
      setFilter("ALL");
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
        <i
          className={`${unreadCount > 0 ? "fa-solid" : "fa-regular"} fa-bell text-[18px]`}
          aria-hidden="true"
        />
        {badgeText && (
          <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-xs">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop for dismiss & focus */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-xs sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label="Bảng thông báo"
            className="fixed left-3 right-3 top-16 max-w-md mx-auto sm:max-w-none sm:mx-0 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] bg-background border border-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[min(520px,calc(100dvh-80px))] sm:max-h-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                  Thông báo
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-primary bg-primary/10 rounded-full shrink-0">
                    {badgeText} mới
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={unreadCount === 0 || markAllMutation.isPending}
                  title="Đánh dấu tất cả đã đọc"
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-primary hover:text-primary/80 hover:bg-primary/5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-check-double text-[11px]" aria-hidden="true" />
                  <span>Đã đọc tất cả</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden cursor-pointer"
                  aria-label="Đóng thông báo"
                >
                  <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 pt-2 pb-1.5 border-b border-border/40 shrink-0">
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
            <div className="flex-1 max-h-[calc(100dvh-220px)] sm:max-h-[380px] overflow-y-auto px-1.5 sm:px-2 py-1.5 custom-scroll">
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
            <div className="p-2 sm:p-2.5 border-t border-border/60 bg-muted/20 text-center shrink-0">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="inline-block w-full py-1.5 text-xs font-bold text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg transition-colors"
              >
                Xem tất cả thông báo
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

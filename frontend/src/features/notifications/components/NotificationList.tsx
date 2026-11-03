"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Reply, AlertCircle, Loader2, UserPlus, Check, X } from "lucide-react";
import type { NotificationFilter, NotificationItem } from "@/types/notification";
import { formatRelativeTime } from "@/services/community.service";
import { NOTIFICATION_CONFIG } from "../config/notification.config";
import { useMarkNotificationRead } from "../hooks/use-notifications";

interface NotificationListProps {
  items: NotificationItem[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  filter: NotificationFilter;
  onItemClick?: (item: NotificationItem) => void;
  showDateGroups?: boolean;
}

function getDateGroupLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) return "Hôm nay";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Hôm qua";

  return "Trước đó";
}

function NotificationRow({
  item,
  onClick,
}: {
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
}) {
  const isUnread = !item.readAt;
  const actorName = item.actor?.fullName || NOTIFICATION_CONFIG.ACTOR_FALLBACK_NAME;
  const postTitle = item.post?.title || "bài viết";
  const tripTitle = item.itinerary?.title || "chuyến đi";
  const targetUrl = item.post?.id
    ? `/community?postId=${item.post.id}${item.commentId ? `&commentId=${item.commentId}` : ""}`
    : item.invitationId
      ? `/trip-invitations/${item.invitationId}`
      : item.itinerary?.id
        ? `/itineraries/${item.itinerary.id}`
        : "/notifications";

  const renderContent = () => {
    switch (item.type) {
      case "POST_LIKED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            đã thích bài viết:{" "}
            <span className="font-medium text-foreground line-clamp-1 italic">
              "{postTitle}"
            </span>
          </>
        );
      case "POST_COMMENTED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            đã bình luận về bài viết:{" "}
            <span className="font-medium text-foreground line-clamp-1 italic">
              "{postTitle}"
            </span>
          </>
        );
      case "COMMENT_REPLIED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            đã trả lời bình luận của bạn trong:{" "}
            <span className="font-medium text-foreground line-clamp-1 italic">
              "{postTitle}"
            </span>
          </>
        );
      case "TRIP_INVITED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            đã mời bạn cùng tham gia chuyến đi:{" "}
            <span className="font-medium text-foreground line-clamp-1 italic">
              "{tripTitle}"
            </span>
          </>
        );
      case "TRIP_INVITATION_ACCEPTED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            đã đồng ý tham gia chuyến đi:{" "}
            <span className="font-medium text-foreground line-clamp-1 italic">
              "{tripTitle}"
            </span>
          </>
        );
      case "TRIP_INVITATION_DECLINED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            đã từ chối lời mời tham gia chuyến đi:{" "}
            <span className="font-medium text-foreground line-clamp-1 italic">
              "{tripTitle}"
            </span>
          </>
        );
      default:
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            đã tương tác với bạn
          </>
        );
    }
  };

  const renderBadgeIcon = () => {
    switch (item.type) {
      case "POST_LIKED":
        return (
          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs">
            <Heart className="size-3 fill-white" />
          </div>
        );
      case "POST_COMMENTED":
        return (
          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
            <MessageSquare className="size-3 fill-current" />
          </div>
        );
      case "COMMENT_REPLIED":
        return (
          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
            <Reply className="size-3" />
          </div>
        );
      case "TRIP_INVITED":
        return (
          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
            <UserPlus className="size-3" />
          </div>
        );
      case "TRIP_INVITATION_ACCEPTED":
        return (
          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Check className="size-3 stroke-[3]" />
          </div>
        );
      case "TRIP_INVITATION_DECLINED":
        return (
          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-muted-foreground text-background flex items-center justify-center shadow-xs">
            <X className="size-3 stroke-[2.5]" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Link
      href={targetUrl}
      onClick={() => onClick(item)}
      className={`group flex items-start gap-3 p-3.5 transition-colors rounded-xl ${
        isUnread
          ? "bg-primary/5 hover:bg-primary/10"
          : "hover:bg-muted/60"
      }`}
    >
      <div className="relative shrink-0">
        {item.actor?.avatarUrl ? (
          <img
            src={item.actor.avatarUrl}
            alt={actorName}
            className="size-11 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="size-11 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center ring-1 ring-border text-sm">
            {actorName.charAt(0).toUpperCase()}
          </div>
        )}
        {renderBadgeIcon()}
      </div>

      <div className="flex-1 min-w-0 pr-1 text-sm leading-snug">
        <p className="text-foreground/90">{renderContent()}</p>
        <span className="text-xs text-muted-foreground mt-1 inline-block">
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>

      {isUnread && (
        <span
          className="size-2.5 rounded-full bg-primary shrink-0 mt-2"
          aria-label="Chưa đọc"
        />
      )}
    </Link>
  );
}

export function NotificationList({
  items,
  isLoading,
  isError,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  filter,
  onItemClick,
  showDateGroups = false,
}: NotificationListProps) {
  const markReadMutation = useMarkNotificationRead();

  const handleRowClick = (item: NotificationItem) => {
    if (!item.readAt) {
      markReadMutation.mutate(item.id);
    }
    onItemClick?.(item);
  };

  // Group items by date if showDateGroups is true
  const groupedItems = useMemo(() => {
    if (!showDateGroups) return null;
    const groups: { label: string; list: NotificationItem[] }[] = [];
    let currentLabel = "";
    let currentList: NotificationItem[] = [];

    for (const item of items) {
      const label = getDateGroupLabel(item.createdAt);
      if (label !== currentLabel) {
        if (currentList.length > 0) {
          groups.push({ label: currentLabel, list: currentList });
        }
        currentLabel = label;
        currentList = [item];
      } else {
        currentList.push(item);
      }
    }
    if (currentList.length > 0) {
      groups.push({ label: currentLabel, list: currentList });
    }
    return groups;
  }, [items, showDateGroups]);

  if (isLoading && items.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="size-11 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded-md w-3/4" />
              <div className="h-3 bg-muted rounded-md w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError && items.length === 0) {
    return (
      <div className="p-6 text-center space-y-3">
        <AlertCircle className="size-8 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">
          Không thể tải danh sách thông báo
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            Thử lại
          </button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm font-medium">
          {filter === "UNREAD"
            ? "Bạn đã đọc hết thông báo"
            : "Bạn chưa có thông báo nào"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showDateGroups && groupedItems ? (
        groupedItems.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="px-3.5 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {group.label}
            </div>
            {group.list.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onClick={handleRowClick}
              />
            ))}
          </div>
        ))
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onClick={handleRowClick}
            />
          ))}
        </div>
      )}

      {hasNextPage && onLoadMore && (
        <div className="pt-2 pb-1 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Đang tải thêm...
              </>
            ) : (
              "Tải thêm thông báo"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

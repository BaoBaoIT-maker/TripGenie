"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { NotificationFilter, NotificationItem } from "@/types/notification";
import { formatRelativeTime, useI18n } from "@/i18n";
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

const GLYPH_BADGE_BASE =
  "absolute -bottom-0.5 -right-0.5 z-10 text-[13px] sm:text-[15px] bg-background rounded-full ring-2 ring-background leading-none";

const ACTION_BADGE_BASE =
  "absolute -bottom-0.5 -right-0.5 z-10 size-3.5 sm:size-4 rounded-full flex items-center justify-center ring-2 ring-background shadow-2xs";

type DateGroupKey = "today" | "yesterday" | "earlier";

function getDateGroupKey(isoDate: string): DateGroupKey {
  const d = new Date(isoDate);
  const now = new Date();

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) return "today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "yesterday";

  return "earlier";
}

function NotificationRow({
  item,
  onClick,
}: {
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
}) {
  const { locale, t } = useI18n();
  const isUnread = !item.readAt;
  const isModerationType =
    item.type === "POST_APPROVED" ||
    item.type === "POST_FLAGGED" ||
    item.type === "POST_REJECTED";
  const actorName =
    item.actor?.fullName ||
    (isModerationType
      ? t("notifications.fallbacks.system")
      : t("notifications.fallbacks.actor"));
  const postTitle = item.post?.title || t("notifications.fallbacks.post");
  const tripTitle = item.itinerary?.title || t("notifications.fallbacks.trip");
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
            {t("notifications.actions.postLiked")}{" "}
            <span className="font-medium text-foreground italic">
              &ldquo;{postTitle}&rdquo;
            </span>
          </>
        );
      case "POST_COMMENTED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            {t("notifications.actions.postCommented")}{" "}
            <span className="font-medium text-foreground italic">
              &ldquo;{postTitle}&rdquo;
            </span>
          </>
        );
      case "COMMENT_REPLIED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            {t("notifications.actions.commentReplied")}{" "}
            <span className="font-medium text-foreground italic">
              &ldquo;{postTitle}&rdquo;
            </span>
          </>
        );
      case "TRIP_INVITED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            {t("notifications.actions.tripInvited")}{" "}
            <span className="font-medium text-foreground italic">
              &ldquo;{tripTitle}&rdquo;
            </span>
          </>
        );
      case "TRIP_INVITATION_ACCEPTED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            {t("notifications.actions.tripAccepted")}{" "}
            <span className="font-medium text-foreground italic">
              &ldquo;{tripTitle}&rdquo;
            </span>
          </>
        );
      case "TRIP_INVITATION_DECLINED":
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            {t("notifications.actions.tripDeclined")}{" "}
            <span className="font-medium text-foreground italic">
              &ldquo;{tripTitle}&rdquo;
            </span>
          </>
        );
      case "POST_APPROVED":
        return (
          <>
            {t("notifications.actions.postPrefix")}{" "}
            <span className="font-medium text-foreground italic">
              &ldquo;{postTitle}&rdquo;
            </span>{" "}
            {t("notifications.actions.postApprovedSuffix")}
          </>
        );
      case "POST_FLAGGED":
        return (
          <>
            {t("notifications.actions.postPrefix")}{" "}
            <span className="font-medium text-foreground italic">
              &ldquo;{postTitle}&rdquo;
            </span>{" "}
            {t("notifications.actions.postFlaggedSuffix")}
            {item.post?.moderationNote ? `: "${item.post.moderationNote}"` : "."}
          </>
        );
      case "POST_REJECTED":
        return (
          <>
            {t("notifications.actions.postPrefix")}{" "}
            <span className="font-medium text-foreground italic">
              &ldquo;{postTitle}&rdquo;
            </span>{" "}
            {t("notifications.actions.postRejectedSuffix")}
            {item.post?.moderationNote ? `: "${item.post.moderationNote}"` : "."}
          </>
        );
      default:
        return (
          <>
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            {t("notifications.actions.defaultInteraction")}
          </>
        );
    }
  };

  const renderBadgeIcon = () => {
    switch (item.type) {
      case "POST_APPROVED":
      case "TRIP_INVITATION_ACCEPTED":
        return (
          <i
            className={cn(GLYPH_BADGE_BASE, "fa-solid fa-circle-check text-emerald-500 dark:text-emerald-400")}
            aria-hidden="true"
          />
        );
      case "POST_REJECTED":
        return (
          <i
            className={cn(GLYPH_BADGE_BASE, "fa-solid fa-circle-xmark text-rose-500 dark:text-rose-400")}
            aria-hidden="true"
          />
        );
      case "POST_FLAGGED":
        return (
          <i
            className={cn(GLYPH_BADGE_BASE, "fa-solid fa-circle-exclamation text-amber-500 dark:text-amber-400")}
            aria-hidden="true"
          />
        );
      case "TRIP_INVITATION_DECLINED":
        return (
          <i
            className={cn(GLYPH_BADGE_BASE, "fa-solid fa-circle-xmark text-muted-foreground")}
            aria-hidden="true"
          />
        );
      case "POST_LIKED":
        return (
          <span className={cn(ACTION_BADGE_BASE, "bg-rose-500 text-white")}>
            <i className="fa-solid fa-heart text-[7px] sm:text-[8px]" aria-hidden="true" />
          </span>
        );
      case "POST_COMMENTED":
        return (
          <span className={cn(ACTION_BADGE_BASE, "bg-sky-500 text-white")}>
            <i className="fa-solid fa-comment text-[7px] sm:text-[8px]" aria-hidden="true" />
          </span>
        );
      case "COMMENT_REPLIED":
        return (
          <span className={cn(ACTION_BADGE_BASE, "bg-[#0068B8] text-white")}>
            <i className="fa-solid fa-reply text-[6.5px] sm:text-[7.5px]" aria-hidden="true" />
          </span>
        );
      case "TRIP_INVITED":
        return (
          <span className={cn(ACTION_BADGE_BASE, "bg-primary text-primary-foreground")}>
            <i className="fa-solid fa-user-plus text-[6.5px] sm:text-[7.5px]" aria-hidden="true" />
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Link
      href={targetUrl}
      onClick={() => onClick(item)}
      className={`group flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3.5 transition-colors rounded-xl ${
        isUnread
          ? "bg-sky-100/75 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/60"
          : "hover:bg-muted/60"
      }`}
    >
      <div className="relative shrink-0">
        <Avatar className="size-9.5 sm:size-11 ring-1 ring-border">
          <AvatarImage
            src={item.actor?.avatarUrl || undefined}
            alt={actorName}
            className="object-cover"
          />
          <AvatarFallback
            className={cn(
              "font-bold text-xs sm:text-sm",
              isModerationType && !item.actor
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary"
            )}
          >
            {isModerationType && !item.actor
              ? "TG"
              : actorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {renderBadgeIcon()}
      </div>

      <div className="flex-1 min-w-0 pr-1 text-xs sm:text-sm leading-snug">
        <p className="text-foreground/90 line-clamp-2 sm:line-clamp-3 break-words">
          {renderContent()}
        </p>
        <span className="text-[11px] sm:text-xs text-muted-foreground mt-1 inline-block">
          {formatRelativeTime(item.createdAt, locale)}
        </span>
      </div>

      {isUnread && (
        <span
          className="size-2 sm:size-2.5 rounded-full bg-[#0194F3] shrink-0 mt-1.5 shadow-xs"
          aria-label={t("notifications.unreadDotAria")}
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
  const { t } = useI18n();
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
    const groups: { key: DateGroupKey; label: string; list: NotificationItem[] }[] = [];
    let currentKey: DateGroupKey | null = null;
    let currentList: NotificationItem[] = [];

    const getGroupTitle = (key: DateGroupKey) => {
      if (key === "today") return t("notifications.dateGroups.today");
      if (key === "yesterday") return t("notifications.dateGroups.yesterday");
      return t("notifications.dateGroups.earlier");
    };

    for (const item of items) {
      const key = getDateGroupKey(item.createdAt);
      if (key !== currentKey) {
        if (currentList.length > 0 && currentKey) {
          groups.push({ key: currentKey, label: getGroupTitle(currentKey), list: currentList });
        }
        currentKey = key;
        currentList = [item];
      } else {
        currentList.push(item);
      }
    }
    if (currentList.length > 0 && currentKey) {
      groups.push({ key: currentKey, label: getGroupTitle(currentKey), list: currentList });
    }
    return groups;
  }, [items, showDateGroups, t]);

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
        <i
          className="fa-solid fa-circle-exclamation text-3xl text-destructive mx-auto block"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">
          {t("notifications.loadError")}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            {t("common.retry")}
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
            ? t("notifications.emptyUnread")
            : t("notifications.emptyAll")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showDateGroups && groupedItems ? (
        groupedItems.map((group) => (
          <div key={group.key} className="space-y-1">
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
                <i className="fa-solid fa-spinner animate-spin text-xs" aria-hidden="true" />
                {t("notifications.loadingMore")}
              </>
            ) : (
              t("notifications.loadMore")
            )}
          </button>
        </div>
      )}
    </div>
  );
}

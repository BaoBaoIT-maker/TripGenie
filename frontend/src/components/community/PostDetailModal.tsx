"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  X,
  Heart,
  MessageCircle,
  Share2,
  Send,
  Trash2,
  CornerDownRight,
  MapPin,
  CalendarDays,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { CommunityPostItem, CommunityCommentItem } from "@/types/community";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  usePostComments,
  useCommentContext,
  useCreatePostComment,
  useDeletePostComment,
  useTogglePostLike,
} from "@/features/community/hooks/use-community";
import {
  COMMUNITY_UI_CONSTANTS,
  formatRelativeTime,
  isVideoUrl,
} from "@/services/community.service";

interface PostDetailModalProps {
  open: boolean;
  onClose: () => void;
  post: CommunityPostItem;
  onSelectTag?: (tag: string) => void;
  highlightCommentId?: string;
}

interface ReplyTargetState {
  parentId: string;
  replyToName: string;
}

export function PostDetailModal({
  open,
  onClose,
  post,
  onSelectTag,
  highlightCommentId,
}: PostDetailModalProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasScrolledRef = useRef(false);

  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTargetState | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST">("NEWEST");

  const toggleLikeMutation = useTogglePostLike();
  const { data: comments = [], isLoading: isLoadingComments } = usePostComments(
    post.id,
    open
  );

  // Deep-link context fetch when comment might not be in first comments batch
  const { data: contextData, isError: isContextError } = useCommentContext(
    post.id,
    highlightCommentId || null,
    open && Boolean(highlightCommentId)
  );

  useEffect(() => {
    if (isContextError) {
      toast.info("Bình luận không còn tồn tại hoặc đã bị xóa");
    }
  }, [isContextError]);

  const createCommentMutation = useCreatePostComment();
  const deleteCommentMutation = useDeletePostComment();

  const mediaList =
    post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : post.itinerary?.coverPhoto
      ? [post.itinerary.coverPhoto]
      : [];

  const profileIdentifier = post.author.username || post.author.id;
  const profileHref = `/community/profile/${encodeURIComponent(profileIdentifier)}`;
  const destinationLabel =
    post.itinerary?.areaName || post.itinerary?.destination || null;

  // WCAG 2.2 AA & UX: Handle Escape key & lock background scroll
  useEffect(() => {
    if (!open) {
      hasScrolledRef.current = false;
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deletingCommentId) {
          setDeletingCommentId(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, deletingCommentId]);

  // Merge regular comments with comment context if deep-linked comment is outside first page
  const allComments = useMemo(() => {
    const map = new Map<string, CommunityCommentItem>();
    for (const c of comments) {
      map.set(c.id, c);
    }
    if (contextData?.parent) {
      map.set(contextData.parent.id, contextData.parent);
    }
    if (contextData?.comment) {
      map.set(contextData.comment.id, contextData.comment);
    }
    return Array.from(map.values());
  }, [comments, contextData]);

  // Group comments into 1-level threads (Facebook style)
  const threadedComments = useMemo(() => {
    const roots: CommunityCommentItem[] = [];
    const repliesByRootId = new Map<string, CommunityCommentItem[]>();
    const rootIds = new Set<string>();

    for (const cmt of allComments) {
      if (!cmt.parentId) {
        roots.push(cmt);
        rootIds.add(cmt.id);
      }
    }

    for (const cmt of allComments) {
      if (cmt.parentId) {
        if (rootIds.has(cmt.parentId)) {
          const list = repliesByRootId.get(cmt.parentId) ?? [];
          list.push(cmt);
          repliesByRootId.set(cmt.parentId, list);
        } else {
          roots.push(cmt);
        }
      }
    }

    if (sortOrder === "OLDEST") {
      roots.reverse();
    }

    return roots.map((root) => ({
      root,
      replies: repliesByRootId.get(root.id) ?? [],
    }));
  }, [allComments, sortOrder]);

  // Smooth scroll and focus on highlighted comment once rendered
  useEffect(() => {
    if (!highlightCommentId || !open || hasScrolledRef.current) return;

    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (el) {
      hasScrolledRef.current = true;
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    }
  }, [highlightCommentId, open, threadedComments]);

  if (!open) return null;

  const handleToggleLike = () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thả tim bài viết");
      return;
    }
    toggleLikeMutation.mutate(post.id);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/community/profile/${encodeURIComponent(
      profileIdentifier
    )}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.caption || post.title,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Đã sao chép liên kết chia sẻ vào bộ nhớ tạm!");
    } catch {
      toast.info("Liên kết: " + shareUrl);
    }
  };

  const handleSelectReply = (targetCommentId: string, targetAuthorName: string) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để trả lời bình luận");
      return;
    }
    setReplyTarget({
      parentId: targetCommentId,
      replyToName: targetAuthorName,
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    const activeReply = replyTarget;
    setCommentText("");
    setReplyTarget(null);

    createCommentMutation.mutate({
      postId: post.id,
      content: trimmed,
      parentId: activeReply?.parentId,
      replyToName: activeReply?.replyToName,
    });
  };

  const renderCommentCard = (
    cmt: CommunityCommentItem,
    isReply: boolean
  ) => {
    const canDelete =
      Boolean(user) &&
      !cmt.isOptimistic &&
      (user?.id === cmt.userId ||
        user?.id === post.userId ||
        user?.role === "ADMIN");

    const isHighlighted = highlightCommentId === cmt.id;

    const cmtProfileHref = `/community/profile/${encodeURIComponent(
      cmt.author.username || cmt.author.id
    )}`;

    return (
      <div
        key={cmt.id}
        id={`comment-${cmt.id}`}
        className={`flex items-start gap-3 p-3 rounded-2xl border transition-all duration-300 ${
          isHighlighted
            ? "ring-2 ring-primary/80 bg-primary/10 border-primary/50 shadow-md"
            : isReply
            ? "bg-muted/30 border-border/40"
            : "bg-muted/50 border-border/60 hover:border-border"
        }`}
      >
        <Link href={cmtProfileHref} className="shrink-0 pt-0.5">
          <Avatar
            className={`${isReply ? "size-7" : "size-8 sm:size-9"} border border-border`}
          >
            <AvatarImage
              src={cmt.author.avatarUrl || undefined}
              alt={cmt.author.fullName}
            />
            <AvatarFallback className="text-xs font-bold bg-secondary text-secondary-foreground">
              {cmt.author.fullName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <Link
                href={cmtProfileHref}
                className="text-xs sm:text-sm font-bold text-foreground hover:text-primary transition-colors truncate"
              >
                {cmt.author.fullName}
              </Link>
              {cmt.userId === post.userId && (
                <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-semibold">
                  Tác giả
                </span>
              )}
              {isReply && cmt.replyToName && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CornerDownRight className="size-3 text-primary shrink-0" />
                  <span>trả lời</span>
                  <span className="font-semibold text-primary">
                    @{cmt.replyToName}
                  </span>
                </span>
              )}
              <span className="text-[11px] text-muted-foreground shrink-0">
                •{" "}
                {cmt.isOptimistic
                  ? "Đang gửi..."
                  : formatRelativeTime(cmt.createdAt)}
              </span>
            </div>

            {canDelete && (
              <button
                type="button"
                onClick={() => setDeletingCommentId(cmt.id)}
                disabled={deleteCommentMutation.isPending}
                aria-label="Xóa bình luận"
                title="Xóa bình luận"
                className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          <p className="text-xs sm:text-sm text-foreground leading-relaxed break-words whitespace-pre-line">
            {cmt.content}
          </p>

          {!cmt.isOptimistic && (
            <div className="pt-0.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  handleSelectReply(cmt.id, cmt.author.fullName)
                }
                className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                Trả lời
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl lg:max-w-3xl rounded-2xl border border-border bg-card text-foreground shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative flex items-center justify-center px-6 py-4 border-b border-border shrink-0">
          <h2
            id="post-detail-modal-title"
            className="text-base sm:text-lg font-bold font-heading text-foreground text-center truncate max-w-[70%]"
          >
            Bài viết của {post.author.fullName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 size-9 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Đóng xem chi tiết bài viết"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Body: Post Content + Full Comments Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Post Author Info */}
          <div className="flex items-center justify-between gap-3">
            <Link
              href={profileHref}
              className="flex items-center gap-3 group min-w-0"
            >
              <Avatar className="size-11 border border-border group-hover:border-primary transition-colors shrink-0">
                <AvatarImage
                  src={post.author.avatarUrl || undefined}
                  alt={post.author.fullName}
                />
                <AvatarFallback className="text-xs font-bold bg-secondary text-secondary-foreground">
                  {post.author.fullName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                    {post.author.fullName}
                  </h3>
                  {post.author.isVerified && (
                    <CheckCircle2
                      className="size-3.5 text-primary shrink-0"
                      aria-label="Tài khoản xác thực"
                    />
                  )}
                  {post.author.username && (
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                      @{post.author.username}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {formatRelativeTime(post.createdAt)}
                  {destinationLabel && (
                    <>
                      {" "}
                      • <span className="text-primary font-medium">{destinationLabel}</span>
                    </>
                  )}
                </p>
              </div>
            </Link>

            {destinationLabel && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary-foreground bg-secondary px-2.5 py-1 rounded-full shrink-0">
                <MapPin className="size-3 text-primary" />
                <span>{destinationLabel}</span>
              </span>
            )}
          </div>

          {/* Post Title & Caption */}
          <div className="space-y-2">
            <h4 className="text-base sm:text-xl font-bold text-foreground leading-snug">
              {post.title}
            </h4>
            {post.caption && (
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                {post.caption}
              </p>
            )}
          </div>

          {/* Hashtags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {post.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    onSelectTag?.(tag);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/60 hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors cursor-pointer"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Multimedia Collage Showcase */}
          {mediaList.length > 0 && (
            <div className="w-full">
              {mediaList.length === 1 && (
                <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-video">
                  {isVideoUrl(mediaList[0]) ? (
                    <video
                      src={mediaList[0]}
                      controls
                      playsInline
                      muted
                      loop
                      preload="metadata"
                      className="w-full h-full object-cover bg-black"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaList[0]}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}

              {mediaList.length === 2 && (
                <div className="grid grid-cols-2 gap-1.5 w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-[4/3] sm:aspect-[16/9]">
                  {mediaList.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative h-full w-full overflow-hidden bg-black/5"
                    >
                      {isVideoUrl(url) ? (
                        <video
                          src={url}
                          controls
                          className="w-full h-full object-cover bg-black"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={`${post.title} - ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mediaList.length >= 3 && (
                <div className="grid grid-cols-2 gap-1.5 w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-[4/3] sm:aspect-[16/10] max-h-[460px]">
                  <div className="relative h-full w-full overflow-hidden bg-black/5">
                    {isVideoUrl(mediaList[0]) ? (
                      <video
                        src={mediaList[0]}
                        controls
                        className="w-full h-full object-cover bg-black"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaList[0]}
                        alt={`${post.title} - 1`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="grid grid-rows-2 gap-1.5 h-full w-full">
                    <div className="relative h-full w-full overflow-hidden bg-black/5">
                      {isVideoUrl(mediaList[1]) ? (
                        <video
                          src={mediaList[1]}
                          controls
                          className="w-full h-full object-cover bg-black"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaList[1]}
                          alt={`${post.title} - 2`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="relative h-full w-full overflow-hidden bg-black/5">
                      {isVideoUrl(mediaList[2]) ? (
                        <video
                          src={mediaList[2]}
                          controls
                          className="w-full h-full object-cover bg-black"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaList[2]}
                          alt={`${post.title} - 3`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {mediaList.length > 3 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-wider drop-shadow-md">
                            +{mediaList.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Linked Itinerary Card */}
          {post.itinerary && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/25 bg-secondary/40 p-3.5">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <CalendarDays className="size-3.5" />
                  <span>Lịch trình đính kèm</span>
                  {post.itinerary.totalPlaces > 0 && (
                    <span>• {post.itinerary.totalPlaces} địa điểm</span>
                  )}
                </div>
                <h5 className="text-sm font-bold text-foreground truncate">
                  {post.itinerary.title}
                </h5>
              </div>
              <Link
                href={`/planner/${post.itinerary.id}`}
                className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
              >
                Xem chi tiết lịch trình
              </Link>
            </div>
          )}

          {/* Post Actions & Stats Bar */}
          <div className="flex items-center justify-between py-2 border-y border-border/80 text-muted-foreground text-xs sm:text-sm font-semibold">
            <button
              type="button"
              onClick={handleToggleLike}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted transition-colors cursor-pointer ${
                post.isLiked ? "text-rose-500" : "text-muted-foreground"
              }`}
            >
              <Heart
                className={`size-4 sm:size-5 ${
                  post.isLiked ? "fill-rose-500 text-rose-500" : ""
                }`}
              />
              <span>{post.likeCount}</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground">
              <MessageCircle className="size-4 sm:size-5" />
              <span>{allComments.length} bình luận</span>
            </div>

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted transition-colors cursor-pointer"
            >
              <Share2 className="size-4 sm:size-5" />
              <span>Chia sẻ</span>
            </button>
          </div>

          {/* Comments Section Header with Filter */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-foreground">
              Bình luận ({allComments.length})
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setSortOrder("NEWEST")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  sortOrder === "NEWEST"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Phù hợp nhất
              </button>
              <button
                type="button"
                onClick={() => setSortOrder("OLDEST")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  sortOrder === "OLDEST"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tất cả bình luận
              </button>
            </div>
          </div>

          {/* Comments List */}
          {isLoadingComments ? (
            <div className="space-y-3 py-3">
              <div className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
              <div className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
            </div>
          ) : threadedComments.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <MessageCircle className="size-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Chưa có bình luận nào
              </p>
              <p className="text-xs text-muted-foreground">
                Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ trải nghiệm về chuyến đi này!
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {threadedComments.map(({ root, replies }) => (
                <div key={root.id} className="space-y-2">
                  {renderCommentCard(root, false)}

                  {replies.length > 0 && (
                    <div className="ml-8 sm:ml-10 pl-3 border-l-2 border-border/80 space-y-2">
                      {replies.map((reply) =>
                        renderCommentCard(reply, true)
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Bottom Comment Composer */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-card shrink-0 space-y-2">
          {replyTarget && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-xl bg-secondary/60 border border-primary/25 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <CornerDownRight className="size-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground">Đang trả lời</span>
                <span className="font-bold text-primary truncate">
                  @{replyTarget.replyToName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                aria-label="Hủy trả lời"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              >
                <X className="size-3" />
                <span>Hủy</span>
              </button>
            </div>
          )}

          {user ? (
            <form
              onSubmit={handleSubmitComment}
              className="flex items-center gap-3"
            >
              <Avatar className="size-9 sm:size-10 border border-border shrink-0">
                <AvatarImage
                  src={user.avatarUrl || undefined}
                  alt={user.fullName || "User"}
                />
                <AvatarFallback className="text-xs font-bold bg-secondary text-secondary-foreground">
                  {user.fullName ? user.fullName.slice(0, 2).toUpperCase() : "TG"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    replyTarget
                      ? `Viết câu trả lời cho @${replyTarget.replyToName}...`
                      : "Viết bình luận công khai..."
                  }
                  maxLength={COMMUNITY_UI_CONSTANTS.MAX_COMMENT_LENGTH}
                  aria-label="Viết bình luận công khai"
                  className="w-full h-11 pl-4 pr-11 rounded-full border border-border bg-muted/40 hover:bg-muted/60 focus:bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || createCommentMutation.isPending}
                  className="absolute right-1.5 size-8 rounded-full bg-primary text-primary-foreground disabled:opacity-40 disabled:hover:bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Gửi bình luận"
                >
                  {createCommentMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
              <span>Đăng nhập để bình luận và trao đổi cùng mọi người.</span>
              <Link
                href="/login"
                className="font-semibold text-primary hover:underline shrink-0 ml-2"
              >
                Đăng nhập
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete Comment Modal */}
      {deletingCommentId !== null && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-comment-title"
          aria-describedby="confirm-delete-comment-desc"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => {
            if (!deleteCommentMutation.isPending) {
              setDeletingCommentId(null);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <Trash2 className="size-5" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h4
                  id="confirm-delete-comment-title"
                  className="text-base font-bold text-foreground"
                >
                  Xác nhận xóa bình luận?
                </h4>
                <p
                  id="confirm-delete-comment-desc"
                  className="text-xs sm:text-sm text-muted-foreground leading-relaxed"
                >
                  Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={deleteCommentMutation.isPending}
                onClick={() => setDeletingCommentId(null)}
                className="h-9 px-4 rounded-xl text-xs font-medium cursor-pointer"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteCommentMutation.isPending}
                onClick={async () => {
                  if (!deletingCommentId) return;
                  try {
                    await deleteCommentMutation.mutateAsync({
                      commentId: deletingCommentId,
                      postId: post.id,
                    });
                    setDeletingCommentId(null);
                  } catch {
                    // Handled by react-query onError
                  }
                }}
                className="h-9 px-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
              >
                {deleteCommentMutation.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                <span>Xóa bình luận</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

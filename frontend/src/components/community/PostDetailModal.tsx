"use client";

import { useState, useEffect, useRef, useMemo, memo } from "react";
import Link from "next/link";
import {
  X,
  Trash2,
  CornerDownRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  CommunityPostItem,
  CommunityCommentItem,
} from "@/types/community";
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
import { formatVnd } from "@/features/planner/model/itinerary-format";
import {
  COMMUNITY_UI_CONSTANTS,
  formatRelativeTime,
  formatTripDuration,
  getVideoThumbnailSrc,
  isVideoUrl,
  resolvePostAuthorSubtitle,
} from "@/services/community.service";
import { CommunityModalPortal } from "./CommunityModalPortal";
import { MediaGridTileContent } from "./PostCard";

interface PostDetailModalProps {
  open: boolean;
  onClose: () => void;
  post: CommunityPostItem;
  onSelectTag?: (tag: string) => void;
  onOpenClonePreview?: (post: CommunityPostItem) => void;
  highlightCommentId?: string;
}

interface ReplyTargetState {
  parentId: string;
  replyToName: string;
}

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face";

interface CommentBubbleProps {
  cmt: CommunityCommentItem;
  isReply: boolean;
  postOwnerId: string;
  currentUserId?: string;
  currentUserRole?: string;
  isHighlighted: boolean;
  isDeleting: boolean;
  onSelectReply: (commentId: string, authorName: string) => void;
  onRequestDelete: (commentId: string) => void;
}

const CommentBubble = memo(function CommentBubble({
  cmt,
  isReply,
  postOwnerId,
  currentUserId,
  currentUserRole,
  isHighlighted,
  isDeleting,
  onSelectReply,
  onRequestDelete,
}: CommentBubbleProps) {
  const canDelete =
    Boolean(currentUserId) &&
    !cmt.isOptimistic &&
    (currentUserId === cmt.userId ||
      currentUserId === postOwnerId ||
      currentUserRole === "ADMIN");

  const cmtProfileHref = `/community/profile/${encodeURIComponent(
    cmt.author.username || cmt.author.id
  )}`;

  const isAuthorVerified = Boolean(
    cmt.author.isVerifiedCreator ?? cmt.author.isVerified
  );

  return (
    <div
      id={`comment-${cmt.id}`}
      className="flex items-start gap-2.5 group/cmt"
    >
      <Link href={cmtProfileHref} className="shrink-0 pt-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cmt.author.avatarUrl || DEFAULT_AVATAR}
          alt={cmt.author.fullName}
          loading="lazy"
          decoding="async"
          className={`${
            isReply ? "w-7 h-7" : "w-9 h-9"
          } rounded-full object-cover border border-[#E2E8F0] hover:border-[#0194F3] transition-colors`}
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div
          className={`inline-block max-w-full rounded-[18px] px-3.5 py-2.5 border transition-colors ${
            isHighlighted
              ? "bg-[#F0F7FF] border-[#0194F3] ring-2 ring-[#0194F3]/25"
              : "bg-[#F8FAFC] border-[#E2E8F0]/90"
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <Link
              href={cmtProfileHref}
              className="text-[13px] font-extrabold text-[#0F172A] hover:text-[#0194F3] transition-colors"
            >
              {cmt.author.fullName}
            </Link>
            {isAuthorVerified && (
              <i
                className="fa-solid fa-circle-check text-[#0194F3] text-[11px]"
                title="Thổ địa xác thực"
                aria-hidden="true"
              />
            )}
            {cmt.userId === postOwnerId && (
              <span className="px-2 py-0.5 rounded-[6px] bg-[#F0F7FF] text-[#0194F3] text-[10px] font-bold">
                Tác giả
              </span>
            )}
            {isReply && cmt.replyToName && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B]">
                <CornerDownRight className="size-3 text-[#0194F3] shrink-0" />
                <span className="font-semibold text-[#0194F3]">
                  @{cmt.replyToName}
                </span>
              </span>
            )}
          </div>

          <p className="text-[13px] text-[#1E293B] leading-[1.5] break-words whitespace-pre-line">
            {cmt.content}
          </p>
        </div>

        {/* Facebook-style sub-bubble action links */}
        <div className="flex items-center gap-3 pl-2 pt-1 text-[11px] text-[#64748B]">
          <span className="font-medium">
            {cmt.isOptimistic
              ? "Đang gửi..."
              : formatRelativeTime(cmt.createdAt)}
          </span>
          {!cmt.isOptimistic && (
            <button
              type="button"
              onClick={() => onSelectReply(cmt.id, cmt.author.fullName)}
              className="font-bold text-[#475569] hover:text-[#0194F3] hover:underline bg-transparent border-none p-0 cursor-pointer"
            >
              Phản hồi
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onRequestDelete(cmt.id)}
              className="font-semibold text-[#94A3B8] hover:text-rose-600 bg-transparent border-none p-0 cursor-pointer opacity-0 group-hover/cmt:opacity-100 focus:opacity-100 transition-opacity"
              title="Xóa bình luận"
            >
              Xóa
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

interface StickyCommentComposerProps {
  postId: string;
  replyTarget: ReplyTargetState | null;
  onCancelReply: () => void;
}

function StickyCommentComposer({
  postId,
  replyTarget,
  onCancelReply,
}: StickyCommentComposerProps) {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createCommentMutation = useCreatePostComment();

  useEffect(() => {
    if (replyTarget) {
      inputRef.current?.focus();
    }
  }, [replyTarget]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || !user) return;

    const activeReply = replyTarget;
    setCommentText("");
    onCancelReply();

    createCommentMutation.mutate({
      postId,
      content: trimmed,
      parentId: activeReply?.parentId,
      replyToName: activeReply?.replyToName,
    });
  };

  if (!user) {
    return (
      <div className="shrink-0 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[#64748B]">
          Đăng nhập để tham gia bình luận và đặt câu hỏi cho tác giả bài viết.
        </p>
        <Link
          href="/login"
          className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-bold inline-flex items-center justify-center shrink-0 transition-colors"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-[#E2E8F0] bg-white px-5 py-3 space-y-2">
      {replyTarget && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#F0F7FF] border border-[#BAE0FD] text-xs">
          <div className="flex items-center gap-1.5 text-[#334155] truncate">
            <CornerDownRight className="size-3.5 text-[#0194F3] shrink-0" />
            <span>Đang phản hồi</span>
            <span className="font-extrabold text-[#0194F3] truncate">
              @{replyTarget.replyToName}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-xs font-bold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
          >
            Hủy
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatarUrl || DEFAULT_AVATAR}
          alt={user.fullName}
          className="w-9 h-9 rounded-full object-cover border border-[#E2E8F0] shrink-0"
        />

        <div className="flex-1 flex items-center bg-[#F8FAFC] border border-[#E2E8F0] focus-within:border-[#0194F3] focus-within:bg-white rounded-full px-4 h-10 transition-colors">
          <input
            ref={inputRef}
            type="text"
            maxLength={COMMUNITY_UI_CONSTANTS.MAX_COMMENT_LENGTH}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={
              replyTarget
                ? `Viết phản hồi cho @${replyTarget.replyToName}...`
                : `Viết bình luận dưới tên ${user.fullName}...`
            }
            className="flex-1 bg-transparent text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || createCommentMutation.isPending}
            aria-label="Gửi bình luận"
            className="ml-2 text-[#0194F3] hover:text-[#007FE3] disabled:text-[#CBD5E1] transition-colors cursor-pointer bg-transparent border-none p-1"
          >
            <i className="fa-solid fa-paper-plane text-[14px]" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

export function PostDetailModal({
  open,
  onClose,
  post,
  onSelectTag,
  onOpenClonePreview,
  highlightCommentId,
}: PostDetailModalProps) {
  const { user } = useAuth();
  const hasScrolledRef = useRef(false);

  const [replyTarget, setReplyTarget] = useState<ReplyTargetState | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null
  );
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const toggleLikeMutation = useTogglePostLike();
  const deleteCommentMutation = useDeletePostComment();

  const { data: comments = [], isLoading: isLoadingComments } = usePostComments(
    post.id,
    open
  );

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

  useEffect(() => {
    if (!open) {
      hasScrolledRef.current = false;
      setReplyTarget(null);
      setDeletingCommentId(null);
      setLightboxIndex(null);
    }
  }, [open]);

  const mediaList = useMemo(
    () =>
      post.mediaUrls && post.mediaUrls.length > 0
        ? post.mediaUrls
        : post.itinerary?.coverPhoto
        ? [post.itinerary.coverPhoto]
        : [],
    [post.mediaUrls, post.itinerary?.coverPhoto]
  );

  const profileIdentifier = post.author.username || post.author.id;
  const profileHref = `/community/profile/${encodeURIComponent(
    profileIdentifier
  )}`;
  const destinationLabel =
    post.itinerary?.areaName || post.itinerary?.destination || null;

  const formattedEstimatedCost =
    post.itinerary?.estimatedCost && post.itinerary.estimatedCost > 0
      ? formatVnd(post.itinerary.estimatedCost)
      : null;

  const durationLabel = formatTripDuration(
    post.itinerary?.startDate,
    post.itinerary?.endDate,
    false
  );

  const authorSubtitle = resolvePostAuthorSubtitle(post);

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

  useEffect(() => {
    if (!highlightCommentId || !open || hasScrolledRef.current) return;

    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (el) {
      hasScrolledRef.current = true;
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [highlightCommentId, open, threadedComments]);

  const handleToggleLike = () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thả tim bài viết");
      return;
    }
    toggleLikeMutation.mutate(post.id);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/community?postId=${encodeURIComponent(
      post.id
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
      toast.success("Đã sao chép liên kết bài viết vào bộ nhớ tạm!");
    } catch {
      toast.info("Liên kết: " + shareUrl);
    }
  };

  const handleSelectReply = (
    targetCommentId: string,
    targetAuthorName: string
  ) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để phản hồi bình luận");
      return;
    }
    setReplyTarget({
      parentId: targetCommentId,
      replyToName: targetAuthorName,
    });
  };

  const isAuthorVerified = Boolean(
    post.author.isVerifiedCreator ?? post.author.isVerified
  );

  return (
    <CommunityModalPortal
      open={open}
      onClose={onClose}
      ariaLabelledBy="post-detail-modal-title"
      maxWidthClass="max-w-2xl"
      dialogClassName="h-[88vh]"
    >
      {/* ==================== ZONE 1: STICKY FACEBOOK-STYLE HEADER ==================== */}
      <div className="relative flex items-center justify-center px-6 py-4 border-b border-[#E2E8F0] bg-white shrink-0">
        <h2
          id="post-detail-modal-title"
          className="text-[16px] font-black text-[#0F172A] tracking-tight text-center truncate max-w-[75%]"
        >
          Bài viết của {post.author.fullName}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-1/2 -translate-y-1/2 size-9 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] hover:text-[#0F172A] inline-flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Đóng xem chi tiết bài viết"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ==================== ZONE 2: SCROLLABLE POST & COMMENT STREAM ==================== */}
      <div className="flex-1 overflow-y-auto custom-scroll p-5 space-y-4">
        {/* Post Author Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={profileHref} onClick={onClose} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.author.avatarUrl || DEFAULT_AVATAR}
                alt={post.author.fullName}
                className="w-11 h-11 rounded-full object-cover border border-[#E2E8F0]"
              />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href={profileHref}
                  onClick={onClose}
                  className="text-[14px] font-black text-[#0F172A] hover:text-[#0194F3] transition-colors truncate"
                >
                  {post.author.fullName}
                </Link>
                {isAuthorVerified && (
                  <>
                    <span className="py-0.5 px-1.5 rounded-[5px] bg-[#F0F7FF] text-[#0194F3] text-[10px] font-bold">
                      Thổ địa
                    </span>
                    <i
                      className="fa-solid fa-circle-check text-[#0194F3] text-[13px] shrink-0"
                      title="Thổ địa xác thực"
                      aria-hidden="true"
                    />
                  </>
                )}
                <span className="text-[11px] text-[#94A3B8]">
                  • {formatRelativeTime(post.createdAt)}
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] font-medium truncate">
                <span>{authorSubtitle.handle}</span>
                {" • "}
                <span>{authorSubtitle.contextLabel}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Post Title, Caption & Hashtags */}
        <div className="space-y-2">
          <h3 className="text-[17px] font-black text-[#020617] leading-[1.4] tracking-[-0.02em]">
            {post.title}
          </h3>
          {post.caption && (
            <p className="text-[13px] text-[#334155] leading-[1.6] whitespace-pre-line">
              {post.caption}
            </p>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {post.tags.map((tag, idx) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    onSelectTag?.(tag);
                    onClose();
                  }}
                  className={
                    idx < 2
                      ? "py-0.5 px-2 rounded-[6px] bg-[#F0F7FF] text-[#0194F3] text-[11px] font-bold hover:bg-[#BAE0FD]/50 transition-colors cursor-pointer"
                      : "py-0.5 px-2 rounded-[6px] bg-[#F1F5F9] text-[#475569] text-[11px] font-semibold hover:bg-[#E2E8F0] transition-colors cursor-pointer"
                  }
                >
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Media Gallery */}
        {mediaList.length > 0 && (
          <div className="w-full space-y-2">
            {lightboxIndex !== null && (
              <div className="relative w-full h-[340px] rounded-[16px] overflow-hidden bg-slate-950 flex items-center justify-center">
                {isVideoUrl(mediaList[lightboxIndex]) ? (
                  <video
                    key={mediaList[lightboxIndex]}
                    src={mediaList[lightboxIndex]}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaList[lightboxIndex]}
                    alt={`${post.title} - ${lightboxIndex + 1}`}
                    decoding="async"
                    className="w-full h-full object-contain"
                  />
                )}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
                  <span className="px-2.5 py-1 rounded-full bg-black/65 text-white text-[11px] font-bold">
                    {lightboxIndex + 1} / {mediaList.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(null)}
                    className="px-2.5 py-1 rounded-full bg-black/65 hover:bg-black/85 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <X className="size-3.5" />
                    <span>Thu gọn lưới</span>
                  </button>
                </div>
                {mediaList.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxIndex((prev) =>
                          prev !== null
                            ? prev > 0
                              ? prev - 1
                              : mediaList.length - 1
                            : 0
                        )
                      }
                      aria-label="Tệp trước"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center cursor-pointer"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxIndex((prev) =>
                          prev !== null
                            ? prev < mediaList.length - 1
                              ? prev + 1
                              : 0
                            : 0
                        )
                      }
                      aria-label="Tệp tiếp theo"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center cursor-pointer"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </>
                )}
              </div>
            )}

            {lightboxIndex === null && mediaList.length === 1 && (
              <div className="relative w-full h-[300px] rounded-[16px] overflow-hidden bg-slate-900">
                {isVideoUrl(mediaList[0]) ? (
                  <video
                    src={getVideoThumbnailSrc(mediaList[0])}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaList[0]}
                    alt={post.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}

            {lightboxIndex === null && mediaList.length === 2 && (
              <div className="grid grid-cols-2 gap-2 h-[240px] rounded-[16px] overflow-hidden">
                {mediaList.map((url, idx) => (
                  <div
                    key={url}
                    onClick={() => setLightboxIndex(idx)}
                    className="relative w-full h-full overflow-hidden bg-slate-100 cursor-pointer group"
                  >
                    <MediaGridTileContent
                      url={url}
                      alt={`${post.title} - ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {lightboxIndex === null && mediaList.length >= 3 && (
              <div className="grid grid-cols-[1.4fr_1fr] gap-2 h-[280px] rounded-[16px] overflow-hidden">
                <div
                  onClick={() => setLightboxIndex(0)}
                  className="relative w-full h-full overflow-hidden bg-slate-100 cursor-pointer group"
                >
                  <MediaGridTileContent
                    url={mediaList[0]}
                    alt={`${post.title} - 1`}
                    playIconSizeClass="size-10"
                  />
                </div>
                <div className="grid grid-rows-2 gap-2 h-full">
                  <div
                    onClick={() => setLightboxIndex(1)}
                    className="relative w-full h-full overflow-hidden bg-slate-100 cursor-pointer group"
                  >
                    <MediaGridTileContent
                      url={mediaList[1]}
                      alt={`${post.title} - 2`}
                      playIconSizeClass="size-7"
                    />
                  </div>
                  <div
                    onClick={() => setLightboxIndex(2)}
                    className="relative w-full h-full overflow-hidden bg-slate-100 cursor-pointer group"
                  >
                    <MediaGridTileContent
                      url={mediaList[2]}
                      alt={`${post.title} - 3`}
                      playIconSizeClass="size-7"
                    />
                    {mediaList.length > 3 && (
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-sm font-bold">
                        +{mediaList.length - 3} tệp khác
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attached Itinerary Strip (Matching .itinerary-strip from community_redesign_demo.html) */}
        {post.itinerary && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-[16px] py-3 px-4 transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-[12px] bg-[#0194F3] text-white flex items-center justify-center text-[18px] shrink-0 shadow-[0_2px_6px_rgba(1,148,243,0.25)]">
                <i className="fa-solid fa-route" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="py-0.5 px-[7px] rounded-[6px] bg-[#F0F7FF] text-[#0194F3] font-extrabold text-[10px] uppercase tracking-[0.04em]">
                    Lộ trình đính kèm
                  </span>
                  {durationLabel && (
                    <span className="text-[11px] text-[#64748B] font-semibold">
                      • {durationLabel}
                    </span>
                  )}
                </div>
                <Link
                  href={`/itineraries/${post.itinerary.id}`}
                  onClick={onClose}
                  className="block text-[14px] font-extrabold text-[#0F172A] hover:text-[#0194F3] leading-[1.3] truncate transition-colors"
                >
                  {post.itinerary.title}
                </Link>
                <div className="text-[11px] text-[#64748B] font-medium mt-0.5 truncate">
                  {post.itinerary.totalPlaces} Điểm đến
                  {formattedEstimatedCost
                    ? ` • Dự trù ~${formattedEstimatedCost}/người`
                    : ""}
                </div>
              </div>
            </div>

            {onOpenClonePreview ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenClonePreview(post);
                }}
                className="bg-[#0194F3] hover:bg-[#007FE3] text-white py-2 px-4 text-[12px] font-bold shrink-0 rounded-[10px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors border-none"
              >
                <i className="fa-regular fa-clone" aria-hidden="true" />
                <span>Xem &amp; Nhân bản</span>
              </button>
            ) : (
              <Link
                href={`/itineraries/${post.itinerary.id}`}
                onClick={onClose}
                className="bg-[#0194F3] hover:bg-[#007FE3] text-white py-2 px-4 text-[12px] font-bold shrink-0 rounded-[10px] inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Xem chi tiết</span>
              </Link>
            )}
          </div>
        )}

        {/* Social Actions Bar */}
        <div className="py-2.5 px-1 border-y border-[#F1F5F9] flex items-center justify-between text-[12px] text-[#64748B] font-semibold">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 bg-transparent border-none text-[12px] font-bold cursor-pointer transition-colors ${
                post.isLiked
                  ? "text-[#EF4444]"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <i
                className={`${
                  post.isLiked ? "fa-solid" : "fa-regular"
                } fa-heart text-[16px]`}
                aria-hidden="true"
              />
              <span>{post.likeCount} lượt thích</span>
            </button>

            <div className="flex items-center gap-1.5 text-[#64748B]">
              <i className="fa-regular fa-comment text-[16px]" aria-hidden="true" />
              <span>{allComments.length} bình luận</span>
            </div>

            {(post.itinerary || post.cloneCount > 0) && (
              <span className="inline-flex items-center gap-1.5 text-[#0194F3] font-extrabold bg-[#F0F7FF] py-0.5 px-2.5 rounded-full text-[11px]">
                <i className="fa-solid fa-share-from-square text-[11px]" aria-hidden="true" />
                <span>{post.cloneCount} nhân bản</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 bg-transparent border-none text-[12px] font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer transition-colors"
          >
            <i className="fa-solid fa-share-nodes text-[14px]" aria-hidden="true" />
            <span>Chia sẻ</span>
          </button>
        </div>

        {/* Comments Header & Sort Switcher */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px] font-extrabold text-[#0F172A]">
            Bình luận ({allComments.length})
          </span>
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setSortOrder("NEWEST")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                sortOrder === "NEWEST"
                  ? "bg-[#F0F7FF] text-[#0194F3]"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Mới nhất
            </button>
            <button
              type="button"
              onClick={() => setSortOrder("OLDEST")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                sortOrder === "OLDEST"
                  ? "bg-[#F0F7FF] text-[#0194F3]"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Tất cả bình luận
            </button>
          </div>
        </div>

        {/* Comments Stream (4 Resilience States) */}
        {isLoadingComments ? (
          <div className="space-y-3 py-2">
            {[1, 2].map((idx) => (
              <div key={idx} className="flex items-start gap-2.5 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 max-w-md h-16 rounded-[18px] bg-slate-100" />
              </div>
            ))}
          </div>
        ) : threadedComments.length === 0 ? (
          <div className="py-8 text-center space-y-1.5 rounded-2xl bg-[#F8FAFC] border border-dashed border-[#E2E8F0]">
            <i
              className="fa-regular fa-comments text-2xl text-[#94A3B8]"
              aria-hidden="true"
            />
            <p className="text-xs font-extrabold text-[#0F172A]">
              Chưa có bình luận nào
            </p>
            <p className="text-[11px] text-[#64748B]">
              Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ cảm nhận về chuyến
              đi này!
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 pb-2">
            {threadedComments.map(({ root, replies }) => (
              <div key={root.id} className="space-y-2.5">
                <CommentBubble
                  cmt={root}
                  isReply={false}
                  postOwnerId={post.userId}
                  currentUserId={user?.id}
                  currentUserRole={user?.role}
                  isHighlighted={highlightCommentId === root.id}
                  isDeleting={deleteCommentMutation.isPending}
                  onSelectReply={handleSelectReply}
                  onRequestDelete={setDeletingCommentId}
                />

                {replies.length > 0 && (
                  <div className="ml-6 pl-3.5 border-l-2 border-[#E2E8F0] space-y-2.5">
                    {replies.map((reply) => (
                      <CommentBubble
                        key={reply.id}
                        cmt={reply}
                        isReply={true}
                        postOwnerId={post.userId}
                        currentUserId={user?.id}
                        currentUserRole={user?.role}
                        isHighlighted={highlightCommentId === reply.id}
                        isDeleting={deleteCommentMutation.isPending}
                        onSelectReply={( _id, authorName) =>
                          handleSelectReply(root.id, authorName)
                        }
                        onRequestDelete={setDeletingCommentId}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== ZONE 3: STICKY BOTTOM COMMENT INPUT ==================== */}
      <StickyCommentComposer
        postId={post.id}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
      />

      {/* Inline Delete Comment Confirmation Overlay */}
      {deletingCommentId && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0F172A]/60 p-4"
          onClick={() => {
            if (!deleteCommentMutation.isPending) {
              setDeletingCommentId(null);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-[20px] border border-[#E2E8F0] bg-white p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-[#0F172A]">
                  Xác nhận xóa bình luận?
                </h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Bình luận này sẽ bị xóa vĩnh viễn khỏi bài viết.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={deleteCommentMutation.isPending}
                onClick={() => setDeletingCommentId(null)}
                className="h-9 px-4 rounded-[10px] text-xs font-semibold cursor-pointer"
              >
                Hủy
              </Button>
              <button
                type="button"
                disabled={deleteCommentMutation.isPending}
                onClick={async () => {
                  try {
                    await deleteCommentMutation.mutateAsync({
                      commentId: deletingCommentId,
                      postId: post.id,
                    });
                    setDeletingCommentId(null);
                  } catch {
                    // Handled by mutation onError
                  }
                }}
                className="h-9 px-4 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {deleteCommentMutation.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                <span>Xóa bình luận</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </CommunityModalPortal>
  );
}

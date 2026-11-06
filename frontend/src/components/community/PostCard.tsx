"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Copy,
  MapPin,
  Share2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  CalendarDays,
  Pencil,
  Play,
  X,
  Loader2,
} from "lucide-react";
import type { CommunityPostItem } from "@/types/community";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useTogglePostLike,
  useDeleteCommunityPost,
} from "@/features/community/hooks/use-community";
import { formatVnd } from "@/features/planner/model/itinerary-format";
import { formatRelativeTime, isVideoUrl } from "@/services/community.service";
import { CommentDrawer } from "./CommentDrawer";
import { CloneItineraryPreviewModal } from "./CloneItineraryPreviewModal";
import { EditPostModal } from "./EditPostModal";
import { PostDetailModal } from "./PostDetailModal";

interface PostCardProps {
  post: CommunityPostItem;
  defaultOpenComments?: boolean;
  onSelectTag?: (tag: string) => void;
}

export function PostCard({
  post,
  defaultOpenComments = false,
  onSelectTag,
}: PostCardProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(defaultOpenComments);
  const [isClonePreviewOpen, setIsClonePreviewOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const toggleLikeMutation = useTogglePostLike();
  const deletePostMutation = useDeleteCommunityPost();

  const mediaList =
    post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : post.itinerary?.coverPhoto
      ? [post.itinerary.coverPhoto]
      : [];

  const currentMediaUrl = mediaList[activeMediaIdx] || null;
  const isCurrentVideo = currentMediaUrl ? isVideoUrl(currentMediaUrl) : false;

  // Native IntersectionObserver for TikTok/Facebook-style muted video autoplay in viewport
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !isCurrentVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            videoEl.play().catch(() => {
              // Autoplay blocked by browser policy until user interacts
            });
          } else {
            videoEl.pause();
          }
        });
      },
      { threshold: [0.2, 0.6] }
    );

    observer.observe(videoEl);
    return () => observer.disconnect();
  }, [currentMediaUrl, isCurrentVideo]);

  // Handle Escape key and background scroll lock for Confirm Delete Modal
  useEffect(() => {
    if (!isConfirmDeleteOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deletePostMutation.isPending) {
        setIsConfirmDeleteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConfirmDeleteOpen, deletePostMutation.isPending]);

  // Handle keyboard navigation (Escape, ArrowLeft, ArrowRight) and background scroll lock for Lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) =>
          prev !== null ? (prev > 0 ? prev - 1 : mediaList.length - 1) : null
        );
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) =>
          prev !== null ? (prev < mediaList.length - 1 ? prev + 1 : 0) : null
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxIndex, mediaList.length]);

  const profileIdentifier = post.author.username || post.author.id;
  const profileHref = `/community/profile/${encodeURIComponent(profileIdentifier)}`;
  const destinationLabel =
    post.itinerary?.areaName || post.itinerary?.destination || null;

  const canEditPost =
    Boolean(user) && (user?.id === post.userId || user?.role === "ADMIN");
  const canDeletePost = canEditPost;

  const isEdited = Boolean(post.editedAt);

  const handleToggleLike = () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thả tim bài viết");
      return;
    }
    toggleLikeMutation.mutate(post.id);
  };

  const handleOpenClonePreview = () => {
    if (!post.itinerary) return;
    setIsClonePreviewOpen(true);
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

  const formattedEstimatedCost =
    post.itinerary?.estimatedCost && post.itinerary.estimatedCost > 0
      ? formatVnd(post.itinerary.estimatedCost)
      : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-xs hover:border-primary/30 transition-all">
      {/* Author Header (Click Avatar or Name -> Creator Public Profile) */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={profileHref}
          className="flex items-center gap-3 group min-w-0"
          title={`Xem trang cá nhân của ${post.author.fullName}`}
        >
          <Avatar className="size-10 border border-border group-hover:border-primary transition-colors shrink-0">
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
              <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                {post.author.fullName}
              </h4>
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
              {isEdited && (
                <span className="text-[11px] text-muted-foreground/80 italic ml-1 font-normal">
                  (Đã chỉnh sửa)
                </span>
              )}
              {destinationLabel && (
                <>
                  {" "}
                  • <span className="text-primary font-medium">{destinationLabel}</span>
                </>
              )}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          {destinationLabel && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary-foreground bg-secondary px-2.5 py-1 rounded-full">
              <MapPin className="size-3 text-primary" />
              <span>{destinationLabel}</span>
            </span>
          )}

          {canEditPost && (
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              aria-label="Chỉnh sửa bài viết"
              title="Chỉnh sửa bài viết"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Pencil className="size-4" />
            </button>
          )}

          {canDeletePost && (
            <button
              type="button"
              onClick={() => setIsConfirmDeleteOpen(true)}
              disabled={deletePostMutation.isPending}
              aria-label="Xóa bài viết"
              title="Xóa bài viết"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Post Title & Caption */}
      <div className="space-y-1.5">
        <h3 className="text-base sm:text-lg font-bold text-foreground font-heading leading-snug">
          {post.title}
        </h3>
        {post.caption && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {post.caption}
          </p>
        )}
      </div>

      {/* Multimedia Showcase (Facebook/Xiaohongshu-style Collage Grid) */}
      {mediaList.length > 0 && (
        <div className="w-full">
          {/* Case 1: Single Media (Image or Video) */}
          {mediaList.length === 1 && (
            <div
              onClick={() => setLightboxIndex(0)}
              className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-video cursor-pointer group"
            >
              {isVideoUrl(mediaList[0]) ? (
                <video
                  ref={videoRef}
                  src={mediaList[0]}
                  controls
                  playsInline
                  muted
                  loop
                  preload="metadata"
                  className="w-full h-full object-cover bg-black"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaList[0]}
                  alt={post.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                />
              )}
            </div>
          )}

          {/* Case 2: Exactly 2 Media Items Side by Side */}
          {mediaList.length === 2 && (
            <div className="grid grid-cols-2 gap-1.5 w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-[4/3] sm:aspect-[16/9]">
              {mediaList.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setLightboxIndex(idx)}
                  className="relative h-full w-full overflow-hidden cursor-pointer group bg-black/5"
                >
                  {isVideoUrl(url) ? (
                    <>
                      <video
                        src={url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                        <Play className="size-8 text-white fill-white drop-shadow-md" />
                      </div>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`${post.title} - ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Case 3: 3 or More Media Items (1 Big on Left, 2 Stacked on Right, +N Overlay on Bottom Right) */}
          {mediaList.length >= 3 && (
            <div className="grid grid-cols-2 gap-1.5 w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-[4/3] sm:aspect-[16/10] max-h-[520px]">
              {/* Left Column: Big tall photo/video (Item 0) */}
              <div
                onClick={() => setLightboxIndex(0)}
                className="relative h-full w-full overflow-hidden cursor-pointer group bg-black/5"
              >
                {isVideoUrl(mediaList[0]) ? (
                  <>
                    <video
                      src={mediaList[0]}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                      <Play className="size-10 text-white fill-white drop-shadow-md" />
                    </div>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaList[0]}
                    alt={`${post.title} - 1`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                )}
              </div>

              {/* Right Column: 2 Rows */}
              <div className="grid grid-rows-2 gap-1.5 h-full w-full">
                {/* Top-Right Item (Item 1) */}
                <div
                  onClick={() => setLightboxIndex(1)}
                  className="relative h-full w-full overflow-hidden cursor-pointer group bg-black/5"
                >
                  {isVideoUrl(mediaList[1]) ? (
                    <>
                      <video
                        src={mediaList[1]}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                        <Play className="size-7 text-white fill-white drop-shadow-md" />
                      </div>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaList[1]}
                      alt={`${post.title} - 2`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  )}
                </div>

                {/* Bottom-Right Item (Item 2) - Shows +N if more than 3 media items */}
                <div
                  onClick={() => setLightboxIndex(2)}
                  className="relative h-full w-full overflow-hidden cursor-pointer group bg-black/5"
                >
                  {isVideoUrl(mediaList[2]) ? (
                    <>
                      <video
                        src={mediaList[2]}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                        <Play className="size-7 text-white fill-white drop-shadow-md" />
                      </div>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaList[2]}
                      alt={`${post.title} - 3`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  )}

                  {mediaList.length > 3 && (
                    <div className="absolute inset-0 bg-black/60 hover:bg-black/65 transition-colors flex items-center justify-center backdrop-blur-[2px]">
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

      {/* Linked Actionable Itinerary Card */}
      {post.itinerary && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/25 bg-secondary/40 p-3.5">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <CalendarDays className="size-3.5" />
              <span>Lịch trình đính kèm</span>
              {post.itinerary.totalPlaces > 0 && (
                <span>• {post.itinerary.totalPlaces} địa điểm</span>
              )}
              {formattedEstimatedCost && (
                <span>• ~{formattedEstimatedCost}</span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground truncate">
              {post.itinerary.title}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/itineraries/${post.itinerary.id}`}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            >
              <ExternalLink className="size-3.5" />
              <span>Xem</span>
            </Link>
            <Button
              size="sm"
              onClick={handleOpenClonePreview}
              className="min-h-[40px] px-3.5 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Copy className="size-3.5" />
              <span>Nhân bản ({post.cloneCount})</span>
            </Button>
          </div>
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) =>
            onSelectTag ? (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(tag)}
                className="px-2.5 py-0.5 rounded-full bg-muted hover:bg-secondary hover:text-secondary-foreground text-xs font-medium text-muted-foreground transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ) : (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            )
          )}
        </div>
      )}

      {/* Social Action Footer (Like, Comment, Share) */}
      <div className="flex items-center justify-between pt-2 border-t border-border/70 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleToggleLike}
            className={`inline-flex items-center gap-1.5 min-h-[44px] px-2 rounded-xl transition-colors cursor-pointer ${
              post.isLiked
                ? "text-rose-500 font-bold"
                : "hover:text-foreground hover:bg-muted/50 font-medium"
            }`}
          >
            <Heart
              className={`size-4 ${post.isLiked ? "fill-current text-rose-500" : ""}`}
            />
            <span>{post.likeCount} Thích</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDetailModalOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-2 rounded-xl transition-colors cursor-pointer hover:text-foreground hover:bg-muted/50 font-medium"
          >
            <MessageCircle className="size-4" />
            <span>{post.commentCount} Bình luận</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-2 rounded-xl font-medium hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
        >
          <Share2 className="size-4" />
          <span>Chia sẻ</span>
        </button>
      </div>

      {/* Expandable Live Comment Drawer */}
      {showComments && (
        <CommentDrawer postId={post.id} postOwnerId={post.userId} />
      )}

      {/* Compact Itinerary Preview & Clone Confirmation Modal */}
      {post.itinerary && (
        <CloneItineraryPreviewModal
          open={isClonePreviewOpen}
          onClose={() => setIsClonePreviewOpen(false)}
          itinerarySummary={post.itinerary}
          cloneCount={post.cloneCount}
        />
      )}

      {/* Facebook-style Post Detail & Comments Modal */}
      {isDetailModalOpen && (
        <PostDetailModal
          open={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          post={post}
          onSelectTag={onSelectTag}
        />
      )}

      {/* Edit Post Modal */}
      {canEditPost && isEditModalOpen && (
        <EditPostModal
          key={`${post.id}-${post.editedAt || post.updatedAt}`}
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          post={post}
        />
      )}
      {/* Confirm Delete Post Modal */}
      {isConfirmDeleteOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          aria-describedby="confirm-delete-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => {
            if (!deletePostMutation.isPending) {
              setIsConfirmDeleteOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="size-11 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <Trash2 className="size-5" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3
                  id="confirm-delete-title"
                  className="text-lg font-bold text-foreground"
                >
                  Xác nhận xóa bài viết?
                </h3>
                <p
                  id="confirm-delete-desc"
                  className="text-sm text-muted-foreground leading-relaxed"
                >
                  Bạn có chắc chắn muốn xóa bài viết{" "}
                  <span className="font-semibold text-foreground">
                    &ldquo;{post.title}&rdquo;
                  </span>
                  ? Toàn bộ hình ảnh, tương tác và bình luận liên quan sẽ bị xóa vĩnh viễn và không thể khôi phục.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={deletePostMutation.isPending}
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="h-10 px-4 rounded-xl text-sm font-medium cursor-pointer"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deletePostMutation.isPending}
                onClick={async () => {
                  try {
                    await deletePostMutation.mutateAsync(post.id);
                    setIsConfirmDeleteOpen(false);
                  } catch {
                    // Handled by react-query onError toast
                  }
                }}
                className="h-10 px-5 rounded-xl text-sm font-semibold gap-2 cursor-pointer shadow-xs"
              >
                {deletePostMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                <span>Xác nhận xóa</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal for Media Inspection */}
      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh và video chi tiết"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar with Counter and Close Button */}
          <div
            className="absolute top-4 inset-x-4 sm:inset-x-6 flex items-center justify-between text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs sm:text-sm font-semibold tracking-wide">
              {lightboxIndex + 1} / {mediaList.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Đóng xem chi tiết"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Media Content Display */}
          <div
            className="relative flex items-center justify-center max-w-5xl max-h-[82vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {isVideoUrl(mediaList[lightboxIndex]) ? (
              <video
                key={mediaList[lightboxIndex]}
                src={mediaList[lightboxIndex]}
                controls
                autoPlay
                playsInline
                className="max-h-[80vh] max-w-full rounded-xl object-contain bg-black shadow-2xl"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaList[lightboxIndex]}
                alt={`${post.title} - Chi tiết`}
                className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl select-none"
              />
            )}

            {/* Prev Button */}
            {mediaList.length > 1 && (
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
                className="absolute left-2 sm:-left-14 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Ảnh trước"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}

            {/* Next Button */}
            {mediaList.length > 1 && (
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
                className="absolute right-2 sm:-right-14 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Ảnh tiếp theo"
              >
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

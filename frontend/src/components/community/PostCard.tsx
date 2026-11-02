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
  const [showComments, setShowComments] = useState(defaultOpenComments);
  const [isClonePreviewOpen, setIsClonePreviewOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
              onClick={() => deletePostMutation.mutate(post.id)}
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

      {/* Multimedia Showcase (Video Player or Image Carousel) */}
      {currentMediaUrl && (
        <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-video">
          {isCurrentVideo ? (
            <video
              ref={videoRef}
              src={currentMediaUrl}
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
              src={currentMediaUrl}
              alt={post.title}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          )}

          {/* Multi-media Carousel Navigation */}
          {mediaList.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setActiveMediaIdx((prev) =>
                    prev === 0 ? mediaList.length - 1 : prev - 1
                  )
                }
                aria-label="Ảnh hoặc video trước"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveMediaIdx((prev) =>
                    prev === mediaList.length - 1 ? 0 : prev + 1
                  )
                }
                aria-label="Ảnh hoặc video tiếp theo"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
              <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-black/65 text-white text-xs font-semibold">
                {activeMediaIdx + 1}/{mediaList.length}
              </div>
            </>
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
            onClick={() => setShowComments((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 min-h-[44px] px-2 rounded-xl transition-colors cursor-pointer ${
              showComments
                ? "text-primary font-bold"
                : "hover:text-foreground hover:bg-muted/50 font-medium"
            }`}
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

      {/* Edit Post Modal */}
      {canEditPost && isEditModalOpen && (
        <EditPostModal
          key={`${post.id}-${post.editedAt || post.updatedAt}`}
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          post={post}
        />
      )}
    </article>
  );
}

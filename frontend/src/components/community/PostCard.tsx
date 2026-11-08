"use client";

import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  Play,
  X,
  Loader2,
} from "lucide-react";
import type { CommunityPostItem } from "@/types/community";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useTogglePostLike,
  useDeleteCommunityPost,
} from "@/features/community/hooks/use-community";
import { formatVnd } from "@/features/planner/model/itinerary-format";
import {
  formatRelativeTime,
  formatTripDuration,
  getVideoThumbnailSrc,
  isVideoUrl,
  resolvePostAuthorSubtitle,
} from "@/services/community.service";
import { CloneItineraryPreviewModal } from "./CloneItineraryPreviewModal";
import { CommunityModalPortal } from "./CommunityModalPortal";
import { EditPostModal } from "./EditPostModal";
import { PostDetailModal } from "./PostDetailModal";
import { ReportPostModal } from "./ReportPostModal";

interface PostCardProps {
  post: CommunityPostItem;
  defaultOpenComments?: boolean;
  isHighlighted?: boolean;
  onSelectTag?: (tag: string) => void;
  onSelectGroup?: (groupSlug: string) => void;
  onOpenDetail?: (post: CommunityPostItem) => void;
  onOpenClonePreview?: (post: CommunityPostItem) => void;
  onOpenEdit?: (post: CommunityPostItem) => void;
  onOpenReport?: (post: CommunityPostItem) => void;
}

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face";

export function MediaGridTileContent({
  url,
  alt,
  playIconSizeClass = "size-8",
}: {
  url: string;
  alt: string;
  playIconSizeClass?: string;
}) {
  if (isVideoUrl(url)) {
    return (
      <>
        <video
          src={getVideoThumbnailSrc(url)}
          className="w-full h-full object-cover bg-slate-900 pointer-events-none"
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play className={`${playIconSizeClass} text-white fill-white`} />
        </div>
      </>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
    />
  );
}

function PostCardComponent({
  post,
  defaultOpenComments = false,
  isHighlighted = false,
  onSelectTag,
  onSelectGroup,
  onOpenDetail,
  onOpenClonePreview,
  onOpenEdit,
  onOpenReport,
}: PostCardProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] =
    useState(defaultOpenComments);
  const [isClonePreviewOpen, setIsClonePreviewOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleLikeMutation = useTogglePostLike();
  const deletePostMutation = useDeleteCommunityPost();

  const mediaList =
    post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : post.itinerary?.coverPhoto
      ? [post.itinerary.coverPhoto]
      : [];

  const currentMediaUrl = mediaList[0] || null;
  const isCurrentVideo = currentMediaUrl ? isVideoUrl(currentMediaUrl) : false;

  // Close ellipsis dropdown when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  // Native IntersectionObserver for muted video autoplay in viewport
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !isCurrentVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            videoEl.play().catch(() => {});
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

  // Handle keyboard navigation (Escape, ArrowLeft, ArrowRight) and mobile-only scroll lock for Lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;

    const isDesktopLockedShell = window.innerWidth >= 1024;
    const prevOverflow = document.body.style.overflow;
    if (!isDesktopLockedShell) {
      document.body.style.overflow = "hidden";
    }

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
      if (!isDesktopLockedShell) {
        document.body.style.overflow = prevOverflow;
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxIndex, mediaList.length]);

  const profileIdentifier = post.author.username || post.author.id;
  const profileHref = `/community/profile/${encodeURIComponent(
    profileIdentifier
  )}`;
  const destinationLabel =
    post.itinerary?.areaName || post.itinerary?.destination || null;

  const canEditPost =
    Boolean(user) && (user?.id === post.userId || user?.role === "ADMIN");
  const canDeletePost = canEditPost;
  const canReportPost = !user || user.id !== post.userId;

  const isEdited = Boolean(post.editedAt);

  const handleToggleLike = () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thả tim bài viết");
      return;
    }
    toggleLikeMutation.mutate(post.id);
  };

  const handleOpenLightbox = (index: number) => {
    videoRef.current?.pause();
    setLightboxIndex(index);
  };

  const handleTriggerDetail = () => {
    videoRef.current?.pause();
    if (onOpenDetail) {
      onOpenDetail(post);
    } else {
      setIsDetailModalOpen(true);
    }
  };

  const handleTriggerClonePreview = () => {
    if (!post.itinerary) return;
    videoRef.current?.pause();
    if (onOpenClonePreview) {
      onOpenClonePreview(post);
    } else {
      setIsClonePreviewOpen(true);
    }
  };

  const handleTriggerEdit = () => {
    setIsMenuOpen(false);
    videoRef.current?.pause();
    if (onOpenEdit) {
      onOpenEdit(post);
    } else {
      setIsEditModalOpen(true);
    }
  };

  const handleTriggerReport = () => {
    setIsMenuOpen(false);
    if (!user) {
      toast.error("Vui lòng đăng nhập để báo cáo bài viết");
      return;
    }
    videoRef.current?.pause();
    if (onOpenReport) {
      onOpenReport(post);
    } else {
      setIsReportModalOpen(true);
    }
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

  return (
    <article
      id={`community-post-${post.id}`}
      className={`min-w-0 w-full bg-white border rounded-[24px] overflow-hidden transition-[border-color,box-shadow] duration-200 ${
        isHighlighted
          ? "border-[#0194F3] ring-2 ring-[#0194F3]/35 shadow-[0_8px_28px_rgba(1,148,243,0.18)]"
          : "border-[#E2E8F0] hover:border-[#CBD5E1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]"
      }`}
    >
      {/* Author Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={profileHref}
            title={`Xem kênh của ${post.author.fullName}`}
            className="shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.author.avatarUrl || DEFAULT_AVATAR}
              alt={post.author.fullName}
              loading="lazy"
              decoding="async"
              className="w-11 h-11 rounded-full object-cover border border-[#E2E8F0] hover:border-[#0194F3] transition-colors"
            />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={profileHref}
                className="text-[14px] font-black text-[#020617] hover:text-[#0194F3] transition-colors truncate"
              >
                {post.author.fullName}
              </Link>
              {post.author.isVerified && (
                <i
                  className="fa-solid fa-circle-check text-[#0194F3] text-[13px] shrink-0"
                  title="Thổ địa được xác thực"
                  aria-label="Thổ địa được xác thực"
                />
              )}
              <span className="text-[11px] text-[#94A3B8]">
                • {formatRelativeTime(post.createdAt)}
                {isEdited ? " (Đã chỉnh sửa)" : ""}
              </span>
            </div>
            <div className="text-[12px] text-[#64748B] font-medium truncate">
              <span>{authorSubtitle.handle}</span>
              {" • "}
              {authorSubtitle.groupBadge && !authorSubtitle.groupBadge.isDefault ? (
                <button
                  type="button"
                  onClick={() =>
                    onSelectGroup
                      ? onSelectGroup(authorSubtitle.groupBadge!.slug)
                      : undefined
                  }
                  className="text-[#0194F3] hover:underline font-semibold bg-transparent border-none cursor-pointer p-0"
                >
                  {authorSubtitle.groupBadge.name}
                </button>
              ) : (
                <span>{authorSubtitle.contextLabel}</span>
              )}
            </div>
          </div>
        </div>

        {/* Ellipsis Action Menu (Edit, Delete, Report, Copy Link) */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Tùy chọn bài viết"
            aria-expanded={isMenuOpen}
            className="border-none bg-transparent text-[14px] text-[#94A3B8] hover:text-[#0F172A] hover:bg-slate-100 rounded-full size-8 inline-flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="fa-solid fa-ellipsis" aria-hidden="true" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-[14px] border border-[#E2E8F0] bg-white shadow-xl py-1.5 z-30 text-xs font-semibold text-[#334155]">
              {canEditPost && (
                <button
                  type="button"
                  onClick={handleTriggerEdit}
                  className="w-full px-3.5 py-2 text-left hover:bg-[#F8FAFC] flex items-center gap-2.5 cursor-pointer"
                >
                  <i
                    className="fa-solid fa-pen text-[#64748B] w-4 text-center"
                    aria-hidden="true"
                  />
                  <span>Chỉnh sửa bài viết</span>
                </button>
              )}

              {canDeletePost && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsConfirmDeleteOpen(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                >
                  <i
                    className="fa-solid fa-trash w-4 text-center"
                    aria-hidden="true"
                  />
                  <span>Xóa bài viết</span>
                </button>
              )}

              {canReportPost && (
                <button
                  type="button"
                  onClick={handleTriggerReport}
                  className="w-full px-3.5 py-2 text-left text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 cursor-pointer"
                >
                  <i
                    className="fa-solid fa-flag w-4 text-center"
                    aria-hidden="true"
                  />
                  <span>Báo cáo bài viết</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleShare();
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-[#F8FAFC] flex items-center gap-2.5 cursor-pointer"
              >
                <i
                  className="fa-solid fa-link text-[#64748B] w-4 text-center"
                  aria-hidden="true"
                />
                <span>Sao chép liên kết</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content Title, Caption & Hashtags */}
      <div className="px-5 pb-3.5 flex flex-col gap-2">
        <h2
          onClick={handleTriggerDetail}
          className="text-[17px] font-black text-[#020617] leading-[1.4] tracking-[-0.02em] cursor-pointer hover:text-[#0194F3] transition-colors"
        >
          {post.title}
        </h2>
        {post.caption && (
          <p className="text-[13px] text-[#475569] leading-[1.6] font-normal whitespace-pre-line">
            {post.caption}
          </p>
        )}

        {/* Hashtags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {post.tags.map((tag, idx) => {
              const isPrimaryTag = idx < 2;
              const badgeClass = isPrimaryTag
                ? "py-0.5 px-2 rounded-[6px] bg-[#F0F7FF] text-[#0194F3] text-[11px] font-bold hover:bg-[#BAE0FD]/50 transition-colors cursor-pointer"
                : "py-0.5 px-2 rounded-[6px] bg-[#F1F5F9] text-[#475569] text-[11px] font-semibold hover:bg-[#E2E8F0] transition-colors cursor-pointer";
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onSelectTag && onSelectTag(tag)}
                  className={badgeClass}
                >
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Media Gallery */}
      {mediaList.length > 0 && (
        <div className="px-5 pb-4">
          {/* Case 1: 1 Photo/Video */}
          {mediaList.length === 1 && (
            <div
              onClick={() => handleOpenLightbox(0)}
              className="relative w-full h-[280px] rounded-[16px] overflow-hidden cursor-pointer group"
            >
              {isVideoUrl(mediaList[0]) ? (
                <video
                  ref={videoRef}
                  src={getVideoThumbnailSrc(mediaList[0])}
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
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              )}
            </div>
          )}

          {/* Case 2: 2 Photos/Videos */}
          {mediaList.length === 2 && (
            <div className="grid grid-cols-2 gap-2 h-[220px] rounded-[16px] overflow-hidden">
              {mediaList.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => handleOpenLightbox(idx)}
                  className="relative w-full h-full overflow-hidden cursor-pointer group"
                >
                  <MediaGridTileContent
                    url={url}
                    alt={`${post.title} - ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Case 3: 3+ Photos/Videos (.gallery-grid 1.4fr 1fr, 280px height) */}
          {mediaList.length >= 3 && (
            <div className="grid grid-cols-[1.4fr_1fr] gap-2 h-[280px] rounded-[16px] overflow-hidden">
              <div
                onClick={() => handleOpenLightbox(0)}
                className="relative overflow-hidden h-full cursor-pointer group"
              >
                <MediaGridTileContent
                  url={mediaList[0]}
                  alt={`${post.title} - 1`}
                  playIconSizeClass="size-10"
                />
              </div>

              <div className="grid grid-rows-2 gap-2 h-full">
                <div
                  onClick={() => handleOpenLightbox(1)}
                  className="relative overflow-hidden h-full cursor-pointer group"
                >
                  <MediaGridTileContent
                    url={mediaList[1]}
                    alt={`${post.title} - 2`}
                    playIconSizeClass="size-7"
                  />
                </div>
                <div
                  onClick={() => handleOpenLightbox(2)}
                  className="relative overflow-hidden h-full cursor-pointer group"
                >
                  <MediaGridTileContent
                    url={mediaList[2]}
                    alt={`${post.title} - 3`}
                    playIconSizeClass="size-7"
                  />
                  {mediaList.length > 3 && (
                    <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-[12px] font-bold">
                      +{mediaList.length - 3} tệp khác
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ATTACHED ITINERARY CARD (.itinerary-strip - USP #1 TripGenie) */}
      {post.itinerary && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-[16px] py-3 px-4 mx-5 mt-1 mb-4 transition-colors">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-[12px] bg-[#0194F3] text-white flex items-center justify-center text-[20px] shrink-0 shadow-[0_2px_6px_rgba(1,148,243,0.25)]">
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
                className="block text-[14px] font-extrabold text-[#0F172A] hover:text-[#0194F3] m-0 leading-[1.3] truncate transition-colors"
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

          <button
            type="button"
            onClick={handleTriggerClonePreview}
            className="bg-[#0194F3] hover:bg-[#007FE3] active:scale-[0.97] text-white py-[9px] px-4 text-[12px] font-bold shrink-0 whitespace-nowrap rounded-[10px] inline-flex items-center justify-center gap-1.5 shadow-[0_2px_6px_rgba(1,148,243,0.25)] cursor-pointer transition-colors border-none"
          >
            <i className="fa-regular fa-clone" aria-hidden="true" />
            <span>Nhân bản lịch trình</span>
          </button>
        </div>
      )}

      {/* Card Social Actions with Font Awesome */}
      <div className="py-3 px-5 border-t border-[#F1F5F9] flex items-center justify-between text-[12px] text-[#64748B] font-semibold">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Like Button */}
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
            <span>{post.likeCount}</span>
          </button>

          {/* Comments Button */}
          <button
            type="button"
            onClick={handleTriggerDetail}
            className="flex items-center gap-1.5 bg-transparent border-none text-[12px] font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer transition-colors"
          >
            <i className="fa-regular fa-comment text-[16px]" aria-hidden="true" />
            <span>{post.commentCount} bình luận</span>
          </button>

          {/* Cloned Count Badge */}
          {(post.itinerary || post.cloneCount > 0) && (
            <div className="flex items-center gap-1.5 text-[#0194F3] font-extrabold bg-[#F0F7FF] py-1 px-2.5 rounded-full">
              <i
                className="fa-solid fa-share-from-square text-[12px]"
                aria-hidden="true"
              />
              <span>{post.cloneCount} lượt nhân bản</span>
            </div>
          )}
        </div>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 bg-transparent border-none text-[12px] font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer transition-colors"
        >
          <i
            className="fa-solid fa-share-nodes text-[15px]"
            aria-hidden="true"
          />
          <span>Chia sẻ</span>
        </button>
      </div>

      {/* Fallback Local Modals (Only mounted when parent does not provide singleton handlers AND modal is open) */}
      {!onOpenClonePreview && isClonePreviewOpen && post.itinerary && (
        <CloneItineraryPreviewModal
          open={isClonePreviewOpen}
          onClose={() => setIsClonePreviewOpen(false)}
          itinerarySummary={post.itinerary}
          cloneCount={post.cloneCount}
        />
      )}

      {!onOpenDetail && isDetailModalOpen && (
        <PostDetailModal
          open={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          post={post}
          onSelectTag={onSelectTag}
        />
      )}

      {!onOpenEdit && canEditPost && isEditModalOpen && (
        <EditPostModal
          key={`${post.id}-${post.editedAt || post.updatedAt}`}
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          post={post}
        />
      )}

      {!onOpenReport && isReportModalOpen && (
        <ReportPostModal
          open={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          post={post}
        />
      )}

      {/* Confirm Delete Post Modal (Portaled via CommunityModalPortal) */}
      {isConfirmDeleteOpen && (
        <CommunityModalPortal
          open={isConfirmDeleteOpen}
          onClose={() => {
            if (!deletePostMutation.isPending) {
              setIsConfirmDeleteOpen(false);
            }
          }}
          role="alertdialog"
          ariaLabelledBy="confirm-delete-title"
          ariaDescribedBy="confirm-delete-desc"
          maxWidthClass="max-w-md"
        >
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="size-5" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3
                  id="confirm-delete-title"
                  className="text-[15px] font-black text-[#0F172A]"
                >
                  Xác nhận xóa bài viết?
                </h3>
                <p
                  id="confirm-delete-desc"
                  className="text-xs text-[#64748B] leading-relaxed"
                >
                  Bạn có chắc chắn muốn xóa bài viết{" "}
                  <span className="font-bold text-[#0F172A]">
                    &ldquo;{post.title}&rdquo;
                  </span>
                  ? Toàn bộ hình ảnh, tương tác và bình luận liên quan sẽ bị xóa
                  vĩnh viễn và không thể khôi phục.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F1F5F9]">
              <button
                type="button"
                disabled={deletePostMutation.isPending}
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="h-9 px-4 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#334155] transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deletePostMutation.isPending}
                onClick={async () => {
                  try {
                    await deletePostMutation.mutateAsync(post.id);
                    setIsConfirmDeleteOpen(false);
                  } catch {
                    // Handled by react-query onError toast
                  }
                }}
                className="h-9 px-4 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                {deletePostMutation.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </CommunityModalPortal>
      )}

      {/* Fullscreen Lightbox Modal for Media Inspection (Portaled to document.body, no backdrop-blur) */}
      {lightboxIndex !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xem ảnh và video chi tiết"
            className="fixed inset-0 z-[110] bg-[#0F172A]/95 flex flex-col items-center justify-center p-4 sm:p-6"
            onClick={() => setLightboxIndex(null)}
          >
            <div
              className="absolute top-4 inset-x-4 sm:inset-x-6 flex items-center justify-between text-white z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="px-3.5 py-1.5 rounded-full bg-white/15 text-xs sm:text-sm font-semibold tracking-wide">
                {lightboxIndex + 1} / {mediaList.length}
              </span>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors text-white cursor-pointer"
                aria-label="Đóng xem chi tiết"
              >
                <X className="size-5" />
              </button>
            </div>

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
                  decoding="async"
                  className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl select-none"
                />
              )}

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
                  className="absolute left-2 sm:-left-14 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-black/65 hover:bg-black/85 text-white transition-colors cursor-pointer"
                  aria-label="Ảnh trước"
                >
                  <ChevronLeft className="size-6" />
                </button>
              )}

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
                  className="absolute right-2 sm:-right-14 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-black/65 hover:bg-black/85 text-white transition-colors cursor-pointer"
                  aria-label="Ảnh tiếp theo"
                >
                  <ChevronRight className="size-6" />
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </article>
  );
}

export const PostCard = memo(PostCardComponent);

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useTogglePostLike,
  useCreatePostComment,
} from "@/features/community/hooks/use-community";
import {
  COMMUNITY_UI_CONSTANTS,
  formatRelativeTime,
  isVideoUrl,
} from "@/services/community.service";
import type { CommunityPostItem } from "@/types/community";

interface StoryViewerModalProps {
  open: boolean;
  stories: CommunityPostItem[];
  initialIndex: number;
  onClose: () => void;
  onPreviewItinerary: (post: CommunityPostItem) => void;
}

export function StoryViewerModal({
  open,
  stories,
  initialIndex,
  onClose,
  onPreviewItinerary,
}: StoryViewerModalProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [progress, setProgress] = useState(0);

  const toggleLikeMutation = useTogglePostLike();
  const createCommentMutation = useCreatePostComment();

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      setReplyText("");
    }
  }, [open, initialIndex]);

  const currentStory = stories[currentIndex] || null;

  // Auto-advance timer (pauses on hover or when typing reply)
  useEffect(() => {
    if (!open || !currentStory || isPaused || replyText.trim().length > 0) {
      return;
    }

    const tickMs = 50;
    const step = (tickMs / COMMUNITY_UI_CONSTANTS.STORY_DURATION_MS) * 100;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((idx) => idx + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [
    open,
    currentStory,
    isPaused,
    replyText,
    currentIndex,
    stories.length,
    onClose,
  ]);

  // Keyboard navigation & mobile-only scroll lock
  useEffect(() => {
    if (!open) return;
    const isDesktopLockedShell = window.innerWidth >= 1024;
    const prevOverflow = document.body.style.overflow;
    if (!isDesktopLockedShell) {
      document.body.style.overflow = "hidden";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (
        e.key === "ArrowLeft" &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
        setProgress(0);
      } else if (
        e.key === "ArrowRight" &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        if (currentIndex < stories.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          setProgress(0);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      if (!isDesktopLockedShell) {
        document.body.style.overflow = prevOverflow;
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, currentIndex, stories.length, onClose]);

  if (!open || !currentStory) return null;

  const mediaUrl =
    currentStory.mediaUrls?.[0] || currentStory.itinerary?.coverPhoto || "";
  const isVideo = isVideoUrl(mediaUrl);
  const groupOrContextLabel =
    currentStory.group?.name || COMMUNITY_UI_CONSTANTS.DEFAULT_GROUP_DISPLAY_NAME;
  const profileHref = `/community/profile/${encodeURIComponent(
    currentStory.author.username || currentStory.author.id
  )}`;

  const handleToggleLike = () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thả tim khoảnh khắc này");
      return;
    }
    toggleLikeMutation.mutate(currentStory.id);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = replyText.trim();
    if (!content) return;
    if (!user) {
      toast.error("Vui lòng đăng nhập để gửi phản hồi");
      return;
    }
    await createCommentMutation.mutateAsync({
      postId: currentStory.id,
      content,
    });
    setReplyText("");
    toast.success("Đã gửi bình luận phản hồi vào bài viết!");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Khoảnh khắc check-in của ${currentStory.author.fullName}`}
      className="fixed inset-0 z-[100] bg-[#0F172A]/75 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="relative w-full max-w-[380px] h-[640px] max-h-[90vh] rounded-[24px] overflow-hidden bg-[#0F172A] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] flex flex-col"
      >
        {/* Top Segmented Progress Bars */}
        <div className="absolute top-3 left-3 right-3 flex items-center gap-1.5 z-20">
          {stories.map((st, idx) => {
            const barWidth =
              idx < currentIndex
                ? 100
                : idx === currentIndex
                ? progress
                : 0;
            return (
              <div
                key={st.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setProgress(0);
                }}
                className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden cursor-pointer"
              >
                <div
                  className="h-full bg-white transition-[width] duration-75 ease-linear"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Header with Author & Close */}
        <div className="absolute top-[22px] left-3 right-3 flex items-center justify-between z-20 text-white">
          <Link
            href={profileHref}
            onClick={onClose}
            className="flex items-center gap-2.5 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                currentStory.author.avatarUrl ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face"
              }
              alt={currentStory.author.fullName}
              className="size-[38px] rounded-full border-2 border-white object-cover shrink-0"
            />
            <div>
              <div className="flex items-center gap-1.5 text-[13px] font-extrabold drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] group-hover:underline">
                <span>{currentStory.author.fullName}</span>
                {currentStory.author.isVerified && (
                  <i
                    className="fa-solid fa-circle-check text-[#38BDF8] text-xs"
                    title="Thổ địa được xác thực"
                  />
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] opacity-90">
                <span>
                  <i
                    className="fa-solid fa-compass text-[#38BDF8] mr-1"
                    aria-hidden="true"
                  />
                  {groupOrContextLabel}
                </span>
                <span>•</span>
                <span>{formatRelativeTime(currentStory.createdAt)}</span>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng khoảnh khắc check-in"
            className="size-8 rounded-full bg-black/40 hover:bg-black/65 border-none text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
          </button>
        </div>

        {/* Prev / Next Invisible Tap Zones */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={() => {
              setCurrentIndex((prev) => prev - 1);
              setProgress(0);
            }}
            aria-label="Khoảnh khắc trước"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-black/35 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
          </button>
        )}
        {currentIndex < stories.length - 1 && (
          <button
            type="button"
            onClick={() => {
              setCurrentIndex((prev) => prev + 1);
              setProgress(0);
            }}
            aria-label="Khoảnh khắc tiếp theo"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-black/35 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
          </button>
        )}

        {/* Main Story Photo: Dual-layer Blurred Backdrop (Adapts to 9:16, 4:3, 16:9, 1:1) */}
        <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black">
          {!isVideo && mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-[30px] brightness-60 scale-115 pointer-events-none"
            />
          )}

          {isVideo ? (
            <video
              key={mediaUrl}
              src={mediaUrl}
              autoPlay
              playsInline
              loop
              muted
              className="relative max-w-full max-h-full object-contain z-10"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt={currentStory.title}
              className="relative max-w-full max-h-full object-contain z-10"
            />
          )}

          {/* Readability Gradient Overlay */}
          <div
            className="absolute inset-0 z-12 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.02) 48%, rgba(15,23,42,0.65) 100%)",
            }}
          />
        </div>

        {/* Bottom Content & Call to Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-5 px-4 z-20 flex flex-col gap-3 text-white">
          <p className="text-[13px] leading-[1.5] font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] line-clamp-3">
            {currentStory.caption || currentStory.title}
          </p>

          {/* Attached Itinerary Link */}
          {currentStory.itinerary && (
            <div className="p-2.5 px-3 bg-white/15 backdrop-blur-md rounded-[14px] border border-white/25 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-7 rounded-[8px] bg-[#0194F3] flex items-center justify-center text-xs text-white shrink-0">
                  <i className="fa-solid fa-route" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] opacity-80 uppercase font-bold">
                    Lộ trình liên quan
                  </div>
                  <div className="text-[11px] font-extrabold truncate">
                    {currentStory.itinerary.title}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPreviewItinerary(currentStory);
                }}
                className="bg-[#0194F3] hover:bg-[#007FE3] text-white border-none rounded-full px-2.5 py-1 text-[10px] font-extrabold cursor-pointer shrink-0 transition-colors"
              >
                Xem ngay
              </button>
            </div>
          )}

          {/* Quick Interaction Bar */}
          <form
            onSubmit={handleSendReply}
            className="flex items-center justify-between pt-1"
          >
            <div className="flex items-center gap-2 flex-1 mr-3">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Gửi bình luận phản hồi..."
                aria-label="Gửi bình luận phản hồi khoảnh khắc"
                className="w-full bg-white/20 border border-white/25 rounded-full py-2 px-3.5 text-[11px] text-white placeholder:text-white/75 outline-none focus:border-[#38BDF8] focus:bg-white/25 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={handleToggleLike}
              aria-label={
                currentStory.isLiked ? "Bỏ thích khoảnh khắc" : "Thả tim khoảnh khắc"
              }
              title={`${currentStory.likeCount} lượt thích`}
              className="size-9 rounded-full bg-white/20 hover:bg-white/30 border-none text-white flex items-center justify-center cursor-pointer transition-transform active:scale-90 shrink-0"
            >
              <i
                className={`fa-solid fa-heart text-base ${
                  currentStory.isLiked ? "text-[#EF4444]" : "text-white/90"
                }`}
                aria-hidden="true"
              />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

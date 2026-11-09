"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  COMMUNITY_UI_CONSTANTS,
  formatRelativeTime,
  formatTripDuration,
  getVideoThumbnailSrc,
  isVideoUrl,
} from "@/services/community.service";
import type {
  CommunityPostItem,
  TopCreatorSummary,
} from "@/types/community";

interface CommunityRightSidebarProps {
  topClonedPosts: CommunityPostItem[];
  checkinHighlights: CommunityPostItem[];
  topCreators: TopCreatorSummary[];
  onPreviewAndClone: (post: CommunityPostItem) => void;
  onFocusHotPost?: (post: CommunityPostItem) => void;
  onOpenStoryViewer: (index: number) => void;
  onSelectMostClonedTab?: () => void;
}

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face";

export function CheckinStoriesSection({
  checkinHighlights,
  onOpenStoryViewer,
  className = "",
}: {
  checkinHighlights: CommunityPostItem[];
  onOpenStoryViewer: (index: number) => void;
  className?: string;
}) {
  const storiesScrollRef = useRef<HTMLDivElement | null>(null);

  if (checkinHighlights.length === 0) return null;

  const handleScrollStories = (direction: -1 | 1) => {
    storiesScrollRef.current?.scrollBy({
      left: direction * COMMUNITY_UI_CONSTANTS.STORY_CAROUSEL_SCROLL_STEP_PX,
      behavior: "smooth",
    });
  };

  return (
    <div
      className={`shrink-0 min-w-0 w-full rounded-[20px] border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-colors flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black tracking-[0.06em] uppercase text-[#0F172A]">
          <i
            className="fa-solid fa-camera-retro text-[#10B981] mr-1.5"
            aria-hidden="true"
          />
          Check-in Mới Nhất
        </h3>
      </div>

      <div className="relative group/carousel min-w-0 w-full">
        {/* Prev / Next Carousel Buttons (Facebook Story style) */}
        {checkinHighlights.length > 2 && (
          <>
            <button
              type="button"
              onClick={() => handleScrollStories(-1)}
              aria-label="Trượt sang trái"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 size-7 rounded-full bg-white/95 hover:bg-white border border-[#E2E8F0] text-[#0F172A] shadow-md flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScrollStories(1)}
              aria-label="Trượt sang phải"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 size-7 rounded-full bg-white/95 hover:bg-white border border-[#E2E8F0] text-[#0F172A] shadow-md flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}

        {/* Horizontal Story Reel */}
        <div
          ref={storiesScrollRef}
          className="min-w-0 w-full flex items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth pb-0.5"
        >
          {checkinHighlights.map((story, idx) => {
            const coverUrl =
              story.mediaUrls?.[0] || story.itinerary?.coverPhoto || "";
            const isVideo = isVideoUrl(coverUrl);

            return (
              <div
                key={story.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenStoryViewer(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenStoryViewer(idx);
                  }
                }}
                title={`${story.author.fullName}: ${story.title}`}
                className="relative w-[124px] h-[194px] shrink-0 snap-start rounded-[14px] overflow-hidden cursor-pointer bg-slate-900 shadow-[0_3px_8px_rgba(0,0,0,0.08)] group/story select-none"
              >
                {/* Top-Left: Facebook Story Author Avatar with Electric Sky Blue Ring */}
                <div className="absolute top-2.5 left-2.5 z-10 size-8 rounded-full p-[2px] bg-[#0194F3] shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-transform duration-200 group-hover/story:scale-105">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.author.avatarUrl || DEFAULT_AVATAR}
                    alt={story.author.fullName}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full rounded-full object-cover border border-white bg-slate-800"
                  />
                </div>

                {/* Top-Right: Media Type / Play Badge */}
                <div className="absolute top-2.5 right-2.5 size-5 rounded-full bg-black/50 flex items-center justify-center text-white text-[9px] z-10 transition-colors group-hover/story:bg-[#0194F3]">
                  <i
                    className={
                      isVideo ? "fa-solid fa-play" : "fa-solid fa-expand"
                    }
                    aria-hidden="true"
                  />
                </div>

                {/* Full-bleed 9:16 Story Media */}
                {isVideo ? (
                  <video
                    src={getVideoThumbnailSrc(coverUrl)}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover bg-slate-900 pointer-events-none transition-transform duration-300 group-hover/story:scale-[1.05]"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt={story.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/story:scale-[1.05]"
                  />
                )}

                {/* Bottom Readability Gradient + Story Title & Author Name */}
                <div
                  className="absolute inset-0 p-2.5 flex flex-col justify-end text-white z-[1]"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(2,6,23,0.9) 0%, rgba(2,6,23,0.22) 48%, rgba(2,6,23,0.25) 100%)",
                  }}
                >
                  <p className="text-[11px] font-extrabold leading-[1.28] line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {story.title}
                  </p>
                  <div className="text-[9.5px] font-semibold text-white/85 mt-1 truncate">
                    {story.author.fullName} •{" "}
                    {formatRelativeTime(story.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TopCreatorsSection({
  topCreators,
  className = "",
}: {
  topCreators: TopCreatorSummary[];
  className?: string;
}) {
  if (topCreators.length === 0) return null;

  return (
    <div
      className={`shrink-0 min-w-0 w-full rounded-[20px] border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-colors flex flex-col gap-3.5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black tracking-[0.06em] uppercase text-[#0F172A]">
          <i
            className="fa-solid fa-award text-[#F59E0B] mr-1.5"
            aria-hidden="true"
          />
          Tác Giả Nổi Bật
        </h3>
      </div>

      <div className="flex flex-col gap-3">
        {topCreators.slice(0, 3).map((creator, idx) => {
          const authorId =
            creator.author?.id || creator.id || `creator-${idx}`;
          const authorUsername =
            creator.author?.username ?? creator.username ?? null;
          const authorFullName =
            creator.author?.fullName || creator.fullName || "Thành viên";
          const authorAvatarUrl =
            creator.author?.avatarUrl ?? creator.avatarUrl ?? null;
          const authorVerified = Boolean(
            creator.author?.isVerifiedCreator ??
              creator.author?.isVerified ??
              creator.isVerifiedCreator ??
              creator.isVerified
          );
          const identifier = authorUsername || authorId;
          const profileHref = `/community/profile/${encodeURIComponent(
            identifier
          )}`;
          return (
            <div
              key={authorId}
              className="flex items-center justify-between gap-2"
            >
              <Link
                href={profileHref}
                className="flex items-center gap-2.5 min-w-0 group/cr"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={authorAvatarUrl || DEFAULT_AVATAR}
                  alt={authorFullName}
                  loading="lazy"
                  decoding="async"
                  className="size-9 rounded-full object-cover shrink-0 border border-[#E2E8F0]"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[12px] font-extrabold text-[#0F172A] group-hover/cr:text-[#0194F3] transition-colors truncate">
                    <span className="truncate">{authorFullName}</span>
                    {authorVerified && (
                      <i
                        className="fa-solid fa-circle-check text-[#0194F3] text-[11px] shrink-0"
                        title="Thổ địa được xác thực"
                      />
                    )}
                  </div>
                  <div className="text-[10px] text-[#64748B] flex items-center gap-1 truncate">
                    <i
                      className="fa-regular fa-newspaper"
                      aria-hidden="true"
                    />{" "}
                    {creator.postCount} bài •{" "}
                    <i className="fa-solid fa-route" aria-hidden="true" />{" "}
                    {creator.publicItineraryCount} lộ trình
                  </div>
                </div>
              </Link>

              <Link
                href={profileHref}
                className="bg-white hover:bg-[#F1F5F9] text-[#334155] hover:text-[#020617] border border-[#CBD5E1] font-semibold text-[11px] py-[5px] px-3 rounded-[10px] transition-colors inline-flex items-center gap-1 shrink-0"
              >
                <i className="fa-regular fa-user" aria-hidden="true" />
                <span>Xem kênh</span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CommunityRightSidebar({
  topClonedPosts,
  checkinHighlights,
  topCreators,
  onPreviewAndClone,
  onFocusHotPost,
  onOpenStoryViewer,
  onSelectMostClonedTab,
}: CommunityRightSidebarProps) {
  return (
    <aside className="sidebar-sticky hidden lg:flex flex-col gap-5 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:pb-8 community-sidebar-scroll">
      {/* BLOCK 1: LỘ TRÌNH ĐƯỢC NHÂN BẢN NHIỀU NHẤT */}
      <div className="shrink-0 rounded-[20px] border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-colors flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-black tracking-[0.06em] uppercase text-[#0F172A]">
            <i
              className="fa-solid fa-fire text-[#F97316] mr-1.5"
              aria-hidden="true"
            />
            Lộ Trình Hot Nhất
          </h3>
          {onSelectMostClonedTab && (
            <button
              type="button"
              onClick={onSelectMostClonedTab}
              className="text-[11px] font-bold text-[#0194F3] hover:text-[#007FE3] bg-transparent border-none p-0 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Xem tất cả</span>
              <i
                className="fa-solid fa-chevron-right text-[9px]"
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          {topClonedPosts.slice(0, 3).map((post) => {
            const itinerary = post.itinerary;
            const destinationLabel =
              itinerary?.areaName ||
              itinerary?.destination ||
              post.group?.name ||
              "Việt Nam";
            const durationLabel =
              formatTripDuration(
                itinerary?.startDate,
                itinerary?.endDate,
                true
              ) || "3N2Đ";

            return (
              <div
                key={post.id}
                role="button"
                tabIndex={0}
                onClick={() => onFocusHotPost?.(post)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFocusHotPost?.(post);
                  }
                }}
                title="Nhấn để chuyển tới bài đăng lộ trình này trên bảng tin"
                className="p-3 rounded-[14px] border border-[#E2E8F0] hover:border-[#0194F3] bg-white hover:bg-[#F8FAFC] flex flex-col gap-2 transition-colors cursor-pointer group/hot"
              >
                <div className="flex items-center justify-between text-[11px] text-[#64748B] font-bold">
                  <span className="truncate pr-2">
                    <i
                      className="fa-solid fa-location-dot text-[#EF4444] mr-1"
                      aria-hidden="true"
                    />
                    {destinationLabel}
                  </span>
                  <span className="text-[#0194F3] flex items-center gap-1 shrink-0">
                    <i className="fa-regular fa-clock" aria-hidden="true" />{" "}
                    {durationLabel}
                  </span>
                </div>

                <h4 className="text-[13px] font-black text-[#0F172A] group-hover/hot:text-[#0194F3] leading-[1.35] line-clamp-2 transition-colors">
                  {itinerary?.title || post.title}
                </h4>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-[#64748B] font-medium flex items-center gap-1.5">
                    <i
                      className="fa-solid fa-clone text-[#94A3B8]"
                      aria-hidden="true"
                    />{" "}
                    {post.cloneCount} lượt nhân bản
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreviewAndClone(post);
                    }}
                    className="text-[12px] font-extrabold text-[#0194F3] hover:text-[#007FE3] border-none bg-transparent cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <span>Nhân bản</span>
                    <i
                      className="fa-solid fa-arrow-right text-[10px]"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOCK 2: KHOẢNH KHẮC CHECK-IN MỚI NHẤT (FACEBOOK STORIES CAROUSEL) */}
      <CheckinStoriesSection
        checkinHighlights={checkinHighlights}
        onOpenStoryViewer={onOpenStoryViewer}
      />

      {/* BLOCK 3: TÁC GIẢ NỔI BẬT (TOP CREATORS) */}
      <TopCreatorsSection topCreators={topCreators} />
    </aside>
  );
}

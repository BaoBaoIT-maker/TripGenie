"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Film,
  Grid,
  Heart,
  Images,
  LayoutGrid,
  List,
  MapPin,
  MessageCircle,
  Play,
  Plus,
  Route,
  Share2,
  Settings,
  Sparkles,
} from "lucide-react";
import type {
  CreatorProfileData,
  CommunityPostItem,
  CommunityLinkedItinerarySummary,
} from "@/types/community";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCreatorProfile } from "@/features/community/hooks/use-community";
import { formatVnd } from "@/features/planner/model/itinerary-format";
import {
  COMMUNITY_UI_CONSTANTS,
  deriveHandleFromFullName,
  formatRelativeTime,
  formatTripDuration,
  getVideoThumbnailSrc,
  isVideoUrl,
} from "@/services/community.service";
import { toast } from "sonner";
import { EditProfileModal } from "./EditProfileModal";
import { CreatePostModal } from "./CreatePostModal";
import { PostDetailModal } from "./PostDetailModal";
import { CloneItineraryPreviewModal } from "./CloneItineraryPreviewModal";
import { PostCard } from "./PostCard";

interface CreatorProfileClientShellProps {
  initialProfile: CreatorProfileData;
  identifier: string;
}

export function CreatorProfileClientShell({
  initialProfile,
  identifier,
}: CreatorProfileClientShellProps) {
  const { user: currentUser } = useAuth();
  const { data: liveProfile } = useCreatorProfile(identifier, initialProfile);
  const [overrideUser, setOverrideUser] = useState<Partial<
    CreatorProfileData["user"]
  > | null>(null);

  const profile = liveProfile || initialProfile;
  const targetUser = useMemo(
    () => ({
      ...profile.user,
      ...(overrideUser || {}),
    }),
    [profile.user, overrideUser]
  );
  const stats = profile.stats;
  const posts = profile.posts || [];
  const publicItineraries = profile.publicItineraries || [];

  const displayHandle = useMemo(() => {
    if (targetUser.username) return `@${targetUser.username}`;
    return deriveHandleFromFullName(targetUser.fullName);
  }, [targetUser.username, targetUser.fullName]);

  // Determine if viewing own profile
  const isMe = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.id === targetUser.id) return true;
    if (
      currentUser.username &&
      targetUser.username &&
      currentUser.username.toLowerCase() === targetUser.username.toLowerCase()
    ) {
      return true;
    }
    return false;
  }, [currentUser, targetUser]);

  // Tab & Layout States
  const [activeTab, setActiveTab] = useState<"posts" | "itineraries">("posts");
  const [postsLayout, setPostsLayout] = useState<"grid" | "feed">("grid");

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPostForDetail, setSelectedPostForDetail] =
    useState<CommunityPostItem | null>(null);
  const [selectedItinForClone, setSelectedItinForClone] =
    useState<CommunityLinkedItinerarySummary | null>(null);

  const itinerariesSectionRef = useRef<HTMLDivElement | null>(null);

  // Switch to itineraries tab with smooth scroll
  const handleExploreItineraries = useCallback(() => {
    setActiveTab("itineraries");
    setTimeout(() => {
      itinerariesSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }, []);

  // Share profile handler
  const handleShareProfile = useCallback(() => {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      navigator
        .share({
          title: `${targetUser.fullName} (${displayHandle}) • Hồ sơ Thổ địa | TripGenie`,
          text: `Khám phá các bài chia sẻ và lộ trình du lịch thực tế của ${targetUser.fullName} trên TripGenie!`,
          url: currentUrl,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(currentUrl);
      toast.success("Đã sao chép liên kết trang cá nhân vào bộ nhớ tạm!");
    }
  }, [targetUser]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            href="/community"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#475569] hover:text-[#0F172A] transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Cộng đồng TripGenie</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[960px] mx-auto w-full px-4 sm:px-6 py-6 pb-20 flex-1">
        {/* ========================================================= */}
        {/* PROFILE HEADER CARD (Instagram Profile Layout)            */}
        {/* ========================================================= */}
        <section className="bg-white border border-[#E2E8F0] rounded-[20px] p-6 sm:p-8 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col items-center text-center max-w-[600px] mx-auto">
            {/* Avatar Tròn với Vòng Viền Gradient Electric Sky Blue */}
            <div className="relative mb-3.5">
              <div className="size-[100px] rounded-full p-[3px] bg-gradient-to-br from-[#0194F3] to-[#38BDF8] shadow-[0_4px_14px_rgba(1,148,243,0.22)]">
                <div className="relative size-full rounded-full overflow-hidden border-[3px] border-white bg-[#F1F5F9]">
                  {targetUser.avatarUrl ? (
                    <Image
                      src={targetUser.avatarUrl}
                      alt={targetUser.fullName}
                      fill
                      sizes="100px"
                      className="object-cover"
                      unoptimized
                      priority
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center font-bold text-2xl text-[#64748B] bg-[#E2E8F0]">
                      {targetUser.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Nút camera đổi avatar nếu là chủ tài khoản */}
              {isMe && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  title="Cập nhật ảnh đại diện"
                  className="absolute bottom-0.5 right-0.5 size-7 rounded-full bg-[#0194F3] text-white flex items-center justify-center text-[12px] border-2 border-white cursor-pointer hover:scale-105 transition-transform"
                >
                  <Camera className="size-3.5" />
                </button>
              )}
            </div>

            {/* TẦNG 1: USERNAME & BADGE XÁC THỰC */}
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <h1 className="text-[19px] font-bold text-[#0F172A] tracking-[-0.01em]">
                {displayHandle}
              </h1>
              {targetUser.isVerifiedCreator && (
                <span
                  title="Thổ địa được xác thực bởi TripGenie"
                  className="text-[#0194F3] text-[16px] inline-flex items-center"
                >
                  <i
                    className="fa-solid fa-circle-check"
                    aria-hidden="true"
                  />
                </span>
              )}
            </div>

            {/* TẦNG 2: HỌ VÀ TÊN & TIỂU SỬ */}
            <div className="text-[14.5px] font-semibold text-[#1E293B] mb-2">
              {targetUser.fullName}
            </div>

            <p className="text-[13.5px] text-[#475569] leading-relaxed mb-5 max-w-[500px]">
              {targetUser.bio ||
                "Người đam mê xê dịch, chia sẻ lộ trình du lịch thực tế và điểm đến bản địa trên TripGenie."}
            </p>

            {/* TẦNG 3: BỘ 3 CHỈ SỐ STATS (BÀI ĐĂNG - LƯỢT THÍCH - NHÂN BẢN) */}
            {/* Đã bỏ hoàn toàn icon ở số nhân bản theo chỉ đạo */}
            <div className="grid grid-cols-3 w-full max-w-[440px] py-3 px-4 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0] mb-5">
              {/* Cột 1: Bài đăng */}
              <div className="text-center">
                <div className="text-[17px] font-bold text-[#0F172A]">
                  {stats.postCount}
                </div>
                <div className="text-[12px] font-medium text-[#64748B] mt-0.5">
                  Bài đăng
                </div>
              </div>

              {/* Cột 2: Lượt thích */}
              <div className="text-center border-x border-[#E2E8F0]">
                <div className="text-[17px] font-bold text-[#0F172A]">
                  {stats.totalLikesReceived >= 1000
                    ? `${(stats.totalLikesReceived / 1000).toFixed(1)}K`
                    : stats.totalLikesReceived}
                </div>
                <div className="text-[12px] font-medium text-[#64748B] mt-0.5">
                  Lượt thích
                </div>
              </div>

              {/* Cột 3: Nhân bản (KHÔNG CÓ ICON) */}
              <div className="text-center">
                <div className="text-[17px] font-bold text-[#0F172A]">
                  {stats.totalClonesReceived}
                </div>
                <div className="text-[12px] font-medium text-[#64748B] mt-0.5">
                  Nhân bản
                </div>
              </div>
            </div>

            {/* TẦNG 4: HÀNG NÚT HÀNH ĐỘNG (ACTION BUTTONS ROW) */}
            {isMe ? (
              // Dành cho chủ tài khoản (Owner View)
              <div className="flex items-center justify-center gap-2 w-full max-w-[460px]">
                {/* Nút 1: Chỉnh sửa hồ sơ */}
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex-1 h-[38px] rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] hover:border-[#CBD5E1] text-[13px] font-semibold text-[#334155] inline-flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <i
                    className="fa-regular fa-pen-to-square text-[13px]"
                    aria-hidden="true"
                  />
                  <span>Chỉnh sửa hồ sơ</span>
                </button>

                {/* Nút 2: Thêm bài viết */}
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex-1 h-[38px] rounded-[10px] bg-[#0F172A] hover:bg-[#1E293B] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 cursor-pointer shadow-[0_1px_3px_rgba(15,23,42,0.1)] transition-all"
                >
                  <Plus className="size-4" />
                  <span>Thêm bài viết</span>
                </button>

                {/* Nút 3: Bánh răng Cài đặt tài khoản (Đứng trước nút chia sẻ) */}
                <Link
                  href="/profile"
                  title="Cài đặt tài khoản tổng"
                  className="size-[38px] shrink-0 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] hover:border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] inline-flex items-center justify-center transition-colors"
                >
                  <i
                    className="fa-solid fa-gear text-[15px]"
                    aria-hidden="true"
                  />
                </Link>

                {/* Nút 4: Chia sẻ hồ sơ (fa-solid fa-share) */}
                <button
                  type="button"
                  onClick={handleShareProfile}
                  title="Chia sẻ trang cá nhân này"
                  className="size-[38px] shrink-0 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] hover:border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] inline-flex items-center justify-center cursor-pointer transition-colors"
                >
                  <i
                    className="fa-solid fa-share text-[14px]"
                    aria-hidden="true"
                  />
                </button>
              </div>
            ) : (
              // Dành cho khách xem (Visitor View)
              <div className="flex items-center justify-center gap-2.5 w-full max-w-[440px]">
                <button
                  type="button"
                  onClick={handleExploreItineraries}
                  className="flex-[1.2] h-[38px] rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 cursor-pointer shadow-[0_1px_3px_rgba(1,148,243,0.2)] transition-all"
                >
                  <i
                    className="fa-solid fa-map-location-dot text-[14px]"
                    aria-hidden="true"
                  />
                  <span>Khám phá lịch trình</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareProfile}
                  className="flex-1 h-[38px] rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] hover:border-[#CBD5E1] text-[13px] font-semibold text-[#334155] inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <i
                    className="fa-solid fa-share text-[14px]"
                    aria-hidden="true"
                  />
                  <span>Chia sẻ hồ sơ</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* TẦNG 5: 2 TAB INSTAGRAM (BÀI ĐĂNG & LỊCH TRÌNH CÔNG KHAI) */}
        {/* ========================================================= */}
        <section
          ref={itinerariesSectionRef}
          className="bg-white border border-[#E2E8F0] rounded-[20px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] min-h-[460px]"
        >
          {/* Tab Navigation Header */}
          <div className="flex items-center justify-between border-b border-[#E2E8F0] mb-5 flex-wrap gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Tab 1: Bài đăng */}
              <button
                type="button"
                onClick={() => setActiveTab("posts")}
                className={`py-3 px-3 sm:px-4 text-[13.5px] font-medium border-b-2 inline-flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === "posts"
                    ? "text-[#0194F3] border-[#0194F3] font-semibold"
                    : "text-[#64748B] border-transparent hover:text-[#0F172A]"
                }`}
              >
                <i
                  className="fa-solid fa-table-cells text-[14px]"
                  aria-hidden="true"
                />
                <span>Bài đăng</span>
                <span
                  className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-full ${
                    activeTab === "posts"
                      ? "bg-[#F0F7FF] text-[#0194F3]"
                      : "bg-[#F1F5F9] text-[#64748B]"
                  }`}
                >
                  {posts.length}
                </span>
              </button>

              {/* Tab 2: Lịch trình công khai */}
              <button
                type="button"
                onClick={() => setActiveTab("itineraries")}
                className={`py-3 px-3 sm:px-4 text-[13.5px] font-medium border-b-2 inline-flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === "itineraries"
                    ? "text-[#0194F3] border-[#0194F3] font-semibold"
                    : "text-[#64748B] border-transparent hover:text-[#0F172A]"
                }`}
              >
                <i
                  className="fa-solid fa-map-location-dot text-[14px]"
                  aria-hidden="true"
                />
                <span>Lịch trình công khai</span>
                <span
                  className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-full ${
                    activeTab === "itineraries"
                      ? "bg-[#F0F7FF] text-[#0194F3]"
                      : "bg-[#F1F5F9] text-[#64748B]"
                  }`}
                >
                  {publicItineraries.length}
                </span>
              </button>
            </div>

            {/* Toggle chế độ xem Grid / Feed khi ở Tab Bài đăng */}
            {activeTab === "posts" && posts.length > 0 && (
              <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-[8px]">
                <button
                  type="button"
                  onClick={() => setPostsLayout("grid")}
                  title="Xem dạng Lưới ảnh 3 cột Instagram"
                  className={`size-8 rounded-[6px] inline-flex items-center justify-center text-[13px] transition-all cursor-pointer ${
                    postsLayout === "grid"
                      ? "bg-white text-[#0F172A] shadow-sm font-bold"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPostsLayout("feed")}
                  title="Xem dạng Danh sách bài viết đầy đủ"
                  className={`size-8 rounded-[6px] inline-flex items-center justify-center text-[13px] transition-all cursor-pointer ${
                    postsLayout === "feed"
                      ? "bg-white text-[#0F172A] shadow-sm font-bold"
                      : "text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  <List className="size-4" />
                </button>
              </div>
            )}
          </div>

          {/* TAB 1 CONTENT: BÀI ĐĂNG */}
          {activeTab === "posts" && (
            <div>
              {posts.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="size-14 rounded-full bg-[#F1F5F9] text-[#94A3B8] inline-flex items-center justify-center text-2xl mb-3">
                    <i className="fa-solid fa-camera" aria-hidden="true" />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#0F172A] mb-1">
                    Chưa có bài viết nào
                  </h3>
                  <p className="text-[12.5px] text-[#64748B] max-w-[340px] mx-auto mb-4">
                    {isMe
                      ? "Chia sẻ chuyến đi, trải nghiệm săn mây hoặc ẩm thực đầu tiên của bạn!"
                      : "Tác giả chưa chia sẻ bài viết nào trên cộng đồng."}
                  </p>
                  {isMe && (
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(true)}
                      className="h-9 px-4 rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Plus className="size-4" />
                      <span>Tạo bài viết ngay</span>
                    </button>
                  )}
                </div>
              ) : postsLayout === "grid" ? (
                // Instagram 3-Column Square Grid
                <div className="grid grid-cols-3 gap-1 sm:gap-2 rounded-[12px] overflow-hidden">
                  {posts.map((post) => {
                    const firstMedia = post.mediaUrls?.[0] || "";
                    const isVideo = isVideoUrl(firstMedia);
                    const isMultiple = (post.mediaUrls?.length || 0) > 1;

                    return (
                      <div
                        key={post.id}
                        onClick={() => setSelectedPostForDetail(post)}
                        className="group relative aspect-square bg-[#E2E8F0] overflow-hidden cursor-pointer"
                      >
                        {isVideo ? (
                          <video
                            src={firstMedia}
                            className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                            muted
                            playsInline
                          />
                        ) : firstMedia ? (
                          <Image
                            src={firstMedia}
                            alt={post.title}
                            fill
                            sizes="(max-width: 768px) 33vw, 300px"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            unoptimized
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center p-3 text-center bg-[#F1F5F9] text-[#64748B] text-[12px] font-medium">
                            {post.title}
                          </div>
                        )}

                        {/* Video Badge */}
                        {isVideo && (
                          <span className="absolute top-2 right-2 size-6 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px]">
                            <Play className="size-3 fill-current ml-0.5" />
                          </span>
                        )}

                        {/* Multi-photo Album Badge */}
                        {!isVideo && isMultiple && (
                          <span className="absolute top-2 right-2 size-6 rounded-[6px] bg-black/60 text-white flex items-center justify-center text-[11px]">
                            <Images className="size-3.5" />
                          </span>
                        )}

                        {/* Instagram Hover Overlay (Likes & Comments) */}
                        <div className="absolute inset-0 bg-[#0F172A]/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 sm:gap-6 text-white text-[13.5px] font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            <Heart className="size-4 fill-white" />
                            <span>{post.likeCount}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MessageCircle className="size-4 fill-white" />
                            <span>{post.commentCount}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Full-width Vertical Feed Cards
                <div className="space-y-4 max-w-[640px] mx-auto">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onOpenDetail={(targetPost) =>
                        setSelectedPostForDetail(targetPost)
                      }
                      onOpenClonePreview={() => {
                        if (post.itinerary) {
                          setSelectedItinForClone(post.itinerary);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2 CONTENT: LỊCH TRÌNH CÔNG KHAI */}
          {activeTab === "itineraries" && (
            <div>
              {publicItineraries.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="size-14 rounded-full bg-[#F1F5F9] text-[#94A3B8] inline-flex items-center justify-center text-2xl mb-3">
                    <Route className="size-7" />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#0F172A] mb-1">
                    Chưa có lịch trình công khai
                  </h3>
                  <p className="text-[12.5px] text-[#64748B] max-w-[340px] mx-auto">
                    {isMe
                      ? "Tạo và công khai lịch trình du lịch của bạn trong Trình lập kế hoạch (Planner) để cộng đồng cùng nhân bản trải nghiệm!"
                      : "Thổ địa chưa chia sẻ lịch trình công khai nào."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publicItineraries.map((itin) => (
                    <div
                      key={itin.id}
                      className="border border-[#E2E8F0] hover:border-[#0194F3] rounded-[16px] p-4 bg-white flex flex-col justify-between gap-3.5 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <div>
                        {/* Destination pill & duration */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#F0F7FF] text-[#0194F3] text-[11px] font-bold">
                            <MapPin className="size-3" />
                            <span>{itin.destination || itin.areaName || "Điểm đến"}</span>
                          </span>
                          <span className="text-[11.5px] font-medium text-[#64748B]">
                            {formatTripDuration(itin.startDate, itin.endDate, true) ||
                              `${itin.totalPlaces || 0} Điểm`}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-[14.5px] font-bold text-[#0F172A] line-clamp-2 leading-snug mb-1.5">
                          {itin.title}
                        </h3>

                        {/* Estimated Budget & Clones */}
                        <p className="text-[12px] text-[#64748B]">
                          Ước tính:{" "}
                          <strong className="text-[#0F172A] font-semibold">
                            {formatVnd(itin.estimatedCost || 0)}
                          </strong>
                          {itin.totalPlaces > 0 && ` • ${itin.totalPlaces} Điểm`}
                        </p>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                        <Link
                          href={`/planner/${itin.id}`}
                          className="h-[34px] px-3 rounded-[8px] border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] text-[12px] font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Xem chi tiết</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setSelectedItinForClone(itin)}
                          className="h-[34px] px-3.5 rounded-[8px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-[0_1px_3px_rgba(1,148,243,0.2)] transition-all"
                        >
                          <i
                            className="fa-solid fa-clone text-[11px]"
                            aria-hidden="true"
                          />
                          <span>Dùng mẫu</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ========================================================= */}
      {/* MODALS REUSED & INTEGRATED                                */}
      {/* ========================================================= */}

      {/* 1. Quick Edit Profile Modal */}
      {isMe && (
        <EditProfileModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdated={(updated) => {
            setOverrideUser((prev) => ({
              ...(prev || {}),
              fullName: updated.fullName,
              bio: updated.bio,
              avatarUrl: updated.avatarUrl,
            }));
          }}
          initialData={{
            fullName: targetUser.fullName,
            username: targetUser.username,
            avatarUrl: targetUser.avatarUrl,
            bio: targetUser.bio,
          }}
        />
      )}

      {/* 2. Reused Create Post Modal */}
      {isMe && (
        <CreatePostModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {/* 3. Reused Post Detail Modal */}
      {selectedPostForDetail && (
        <PostDetailModal
          open={Boolean(selectedPostForDetail)}
          onClose={() => setSelectedPostForDetail(null)}
          post={selectedPostForDetail}
          onOpenClonePreview={() => {
            if (selectedPostForDetail.itinerary) {
              setSelectedItinForClone(selectedPostForDetail.itinerary);
            }
          }}
        />
      )}

      {/* 4. Reused Clone Itinerary Preview Modal */}
      {selectedItinForClone && (
        <CloneItineraryPreviewModal
          open={Boolean(selectedItinForClone)}
          onClose={() => setSelectedItinForClone(null)}
          itinerarySummary={selectedItinForClone}
        />
      )}
    </div>
  );
}

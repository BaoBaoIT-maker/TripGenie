"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Compass,
  RefreshCw,
  CheckCircle2,
  Users,
  X,
  MapPin,
  Hash,
} from "lucide-react";
import {
  POPULAR_COMMUNITY_TAGS,
  POPULAR_COMMUNITY_DESTINATIONS,
  normalizeKeyword,
} from "@/features/community/config/community-suggestions";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/community/PostCard";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import { CreateGroupModal } from "@/components/community/CreateGroupModal";
import { PostDetailModal } from "@/components/community/PostDetailModal";
import { EditPostModal } from "@/components/community/EditPostModal";
import { ReportPostModal } from "@/components/community/ReportPostModal";
import {
  CommunityLeftSidebar,
  MobileTopicGroupsStrip,
} from "@/components/community/CommunityLeftSidebar";
import {
  CommunityRightSidebar,
  CheckinStoriesSection,
  TopCreatorsSection,
} from "@/components/community/CommunityRightSidebar";
import { StoryViewerModal } from "@/components/community/StoryViewerModal";
import { CloneItineraryPreviewModal } from "@/components/community/CloneItineraryPreviewModal";
import { CommunityFeedCardSkeleton } from "@/components/community/CommunityPageSkeleton";
import {
  useCommunityFeed,
  useCommunityPost,
  useCommunitySidebarDiscovery,
} from "@/features/community/hooks/use-community";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { COMMUNITY_UI_CONSTANTS } from "@/services/community.service";
import type {
  CommunityFeedResponse,
  CommunityPostItem,
  CommunitySortMode,
  SidebarDiscoveryResponse,
} from "@/types/community";
import { toast } from "sonner";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CommunityClientShellProps {
  initialSidebarDiscovery?: SidebarDiscoveryResponse | null;
  initialFeedFirstPage?: CommunityFeedResponse | null;
}

export function CommunityClientShell({
  initialSidebarDiscovery = null,
  initialFeedFirstPage = null,
}: CommunityClientShellProps) {
  const { user } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const currentUser = isMounted ? user : null;
  const isAdmin = currentUser?.role === "ADMIN";

  const router = useRouter();
  const searchParams = useSearchParams();
  const feedScrollRef = useRef<HTMLElement | null>(null);

  const [sort, setSort] = useState<CommunitySortMode>("LATEST");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Singleton Modal States (Zero per-card modal instances in the feed)
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeInitialFiles, setComposeInitialFiles] = useState<File[]>([]);
  const [composeFocusItinerary, setComposeFocusItinerary] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [previewPostForClone, setPreviewPostForClone] =
    useState<CommunityPostItem | null>(null);
  const [activeDetailPost, setActiveDetailPost] =
    useState<CommunityPostItem | null>(null);
  const [activeEditPost, setActiveEditPost] =
    useState<CommunityPostItem | null>(null);
  const [activeReportPost, setActiveReportPost] =
    useState<CommunityPostItem | null>(null);
  const [pendingFocusPostId, setPendingFocusPostId] = useState<string | null>(
    null
  );
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  // Memoized search suggestions (Tags & Destinations)
  const { suggestedSearchTags, suggestedDestinations } = useMemo(() => {
    const trimmedSearch = searchInput.trim();
    const rawSearchKeyword = trimmedSearch.replace(/^[@#]/, "");
    const normalizedSearch = normalizeKeyword(rawSearchKeyword);
    const isSearchingHash = trimmedSearch.startsWith("#");
    const isSearchingAt = trimmedSearch.startsWith("@");

    if (normalizedSearch.length === 0 || isSearchingAt) {
      return { suggestedSearchTags: [], suggestedDestinations: [] };
    }

    const tags = POPULAR_COMMUNITY_TAGS.filter((tag) =>
      normalizeKeyword(tag.replace(/^#/, "")).includes(normalizedSearch)
    ).slice(0, 5);

    const destinations = !isSearchingHash
      ? POPULAR_COMMUNITY_DESTINATIONS.filter(
          (dest) =>
            normalizeKeyword(dest.name).includes(normalizedSearch) ||
            normalizeKeyword(dest.province).includes(normalizedSearch)
        ).slice(0, 4)
      : [];

    return { suggestedSearchTags: tags, suggestedDestinations: destinations };
  }, [searchInput]);

  const hasSearchSuggestions =
    suggestedSearchTags.length > 0 || suggestedDestinations.length > 0;

  const handleSelectSearchTag = (tag: string) => {
    setSearchInput(tag);
    setAppliedSearch(tag);
    setIsSearchDropdownOpen(false);
  };

  const handleSelectDestination = (destName: string) => {
    setSearchInput(destName);
    setAppliedSearch(destName);
    setIsSearchDropdownOpen(false);
  };

  // Deep linking: read postId and commentId from URL
  const deepPostId = searchParams.get("postId");
  const deepCommentId = searchParams.get("commentId");
  const isValidPostId = deepPostId ? UUID_REGEX.test(deepPostId) : false;

  const { data: deepPost, isError: isDeepPostError } = useCommunityPost(
    isValidPostId ? deepPostId : null,
    Boolean(isValidPostId)
  );

  const handleCloseDeepLinkModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("postId");
    params.delete("commentId");
    const nextQs = params.toString();
    router.replace(`/community${nextQs ? `?${nextQs}` : ""}`, {
      scroll: false,
    });
  }, [router, searchParams]);

  useEffect(() => {
    if (deepPostId && !isValidPostId) {
      toast.error("Đường dẫn bài viết không hợp lệ");
      handleCloseDeepLinkModal();
    } else if (isDeepPostError) {
      toast.error("Bài viết không còn tồn tại hoặc đã bị xóa");
      handleCloseDeepLinkModal();
    }
  }, [deepPostId, isValidPostId, isDeepPostError, handleCloseDeepLinkModal]);

  // Click outside to close search suggestions dropdown
  useEffect(() => {
    if (!isSearchDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchDropdownOpen]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchInput.trim());
    }, COMMUNITY_UI_CONSTANTS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Consolidated Sidebar Discovery Query (seeded with SSR data when available)
  const { data: sidebarData } = useCommunitySidebarDiscovery(
    initialSidebarDiscovery
  );

  const groups = sidebarData?.groups ?? [];
  const topClonedPosts = sidebarData?.topClonedPosts ?? [];
  const checkinHighlights = sidebarData?.checkinHighlights ?? [];
  const topCreators = sidebarData?.topCreators ?? [];

  // Only use SSR initialFeedFirstPage when on default filters (LATEST, no group/tag/search)
  const isDefaultFeedQuery =
    sort === "LATEST" &&
    !selectedGroupId &&
    !selectedTag &&
    !appliedSearch;

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCommunityFeed(
    {
      sort,
      groupId: selectedGroupId || undefined,
      tag: selectedTag || undefined,
      search: appliedSearch || undefined,
      limit: COMMUNITY_UI_CONSTANTS.DEFAULT_FEED_PAGE_SIZE,
    },
    isDefaultFeedQuery ? initialFeedFirstPage : null
  );

  const allPosts = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data?.pages]
  );
  const matchedCreators = data?.pages[0]?.matchedCreators ?? [];
  const hasActiveFilter = Boolean(
    appliedSearch || selectedTag || selectedGroupId
  );

  // Keep singleton detail/edit post synchronized with optimistic React Query cache updates
  const liveActiveDetailPost = useMemo(
    () =>
      activeDetailPost
        ? allPosts.find((p) => p.id === activeDetailPost.id) ?? activeDetailPost
        : null,
    [activeDetailPost, allPosts]
  );

  const liveActiveEditPost = useMemo(
    () =>
      activeEditPost
        ? allPosts.find((p) => p.id === activeEditPost.id) ?? activeEditPost
        : null,
    [activeEditPost, allPosts]
  );

  const activeGroupObj = groups.find(
    (g) => g.slug === selectedGroupId || g.id === selectedGroupId
  );

  const scrollFeedToTop = useCallback(() => {
    if (feedScrollRef.current) {
      feedScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSelectGroup = useCallback(
    (groupSlugOrId: string) => {
      const clickedGroup = groups.find(
        (g) => g.slug === groupSlugOrId || g.id === groupSlugOrId
      );
      if (clickedGroup?.isDefault) {
        setSelectedGroupId("");
      } else {
        setSelectedGroupId((prev) =>
          prev === groupSlugOrId ? "" : groupSlugOrId
        );
      }
      scrollFeedToTop();
    },
    [groups, scrollFeedToTop]
  );

  const handleOpenComposer = (focusItinerary = false) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để đăng bài chia sẻ lên cộng đồng");
      return;
    }
    setComposeInitialFiles([]);
    setComposeFocusItinerary(focusItinerary);
    setIsComposeOpen(true);
  };

  const handlePickFiles = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Vui lòng đăng nhập để đăng bài chia sẻ lên cộng đồng");
      return;
    }
    fileInputRef.current?.click();
  };

  const handlePickMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Vui lòng đăng nhập để đăng bài chia sẻ lên cộng đồng");
      return;
    }
    mediaInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      setComposeInitialFiles(Array.from(fileList));
      setComposeFocusItinerary(false);
      setIsComposeOpen(true);
    }
    e.target.value = "";
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedTag("");
    setSelectedGroupId("");
  };

  const handleSelectTagFromPost = useCallback(
    (tag: string) => {
      const normalized = tag.startsWith("#") ? tag : `#${tag}`;
      setSelectedTag((prev) => (prev === normalized ? "" : normalized));
      scrollFeedToTop();
    },
    [scrollFeedToTop]
  );

  const handleOpenPostDetail = useCallback((post: CommunityPostItem) => {
    setActiveDetailPost(post);
  }, []);

  const handleOpenClonePreview = useCallback((post: CommunityPostItem) => {
    setPreviewPostForClone(post);
  }, []);

  const handleOpenEditPost = useCallback((post: CommunityPostItem) => {
    setActiveEditPost(post);
  }, []);

  const handleOpenReportPost = useCallback((post: CommunityPostItem) => {
    setActiveReportPost(post);
  }, []);

  const handleFocusHotPost = useCallback((post: CommunityPostItem) => {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedTag("");
    setSelectedGroupId("");
    setSort("MOST_CLONED");
    setPendingFocusPostId(post.id);
  }, []);

  useEffect(() => {
    if (!pendingFocusPostId || sort !== "MOST_CLONED" || isLoading) return;

    const frameId = requestAnimationFrame(() => {
      const targetEl = document.getElementById(
        `community-post-${pendingFocusPostId}`
      );
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedPostId(pendingFocusPostId);
        setPendingFocusPostId(null);
      } else {
        const matchedPost = topClonedPosts.find(
          (p) => p.id === pendingFocusPostId
        );
        if (matchedPost) {
          setActiveDetailPost(matchedPost);
        }
        setPendingFocusPostId(null);
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [pendingFocusPostId, sort, isLoading, allPosts, topClonedPosts]);

  useEffect(() => {
    if (!highlightedPostId) return;
    const timer = setTimeout(() => {
      setHighlightedPostId(null);
    }, COMMUNITY_UI_CONSTANTS.POST_HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [highlightedPostId]);

  return (
    <div className="w-full overflow-x-hidden bg-[#F8FAFC] text-[#0F172A] lg:h-[calc(100vh-70px)] lg:overflow-hidden">
      <div className="max-w-[1320px] mx-auto px-3 sm:px-4 pt-4 pb-16 lg:pb-0 lg:h-full lg:overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_310px] gap-6 lg:h-full lg:overflow-hidden items-stretch">
          {/* ==================== CỘT TRÁI (LEFT SIDEBAR: 280px) ==================== */}
          <CommunityLeftSidebar
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={handleSelectGroup}
            onOpenCreatePostWithItinerary={() => handleOpenComposer(true)}
            onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
            isAdmin={isAdmin}
          />

          {/* ==================== CỘT GIỮA (MAIN FEED STREAM: 1fr) ==================== */}
          <section
            ref={feedScrollRef}
            className="min-w-0 w-full flex flex-col gap-5 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-1.5 lg:pb-16 community-feed-scroll"
          >
            {/* ==================== QUICK COMPOSER BOX ==================== */}
            <div
              id="quickComposer"
              className="shrink-0 min-w-0 w-full bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-[20px] px-4 sm:px-5 py-4 shadow-[0_2px_6px_rgba(0,0,0,0.02)] transition-colors"
            >
              {/* Tầng trên: Avatar + Input với icon mặt cười cảm xúc */}
              <div className="flex items-center gap-3 min-w-0">
                {currentUser ? (
                  <Link
                    href={`/community/profile/${encodeURIComponent(
                      currentUser.username || currentUser.id
                    )}`}
                    title="Xem trang cá nhân của bạn"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        currentUser.avatarUrl ||
                        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face"
                      }
                      alt={currentUser.fullName}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#E2E8F0]"
                    />
                  </Link>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face"
                    alt="Khách"
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#E2E8F0]"
                  />
                )}

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenComposer(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenComposer(false);
                    }
                  }}
                  className="flex-1 min-w-0 h-11 px-3.5 sm:px-4 rounded-[14px] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] hover:border-[#CBD5E1] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="text-[13px] text-[#64748B] truncate select-none">
                    {currentUser
                      ? `${currentUser.fullName} ơi, chia sẻ ảnh, video hoặc lộ trình chuyến đi vừa qua nhé...`
                      : "Khánh Linh ơi, chia sẻ ảnh, video hoặc lộ trình chuyến đi vừa qua nhé..."}
                  </span>
                  <i className="fa-regular fa-face-smile text-[#94A3B8] text-[17px] ml-2.5 shrink-0" />
                </div>
              </div>

              {/* Tầng dưới: Các công cụ với icon màu đen than chì chuyên nghiệp + Nút Đăng bài viên thuốc đen */}
              <div className="mt-3.5 pt-3.5 border-t border-[#F1F5F9] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1 flex-wrap min-w-0">
                  {/* Nút Tệp */}
                  <button
                    type="button"
                    onClick={handlePickFiles}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-[10px] bg-transparent hover:bg-[#F1F5F9] text-[12px] font-semibold text-[#334155] hover:text-[#0F172A] transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-folder text-[#0F172A] text-[14px]" />
                    <span>Tệp</span>
                  </button>

                  {/* Nút Ảnh / Video */}
                  <button
                    type="button"
                    onClick={handlePickMedia}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-[10px] bg-transparent hover:bg-[#F1F5F9] text-[12px] font-semibold text-[#334155] hover:text-[#0F172A] transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-image text-[#0F172A] text-[14px]" />
                    <span>Ảnh / Video</span>
                  </button>

                  {/* Nút Lịch trình */}
                  <button
                    type="button"
                    onClick={() => handleOpenComposer(true)}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-[10px] bg-transparent hover:bg-[#F1F5F9] text-[12px] font-semibold text-[#334155] hover:text-[#0F172A] transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-route text-[#0F172A] text-[14px]" />
                    <span>Lịch trình</span>
                  </button>
                </div>

                {/* Nút Đăng bài viên thuốc màu đen */}
                <button
                  type="button"
                  onClick={() => handleOpenComposer(false)}
                  className="bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-full px-5 sm:px-[26px] py-2 text-[13px] font-extrabold inline-flex items-center gap-2 transition-colors shadow-[0_2px_6px_rgba(15,23,42,0.15)] active:scale-95 cursor-pointer shrink-0"
                >
                  <span>Đăng bài</span>
                </button>
              </div>
            </div>

            {/* ==================== MOBILE TẦNG 2: CHECK-IN MỚI NHẤT (STORIES) ==================== */}
            <CheckinStoriesSection
              checkinHighlights={checkinHighlights}
              onOpenStoryViewer={(idx) => setActiveStoryIndex(idx)}
              className="lg:hidden"
            />

            {/* ==================== TOOLBAR: TÌM KIẾM, CHỦ ĐỀ (MOBILE) & TABS SẮP XẾP ==================== */}
            <div className="shrink-0 min-w-0 w-full flex items-center justify-between gap-3 bg-white px-3 py-2.5 lg:py-2 rounded-2xl border border-[#E2E8F0] flex-wrap">
              {/* Tabs Sắp xếp: trên PC nằm bên trái (lg:order-1), trên Mobile nằm dưới ô tìm kiếm & dải chủ đề (order-3) */}
              <div className="order-3 lg:order-1 min-w-0 max-w-full w-full lg:w-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSort("LATEST")}
                  className={`px-3.5 py-2 rounded-[10px] text-[12px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                    sort === "LATEST"
                      ? "bg-[#0194F3] text-white"
                      : "bg-transparent text-[#475569] hover:bg-[#F1F5F9]"
                  }`}
                >
                  <i className="fa-regular fa-clock" />
                  <span>Mới nhất</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSort("TRENDING")}
                  className={`px-3.5 py-2 rounded-[10px] text-[12px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                    sort === "TRENDING"
                      ? "bg-[#0194F3] text-white"
                      : "bg-transparent text-[#475569] hover:bg-[#F1F5F9]"
                  }`}
                >
                  <i
                    className={`fa-solid fa-fire ${
                      sort === "TRENDING" ? "text-white" : "text-[#F97316]"
                    }`}
                  />
                  <span>Thịnh hành</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSort("MOST_CLONED")}
                  className={`px-3.5 py-2 rounded-[10px] text-[12px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                    sort === "MOST_CLONED"
                      ? "bg-[#0194F3] text-white"
                      : "bg-transparent text-[#475569] hover:bg-[#F1F5F9]"
                  }`}
                >
                  <i className="fa-regular fa-clone" />
                  <span>Được nhân bản nhiều</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      sort === "MOST_CLONED" ? "bg-white" : "bg-[#0194F3]"
                    }`}
                  />
                </button>
              </div>

              {/* Dải Chủ đề & Điểm đến cuộn ngang (Chỉ hiện trên Mobile < lg, nằm giữa Ô tìm kiếm và Tabs sắp xếp) */}
              <MobileTopicGroupsStrip
                groups={groups}
                selectedGroupId={selectedGroupId}
                onSelectGroup={handleSelectGroup}
                isAdmin={isAdmin}
                onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
                className="order-2 w-full lg:hidden"
              />

              {/* Search Input: trên Mobile nằm trên cùng (order-1), trên PC nằm bên phải (lg:order-2) */}
              <div
                ref={searchContainerRef}
                className="order-1 lg:order-2 relative w-full lg:w-[220px]"
              >
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-[12px] pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onFocus={() => {
                    if (hasSearchSuggestions) setIsSearchDropdownOpen(true);
                  }}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsSearchDropdownOpen(false);
                    }
                  }}
                  placeholder="Tìm bài viết, #hashtag..."
                  aria-label="Tìm bài viết, hashtag, tác giả hoặc điểm đến"
                  autoComplete="off"
                  className="w-full h-9 pl-[34px] pr-7 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#0194F3] text-[12px] text-[#1E293B] placeholder:text-[#94A3B8] outline-none transition-colors"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setAppliedSearch("");
                      setIsSearchDropdownOpen(false);
                    }}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 inline-flex items-center justify-center rounded-full text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}

                {/* Search Autocomplete Suggestions Dropdown */}
                {isSearchDropdownOpen && hasSearchSuggestions && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-[#E2E8F0] bg-white shadow-xl p-2 space-y-2">
                    {suggestedSearchTags.length > 0 && (
                      <div className="space-y-1">
                        <div className="px-2 py-0.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                          Hashtag đề xuất
                        </div>
                        <div className="flex flex-wrap gap-1.5 px-1">
                          {suggestedSearchTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleSelectSearchTag(tag)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F1F5F9] hover:bg-[#0194F3] hover:text-white text-[#1E293B] transition-colors cursor-pointer"
                            >
                              <Hash className="size-3" />
                              <span>{tag}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {suggestedDestinations.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-[#F1F5F9]">
                        <div className="px-2 py-0.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                          Điểm đến phổ biến
                        </div>
                        <div className="space-y-0.5 px-1">
                          {suggestedDestinations.map((dest) => (
                            <button
                              key={dest.name}
                              type="button"
                              onClick={() => handleSelectDestination(dest.name)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] hover:bg-[#F0F7FF] hover:text-[#0194F3] text-[#1E293B] transition-colors cursor-pointer text-left"
                            >
                              <span className="flex items-center gap-1.5 font-semibold">
                                <MapPin className="size-3.5 text-rose-500 shrink-0" />
                                <span>{dest.name}</span>
                              </span>
                              <span className="text-[11px] text-[#64748B]">
                                {dest.province}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Active Group / Tag Filter Indicator Bar */}
            {(activeGroupObj || selectedTag) && (
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-[#F0F7FF] border border-[#BAE0FD] text-[12px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#475569]">
                    Đang lọc theo:
                  </span>
                  {activeGroupObj && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#BAE0FD] font-bold text-[#0194F3]">
                      <i className="fa-solid fa-compass text-[11px]" />
                      <span>{activeGroupObj.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedGroupId("")}
                        className="hover:text-[#0F172A] cursor-pointer ml-0.5"
                        aria-label="Bỏ lọc nhóm"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  )}
                  {selectedTag && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#BAE0FD] font-bold text-[#0194F3]">
                      <span>{selectedTag}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTag("")}
                        className="hover:text-[#0F172A] cursor-pointer ml-0.5"
                        aria-label="Bỏ lọc thẻ"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-[11px] font-bold text-[#0194F3] hover:underline shrink-0 cursor-pointer"
                >
                  Xem tất cả
                </button>
              </div>
            )}

            {/* Matched Creators Strip when searching */}
            {appliedSearch && matchedCreators.length > 0 && (
              <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-4 space-y-3 shadow-[0_2px_6px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                    <Users className="size-4 text-[#0194F3]" />
                    <span>
                      Kênh sáng tạo phù hợp ({matchedCreators.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-[#64748B]">
                    Nhấn để xem trang cá nhân & lịch trình công khai
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {matchedCreators.map((creator) => {
                    const identifier = creator.username || creator.id;
                    return (
                      <Link
                        key={creator.id}
                        href={`/community/profile/${encodeURIComponent(
                          identifier
                        )}`}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#BAE0FD] hover:bg-[#F0F7FF] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              creator.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                creator.fullName
                              )}&background=E0F2FE&color=0284C7`
                            }
                            alt={creator.fullName}
                            loading="lazy"
                            decoding="async"
                            className="w-9 h-9 rounded-full object-cover border border-[#E2E8F0] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-xs font-bold text-[#0F172A] group-hover:text-[#0194F3] truncate transition-colors">
                                {creator.fullName}
                              </p>
                              {(creator.isVerifiedCreator ??
                                creator.isVerified) && (
                                <CheckCircle2
                                  className="size-3.5 text-[#0194F3] shrink-0"
                                  aria-label="Thổ địa xác thực"
                                />
                              )}
                            </div>
                            <p className="text-[11px] text-[#64748B] truncate">
                              {creator.username ? `@${creator.username} • ` : ""}
                              {creator.postCount} bài đăng
                            </p>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A] text-[11px] font-bold shrink-0">
                          Xem kênh
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ==================== MOBILE TẦNG ĐẦU BẢNG TIN: TOP THỔ ĐỊA ==================== */}
            {!appliedSearch && (
              <TopCreatorsSection
                topCreators={topCreators}
                className="lg:hidden"
              />
            )}

            {/* ==================== FEED POST CARDS STREAM ==================== */}
            <div id="feedStream" className="flex flex-col gap-6">
              {isLoading ? (
                <>
                  <CommunityFeedCardSkeleton />
                  <CommunityFeedCardSkeleton />
                </>
              ) : isError ? (
                <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-10 text-center space-y-3 shadow-[0_2px_6px_rgba(0,0,0,0.02)]">
                  <p className="text-sm font-bold text-[#0F172A]">
                    Không thể tải bảng tin cộng đồng
                  </p>
                  <p className="text-xs text-[#64748B] max-w-md mx-auto">
                    Đã xảy ra sự cố kết nối khi tải danh sách bài viết. Vui lòng
                    thử lại.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    className="h-10 px-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Thử lại</span>
                  </Button>
                </div>
              ) : allPosts.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#CBD5E1] bg-white p-12 text-center space-y-3">
                  <Compass className="size-10 mx-auto text-[#94A3B8]" />
                  <p className="text-base font-bold text-[#0F172A]">
                    {hasActiveFilter
                      ? "Không tìm thấy bài viết nào khớp với bộ lọc"
                      : "Chưa có bài chia sẻ nào phù hợp"}
                  </p>
                  <p className="text-xs text-[#64748B] max-w-md mx-auto">
                    {hasActiveFilter
                      ? "Hãy thử tìm với từ khóa khác, chọn nhóm cộng đồng khác hoặc xóa bộ lọc hiện tại."
                      : "Hãy là người đầu tiên đăng tải hình ảnh, video trải nghiệm và lịch trình chuyến đi của bạn để truyền cảm hứng cho cộng đồng TripGenie!"}
                  </p>
                  <div className="flex items-center justify-center gap-2.5 pt-1">
                    {hasActiveFilter && (
                      <Button
                        variant="outline"
                        onClick={handleClearFilters}
                        className="h-10 px-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                      >
                        <X className="size-3.5" />
                        <span>Xóa bộ lọc</span>
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenComposer(false)}
                      className="h-10 px-5 rounded-xl bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Plus className="size-4" />
                      <span>Đăng bài mới</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {allPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      isHighlighted={highlightedPostId === post.id}
                      onSelectTag={handleSelectTagFromPost}
                      onSelectGroup={handleSelectGroup}
                      onOpenDetail={handleOpenPostDetail}
                      onOpenClonePreview={handleOpenClonePreview}
                      onOpenEdit={handleOpenEditPost}
                      onOpenReport={handleOpenReportPost}
                    />
                  ))}

                  {hasNextPage && (
                    <div className="flex justify-center pt-2 pb-4">
                      <button
                        type="button"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="h-10 px-6 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                      >
                        {isFetchingNextPage
                          ? "Đang tải thêm..."
                          : "Xem thêm bài viết"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ==================== CỘT PHẢI (RIGHT SIDEBAR: 310px) ==================== */}
          <CommunityRightSidebar
            topClonedPosts={topClonedPosts}
            checkinHighlights={checkinHighlights}
            topCreators={topCreators}
            onPreviewAndClone={handleOpenClonePreview}
            onOpenStoryViewer={(idx) => setActiveStoryIndex(idx)}
            onSelectMostClonedTab={() => {
              setSort("MOST_CLONED");
              scrollFeedToTop();
            }}
            onFocusHotPost={handleFocusHotPost}
          />
        </div>
      </div>

      {/* Hidden file inputs for direct trigger from Quick Composer bar */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={COMMUNITY_UI_CONSTANTS.ACCEPTED_MEDIA_MIMES}
        onChange={handleFilesSelected}
        className="hidden"
      />
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept={COMMUNITY_UI_CONSTANTS.ACCEPTED_MEDIA_MIMES}
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* ==================== SINGLETON PORTALED MODALS (Only mounted when open) ==================== */}
      {isComposeOpen && (
        <CreatePostModal
          open={isComposeOpen}
          onClose={() => {
            setIsComposeOpen(false);
            setComposeInitialFiles([]);
            setComposeFocusItinerary(false);
          }}
          initialFiles={composeInitialFiles}
          focusItinerary={composeFocusItinerary}
          defaultGroupId={
            selectedGroupId || COMMUNITY_UI_CONSTANTS.DEFAULT_GROUP_SLUG
          }
          groups={groups}
        />
      )}

      {isCreateGroupOpen && (
        <CreateGroupModal
          open={isCreateGroupOpen}
          onClose={() => setIsCreateGroupOpen(false)}
        />
      )}

      {activeStoryIndex !== null && (
        <StoryViewerModal
          open={activeStoryIndex !== null}
          stories={checkinHighlights}
          initialIndex={activeStoryIndex ?? 0}
          onClose={() => setActiveStoryIndex(null)}
          onPreviewItinerary={(storyPost) => {
            setActiveStoryIndex(null);
            setPreviewPostForClone(storyPost);
          }}
        />
      )}

      {previewPostForClone?.itinerary && (
        <CloneItineraryPreviewModal
          open={Boolean(previewPostForClone?.itinerary)}
          onClose={() => setPreviewPostForClone(null)}
          itinerarySummary={previewPostForClone.itinerary}
          cloneCount={previewPostForClone.cloneCount}
        />
      )}

      {liveActiveDetailPost && (
        <PostDetailModal
          open={Boolean(liveActiveDetailPost)}
          onClose={() => setActiveDetailPost(null)}
          post={liveActiveDetailPost}
          onSelectTag={(tag) => {
            setActiveDetailPost(null);
            handleSelectTagFromPost(tag);
          }}
        />
      )}

      {liveActiveEditPost && (
        <EditPostModal
          key={`${liveActiveEditPost.id}-${
            liveActiveEditPost.editedAt || liveActiveEditPost.updatedAt
          }`}
          open={Boolean(liveActiveEditPost)}
          onClose={() => setActiveEditPost(null)}
          post={liveActiveEditPost}
          groups={groups}
        />
      )}

      {activeReportPost && (
        <ReportPostModal
          open={Boolean(activeReportPost)}
          onClose={() => setActiveReportPost(null)}
          post={activeReportPost}
        />
      )}

      {deepPost && !liveActiveDetailPost && (
        <PostDetailModal
          open={Boolean(deepPost)}
          onClose={handleCloseDeepLinkModal}
          post={deepPost}
          highlightCommentId={deepCommentId || undefined}
          onSelectTag={(tag) => {
            handleCloseDeepLinkModal();
            handleSelectTagFromPost(tag);
          }}
        />
      )}
    </div>
  );
}

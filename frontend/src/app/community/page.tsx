"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PostDetailModal } from "@/components/community/PostDetailModal";
import {
  Plus,
  Search,
  Clock,
  Flame,
  Copy,
  Image as ImageIcon,
  Film,
  CalendarDays,
  Compass,
  RefreshCw,
  CheckCircle2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostCard } from "@/components/community/PostCard";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import { useCommunityFeed, useCommunityPost } from "@/features/community/hooks/use-community";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { COMMUNITY_UI_CONSTANTS } from "@/services/community.service";
import type { CommunitySortMode } from "@/types/community";
import { toast } from "sonner";

const SORT_TABS: { id: CommunitySortMode; label: string; icon: typeof Clock }[] = [
  { id: "LATEST", label: "Mới nhất", icon: Clock },
  { id: "TRENDING", label: "Thịnh hành", icon: Flame },
  { id: "MOST_CLONED", label: "Được nhân bản nhiều", icon: Copy },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function CommunityPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Deep linking: read postId and commentId from URL
  const deepPostId = searchParams.get("postId");
  const deepCommentId = searchParams.get("commentId");
  const isValidPostId = deepPostId ? UUID_REGEX.test(deepPostId) : false;

  const {
    data: deepPost,
    isError: isDeepPostError,
  } = useCommunityPost(isValidPostId ? deepPostId : null, Boolean(isValidPostId));

  const handleCloseDeepLinkModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("postId");
    params.delete("commentId");
    const nextQs = params.toString();
    router.replace(`/community${nextQs ? `?${nextQs}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    if (deepPostId && !isValidPostId) {
      toast.error("Đường dẫn bài viết không hợp lệ");
      handleCloseDeepLinkModal();
    } else if (isDeepPostError) {
      toast.error("Bài viết không còn tồn tại hoặc đã bị xóa");
      handleCloseDeepLinkModal();
    }
  }, [deepPostId, isValidPostId, isDeepPostError]);


  const { user } = useAuth();
  const [sort, setSort] = useState<CommunitySortMode>("LATEST");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Debounce search input (300ms) for smooth TikTok/Xiaohongshu-style unified discovery
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchInput.trim());
    }, COMMUNITY_UI_CONSTANTS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCommunityFeed({
    sort,
    tag: selectedTag || undefined,
    search: appliedSearch || undefined,
    limit: COMMUNITY_UI_CONSTANTS.DEFAULT_FEED_PAGE_SIZE,
  });

  const allPosts = data?.pages.flatMap((p) => p.items) ?? [];
  const matchedCreators = data?.pages[0]?.matchedCreators ?? [];
  const hasActiveFilter = Boolean(appliedSearch || selectedTag);

  const handleOpenComposer = () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để đăng bài chia sẻ lên cộng đồng");
      return;
    }
    setIsComposeOpen(true);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedTag("");
  };

  const handleSelectTagFromPost = (tag: string) => {
    const normalized = tag.startsWith("#") ? tag : `#${tag}`;
    setSelectedTag((prev) => (prev === normalized ? "" : normalized));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
            Cộng đồng du lịch
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Khám phá video trải nghiệm thực tế, thả tim, bình luận và nhân bản lịch trình từ các thành viên.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {user && (
            <Link
              href={`/community/profile/${encodeURIComponent(
                user.username || user.id
              )}`}
            >
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Kênh của tôi
              </Button>
            </Link>
          )}
          <Button
            onClick={handleOpenComposer}
            className="h-10 px-4 rounded-xl font-bold gap-2 bg-primary text-primary-foreground shadow-xs cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Đăng bài</span>
          </Button>
        </div>
      </div>

      {/* Facebook/TikTok-style Quick Composer Trigger Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-10 border border-border shrink-0">
            <AvatarImage
              src={user?.avatarUrl || undefined}
              alt={user?.fullName || "Khách"}
            />
            <AvatarFallback className="text-xs font-bold bg-secondary text-secondary-foreground">
              {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : "TG"}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={handleOpenComposer}
            className="flex-1 h-11 px-4 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 hover:border-primary/40 text-left text-xs sm:text-sm text-muted-foreground transition-all cursor-pointer"
          >
            {user
              ? `${user.fullName} ơi, chia sẻ ảnh, video hoặc lịch trình chuyến đi vừa qua của bạn nhé...`
              : "Chia sẻ khoảnh khắc, video review hoặc lịch trình chuyến đi của bạn..."}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenComposer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <ImageIcon className="size-4 text-primary" />
              <span>Ảnh check-in</span>
            </button>
            <button
              type="button"
              onClick={handleOpenComposer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <Film className="size-4 text-primary" />
              <span>Video ngắn</span>
            </button>
            <button
              type="button"
              onClick={handleOpenComposer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <CalendarDays className="size-4 text-primary" />
              <span>Đính kèm lịch trình</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Unified Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Sort Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {SORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = sort === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSort(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer min-h-[40px] ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Unified Search Input (Post Title, #Hashtag, @Creator, Destination) */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 w-full md:w-88"
        >
          <div className="relative flex-1">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm bài viết, #hashtag, @tác_giả, điểm đến..."
              aria-label="Tìm bài viết, hashtag, tác giả hoặc điểm đến"
              className="w-full h-10 pl-8 pr-8 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setAppliedSearch("");
                }}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2 top-1/2 -translate-y-1/2 size-6 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-10 px-3.5 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Tìm
          </Button>
        </form>
      </div>

      {/* Popular Hashtag Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedTag("")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
            selectedTag === ""
              ? "bg-secondary text-secondary-foreground border border-primary/30"
              : "bg-muted/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          Tất cả chủ đề
        </button>
        {COMMUNITY_UI_CONSTANTS.POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() =>
              setSelectedTag((prev) => (prev === tag ? "" : tag))
            }
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              selectedTag === tag
                ? "bg-secondary text-secondary-foreground border border-primary/30"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {tag}
          </button>
        ))}

        {/* Custom selected tag if clicked from a post card */}
        {selectedTag &&
          !(COMMUNITY_UI_CONSTANTS.POPULAR_TAGS as readonly string[]).includes(
            selectedTag
          ) && (
            <button
              type="button"
              onClick={() => setSelectedTag("")}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground border border-primary/30 cursor-pointer shrink-0"
            >
              <span>{selectedTag}</span>
              <X className="size-3" />
            </button>
          )}
      </div>

      {/* Matched Creators Strip (TikTok / Xiaohongshu-style People Strip on Search) */}
      {appliedSearch && matchedCreators.length > 0 && (
        <section className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Users className="size-4 text-primary" />
              <span>Kênh sáng tạo phù hợp ({matchedCreators.length})</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Nhấn để xem trang cá nhân & lịch trình công khai
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {matchedCreators.map((creator) => {
              const identifier = creator.username || creator.id;
              return (
                <Link
                  key={creator.id}
                  href={`/community/profile/${encodeURIComponent(identifier)}`}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border/70 bg-background hover:border-primary/40 hover:bg-muted/30 transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="size-9 border border-border shrink-0">
                      <AvatarImage
                        src={creator.avatarUrl || undefined}
                        alt={creator.fullName}
                      />
                      <AvatarFallback className="text-xs font-bold bg-secondary text-secondary-foreground">
                        {creator.fullName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-bold text-foreground group-hover:text-primary truncate transition-colors">
                          {creator.fullName}
                        </p>
                        {creator.isVerified && (
                          <CheckCircle2
                            className="size-3.5 text-primary shrink-0"
                            aria-label="Tài khoản xác thực"
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {creator.username
                          ? `@${creator.username} • `
                          : ""}
                        {creator.postCount} bài đăng
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground text-[11px] font-semibold shrink-0">
                    Xem kênh
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Social Feed Stream (4 States: Loading, Error, Empty, Data) */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-36 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-64 w-full rounded-xl bg-muted" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
          <p className="text-sm font-bold text-foreground">
            Không thể tải bảng tin cộng đồng
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Đã xảy ra sự cố kết nối khi tải danh sách bài viết. Vui lòng thử lại.
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
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <Compass className="size-10 mx-auto text-muted-foreground/60" />
          <p className="text-base font-bold text-foreground font-heading">
            {hasActiveFilter
              ? "Không tìm thấy bài viết nào khớp với bộ lọc"
              : "Chưa có bài chia sẻ nào phù hợp"}
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {hasActiveFilter
              ? "Hãy thử tìm với từ khóa khác, tên tác giả (@username), #hashtag hoặc xóa bộ lọc hiện tại."
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
                <span>Xóa bộ lọc tìm kiếm</span>
              </Button>
            )}
            <Button
              onClick={handleOpenComposer}
              className="h-10 px-5 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Đăng bài mới</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-6">
            {allPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onSelectTag={handleSelectTagFromPost}
              />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="h-10 px-6 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {isFetchingNextPage ? "Đang tải thêm..." : "Xem thêm bài viết"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        open={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
      {/* Deep Link Post Detail Modal */}
      {deepPost && (
        <PostDetailModal
          open={Boolean(deepPost)}
          onClose={handleCloseDeepLinkModal}
          post={deepPost}
          highlightCommentId={deepCommentId || undefined}
        />
      )}
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
          <div className="h-64 rounded-2xl bg-muted/30 animate-pulse" />
        </div>
      }
    >
      <CommunityPageContent />
    </Suspense>
  );
}

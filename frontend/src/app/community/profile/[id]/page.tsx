"use client";

import { useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  Grid,
  Heart,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/community/PostCard";
import { CloneItineraryPreviewModal } from "@/components/community/CloneItineraryPreviewModal";
import { useCreatorProfile } from "@/features/community/hooks/use-community";
import { formatVnd } from "@/features/planner/model/itinerary-format";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { CommunityLinkedItinerarySummary } from "@/types/community";

interface CreatorProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function CreatorProfilePage({ params }: CreatorProfilePageProps) {
  const resolvedParams = use(params);
  const identifier = decodeURIComponent(resolvedParams.id || "");
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"posts" | "itineraries">("posts");
  const [previewItinerary, setPreviewItinerary] =
    useState<CommunityLinkedItinerarySummary | null>(null);

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useCreatorProfile(identifier);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="h-48 rounded-2xl border border-border bg-card animate-pulse p-6" />
        <div className="h-80 rounded-2xl border border-border bg-card animate-pulse p-6" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="max-w-3xl mx-auto w-full px-4 py-12 text-center space-y-4">
        <div className="rounded-2xl border border-border bg-card p-10 space-y-3">
          <h1 className="text-xl font-bold font-heading text-foreground">
            Không tìm thấy trang cá nhân
          </h1>
          <p className="text-xs text-muted-foreground">
            Tài khoản này không tồn tại hoặc đã ngừng hoạt động.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-2">
            <Link href="/community">
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>Quay lại Cộng đồng</span>
              </Button>
            </Link>
            <Button
              onClick={() => refetch()}
              className="h-10 px-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Thử lại</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { user: creator, stats, posts, publicItineraries } = profile;
  const isMe = currentUser?.id === creator.id;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 pb-20">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/community"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Quay lại bảng tin Cộng đồng</span>
        </Link>

        {isMe && (
          <Link href="/profile">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Quản lý tài khoản
            </Button>
          </Link>
        )}
      </div>

      {/* TikTok-Style Creator Header Card */}
      <section className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <Avatar className="size-20 sm:size-24 border-2 border-primary/30 shadow-xs shrink-0">
              <AvatarImage
                src={creator.avatarUrl || undefined}
                alt={creator.fullName}
              />
              <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                {creator.fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
                  {creator.fullName}
                </h1>
                {creator.isVerified && (
                  <CheckCircle2
                    className="size-5 text-primary shrink-0"
                    aria-label="Tài khoản xác thực"
                  />
                )}
              </div>

              {creator.username && (
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  @{creator.username}
                </p>
              )}

              <p className="text-xs sm:text-sm text-foreground/90 max-w-xl leading-relaxed">
                {creator.bio ||
                  "Thành viên yêu thích khám phá văn hóa, ẩm thực và chia sẻ lịch trình du lịch thực tế trên TripGenie."}
              </p>
            </div>
          </div>

          {/* TikTok-style 3 Aggregate Counters */}
          <div className="grid grid-cols-3 gap-4 sm:gap-6 px-5 py-3.5 rounded-2xl border border-border bg-background shrink-0">
            <div className="text-center space-y-0.5">
              <div className="text-base sm:text-lg font-bold text-foreground">
                {stats.postCount}
              </div>
              <div className="text-xs text-muted-foreground">Bài đăng</div>
            </div>

            <div className="text-center border-l border-border pl-4 sm:pl-6 space-y-0.5">
              <div className="text-base sm:text-lg font-bold text-rose-500 flex items-center justify-center gap-1">
                <Heart className="size-3.5 fill-current" />
                <span>{stats.totalLikesReceived}</span>
              </div>
              <div className="text-xs text-muted-foreground">Lượt thích</div>
            </div>

            <div className="text-center border-l border-border pl-4 sm:pl-6 space-y-0.5">
              <div className="text-base sm:text-lg font-bold text-primary">
                {stats.totalClonesReceived}
              </div>
              <div className="text-xs text-muted-foreground">Nhân bản</div>
            </div>
          </div>
        </div>

        {/* Content Switcher Tabs (TikTok Profile Tabs) */}
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("posts")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer min-h-[42px] ${
              activeTab === "posts"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Grid className="size-4" />
            <span>Bài đăng chia sẻ ({posts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("itineraries")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer min-h-[42px] ${
              activeTab === "itineraries"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <CalendarDays className="size-4" />
            <span>Lịch trình công khai ({publicItineraries.length})</span>
          </button>
        </div>
      </section>

      {/* Tab 1: Creator's Published Posts */}
      {activeTab === "posts" && (
        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-2">
              <Grid className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-bold text-foreground">
                Chưa có bài đăng nào
              </p>
              <p className="text-xs text-muted-foreground">
                Thành viên này chưa đăng tải bài viết công khai nào lên cộng đồng.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Creator's Public Itineraries */}
      {activeTab === "itineraries" && (
        <div className="space-y-4">
          {publicItineraries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-2">
              <CalendarDays className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-bold text-foreground">
                Chưa có lịch trình công khai
              </p>
              <p className="text-xs text-muted-foreground">
                Thành viên này chưa chia sẻ lịch trình công khai nào.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {publicItineraries.map((itin) => (
                <div
                  key={itin.id}
                  className="rounded-2xl border border-border/80 bg-card p-5 flex flex-col justify-between space-y-4 shadow-xs hover:border-primary/40 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
                        <MapPin className="size-3 text-primary" />
                        <span>
                          {itin.areaName || itin.destination || "Việt Nam"}
                        </span>
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {itin.totalPlaces} địa điểm
                      </span>
                    </div>

                    <h3 className="text-base font-bold font-heading text-foreground">
                      {itin.title}
                    </h3>

                    {itin.estimatedCost && itin.estimatedCost > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Chi phí dự kiến:{" "}
                        <span className="font-semibold text-foreground">
                          ~{formatVnd(itin.estimatedCost)}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                    <Link
                      href={`/itineraries/${itin.id}`}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Xem lịch trình</span>
                    </Link>
                    <Button
                      size="sm"
                      onClick={() => setPreviewItinerary(itin)}
                      className="h-9 px-3.5 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                    >
                      <Copy className="size-3.5" />
                      <span>Nhân bản</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compact Itinerary Preview & Clone Confirmation Modal */}
      <CloneItineraryPreviewModal
        open={Boolean(previewItinerary)}
        onClose={() => setPreviewItinerary(null)}
        itinerarySummary={previewItinerary}
      />
    </div>
  );
}

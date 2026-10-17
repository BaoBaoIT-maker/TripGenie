"use client";

import { use } from "react";
import Link from "next/link";
import {
  Globe,
  Lock,
  Share2,
  Bookmark,
  Compass,
  ArrowLeft,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PlaceCard } from "@/components/place/PlaceCard";
import { mapBackendPlaceToPlace } from "@/services/place.service";
import { useCollectionDetail } from "@/features/collections/hooks/use-collections";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toast } from "sonner";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PublicCollectionDetailPage({ params }: Props) {
  const { id } = use(params);
  const { user } = useAuth();
  const {
    data: collection,
    isLoading,
    isError,
    error,
  } = useCollectionDetail(id);

  const isOwner = Boolean(user && collection && user.id === collection.userId);

  const handleShare = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success("Đã sao chép liên kết bộ sưu tập công khai!");
    } else {
      toast.info(`Liên kết: ${url}`);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8">
        <div className="h-6 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-28 bg-muted rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Handle Private or Not Found
  if (isError || !collection) {
    const isForbidden =
      (error as { statusCode?: number } | null)?.statusCode === 403;

    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="mx-auto size-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
          {isForbidden ? <Lock className="size-8" /> : <Bookmark className="size-8" />}
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h1 className="text-2xl font-bold font-heading text-foreground">
            {isForbidden
              ? "Bộ sưu tập này đang ở chế độ riêng tư"
              : "Không tìm thấy bộ sưu tập"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isForbidden
              ? "Người tạo đã đặt bộ sưu tập này ở chế độ riêng tư. Bạn cần đăng nhập đúng tài khoản sở hữu để xem."
              : "Đường dẫn không tồn tại hoặc bộ sưu tập đã bị xóa."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/collections"
            className={buttonVariants({
              variant: "outline",
              className: "rounded-xl font-semibold gap-1.5 text-xs inline-flex items-center",
            })}
          >
            <ArrowLeft className="size-3.5" />
            <span>Bộ sưu tập của tôi</span>
          </Link>
          <Link
            href="/places"
            className={buttonVariants({
              className: "rounded-xl font-semibold gap-1.5 text-xs inline-flex items-center",
            })}
          >
            <Compass className="size-3.5" />
            <span>Khám phá địa điểm</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-8 pb-16">
      {/* Top Breadcrumb Navigation */}
      <div>
        <Link
          href="/collections"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Tất cả bộ sưu tập</span>
        </Link>
      </div>

      {/* Editorial Collection Header */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                collection.isPublic
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {collection.isPublic ? (
                <>
                  <Globe className="size-3" />
                  <span>Bộ sưu tập công khai</span>
                </>
              ) : (
                <>
                  <Lock className="size-3" />
                  <span>Bộ sưu tập riêng tư</span>
                </>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              • {collection._count?.places ?? 0} địa điểm
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground tracking-tight">
            {collection.title}
          </h1>

          {collection.description && (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {collection.description}
            </p>
          )}
        </div>

        {collection.isPublic && (
          <div className="shrink-0 self-start sm:self-center">
            <Button
              variant="outline"
              onClick={handleShare}
              className="min-h-[44px] px-4 rounded-xl text-xs font-semibold gap-2 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
            >
              <Share2 className="size-4" />
              <span>Chia sẻ bộ sưu tập</span>
            </Button>
          </div>
        )}
      </div>

      {/* Places Grid */}
      {collection.places && collection.places.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-heading text-foreground">
            Danh sách địa điểm ({collection.places.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {collection.places.map((item) => {
              const place = mapBackendPlaceToPlace(item.place);
              return (
                <PlaceCard
                  key={place.id}
                  place={place}
                  currentCollectionId={isOwner ? collection.id : undefined}
                  collectionName={isOwner ? collection.title : undefined}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-4 max-w-lg mx-auto">
          <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Compass className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Chưa có địa điểm nào trong bộ sưu tập này
            </h3>
            <p className="text-xs text-muted-foreground">
              Bộ sưu tập hiện tại chưa được người tạo thêm địa điểm nào.
            </p>
          </div>
          <Link
            href="/places"
            className={buttonVariants({
              variant: "outline",
              className: "rounded-xl text-xs font-semibold inline-flex items-center",
            })}
          >
            Khám phá các điểm đến khác
          </Link>
        </div>
      )}
    </div>
  );
}

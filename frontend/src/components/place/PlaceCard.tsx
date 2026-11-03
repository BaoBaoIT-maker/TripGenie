"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Sparkles, Heart, Camera, UploadCloud, Navigation } from "lucide-react";
import { Place } from "@/types/place";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/common/RatingStars";
import { cn } from "@/lib/utils";
import { routingService } from "@/services/routing.service";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useSavedPlaceIds, useToggleFavorite } from "@/features/collections/hooks/use-collections";
import { SaveToCollectionModal } from "@/features/collections/components/SaveToCollectionModal";
import { collectionService, DEFAULT_COLLECTION_TITLE } from "@/services/collection.service";
import { toast } from "sonner";

interface PlaceCardProps {
  place: Place;
  className?: string;
  onContributePhoto?: (place: Place) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  onCardClick?: (e: React.MouseEvent, place: Place) => void;
  isSelected?: boolean;
  currentCollectionId?: string | null;
  collectionName?: string;
}

export function PlaceCard({
  place,
  className,
  onContributePhoto,
  userLocation,
  onCardClick,
  isSelected,
  currentCollectionId,
  collectionName,
}: PlaceCardProps) {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const { data: savedIdsSet } = useSavedPlaceIds({ enabled: isAuthenticated });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCheckingCollections, setIsCheckingCollections] = useState(false);

  const toggleMutation = useToggleFavorite({
    onSaved: (data) => {
      if (data.isSaved) {
        toast.success(`Đã lưu "${place.name}" vào ${collectionName || DEFAULT_COLLECTION_TITLE}`, {
          action: {
            label: "Đổi bộ sưu tập",
            onClick: () => setIsSaveModalOpen(true),
          },
        });
      } else {
        toast.info(
          collectionName
            ? `Đã xóa "${place.name}" khỏi bộ sưu tập "${collectionName}"`
            : `Đã bỏ lưu "${place.name}"`
        );
      }
    },
  });

  const isBookmarked = isAuthenticated
    ? (currentCollectionId ? true : (savedIdsSet?.has(place.id) ?? false))
    : false;
  const [imgError, setImgError] = useState(false);

  // Compute direct distance if user location is available
  const distanceKm = useMemo(() => {
    if (!userLocation || !place.latitude || !place.longitude) return null;
    return routingService.calculateDirectDistanceKm(userLocation, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
  }, [userLocation, place.latitude, place.longitude]);

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.info("Vui lòng đăng nhập để lưu địa điểm vào bộ sưu tập");
      return;
    }
    if (toggleMutation.isPending || isCheckingCollections) return;

    if (currentCollectionId) {
      toggleMutation.mutate({ placeId: place.id, collectionId: currentCollectionId });
      return;
    }

    if (!isBookmarked) {
      toggleMutation.mutate({ placeId: place.id });
      return;
    }

    // Is currently bookmarked in 1 or more collections
    try {
      setIsCheckingCollections(true);
      const containing = await collectionService.getCollectionsContainingPlace(place.id);
      if (containing && containing.length > 1) {
        setIsSaveModalOpen(true);
      } else {
        toggleMutation.mutate({ placeId: place.id });
      }
    } catch {
      toggleMutation.mutate({ placeId: place.id });
    } finally {
      setIsCheckingCollections(false);
    }
  };
  const handleCardInteraction = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    if (onCardClick) {
      onCardClick(e, place);
    }
  };

  const hasValidImage = Boolean(place.coverImage && !imgError);

  return (
    <div
      onClick={handleCardInteraction}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md cursor-pointer",
        isSelected
          ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg"
          : "border-border/80",
        className
      )}
    >
      {/* Card Image / Visual Header */}
      <div className="relative block h-44 sm:h-48 w-full overflow-hidden bg-muted">
        {/* Main Clickable Background to Detail Page */}
        <Link
          href={`/places/${place.slug}`}
          onClick={handleCardInteraction}
          className="absolute inset-0 z-0"
          aria-label={`Xem chi tiết ${place.name}`}
        >
          {hasValidImage ? (
            <>
              <Image
                src={place.coverImage}
                alt={place.name}
                fill
                unoptimized={
                  place.coverImage.includes("wikimedia.org") ||
                  place.coverImage.includes("wikipedia.org")
                }
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImgError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-muted/50 text-center transition-colors group-hover:bg-muted/70">
              <div className="size-10 rounded-full bg-background/80 shadow-xs flex items-center justify-center text-muted-foreground/80 mb-1.5">
                <Camera className="size-5" />
              </div>
              <span className="text-xs font-semibold text-foreground/85">
                Chưa có ảnh thực tế
              </span>
              <span className="text-[11px] text-muted-foreground line-clamp-1">
                Hãy là người đầu tiên chia sẻ
              </span>
            </div>
          )}
        </Link>

        {/* Contribute Photo Button Overlay (only rendered when callback provided and image missing) */}
        {!hasValidImage && onContributePhoto && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContributePhoto(place);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-background/90 hover:bg-background border border-border/80 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-xs transition-colors"
            >
              <UploadCloud className="size-3 text-primary" />
              <span>Đóng góp ảnh</span>
            </button>
          </div>
        )}

        {/* Top Badges & Optional Bookmark Action */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none z-10">
          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <Badge
              variant="secondary"
              className="bg-background/90 text-foreground backdrop-blur-md text-[11px] font-semibold py-0.5 px-2.5 shadow-xs"
            >
              {place.categoryLabel}
            </Badge>

            {place.matchScore && (
              <Badge className="bg-primary/95 text-primary-foreground backdrop-blur-md text-[11px] font-bold py-0.5 px-2 shadow-xs gap-1">
                <Sparkles className="size-3" />
                <span>{place.matchScore}% Phù hợp</span>
              </Badge>
            )}
          </div>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={toggleBookmark}
            disabled={toggleMutation.isPending || isCheckingCollections}
            className={cn(
              "pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs cursor-pointer",
              isBookmarked
                ? "bg-rose-500 text-white shadow-md hover:bg-rose-600"
                : "bg-background/85 text-foreground hover:bg-background hover:text-rose-500"
            )}
            aria-label={
              isBookmarked
                ? currentCollectionId
                  ? `Xóa khỏi bộ sưu tập ${collectionName || ""}`
                  : "Bỏ lưu địa điểm"
                : "Lưu địa điểm"
            }
            title={
              isBookmarked
                ? currentCollectionId
                  ? `Xóa khỏi bộ sưu tập "${collectionName || ""}"`
                  : "Bỏ lưu địa điểm"
                : "Lưu địa điểm"
            }
          >
            <Heart
              className={cn(
                "size-4.5 transition-transform",
                isBookmarked ? "fill-current scale-110" : ""
              )}
            />
          </button>
        </div>

        {/* Bottom Image Info: Price, City & Distance (when image present) */}
        {hasValidImage && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-medium z-10 pointer-events-none">
            <div className="flex items-center gap-1.5 text-white drop-shadow-sm">
              <div className="flex items-center gap-1">
                <MapPin className="size-3.5 text-primary" />
                <span>{place.city}</span>
              </div>
              {distanceKm !== null && distanceKm > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-black/65 text-white font-semibold px-2 py-0.5 backdrop-blur-xs text-[10px] border border-white/20 shadow-2xs">
                  <Navigation className="size-2.5 text-primary shrink-0" />
                  <span>~{routingService.formatDistanceKm(distanceKm)}</span>
                </span>
              )}
            </div>
            {place.priceRangeText ? (
              <span className="rounded-md bg-black/60 text-white px-2 py-0.5 backdrop-blur-xs text-[11px]">
                {place.priceRangeText}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5 justify-between space-y-3">
        <div className="space-y-1.5">
          <Link href={`/places/${place.slug}`} onClick={handleCardInteraction}>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-1">
              {place.name}
            </h3>
          </Link>

          {place.tagline && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {place.tagline}
            </p>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          {place.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Footer info: Rating & Reviews */}
        <div className="flex items-center justify-between pt-2 border-t border-border/70 text-xs">
          {place.rating > 0 ? (
            <RatingStars
              rating={place.rating}
              showValue
              reviewCount={place.reviewCount}
              size="sm"
            />
          ) : (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Mới • Chưa có đánh giá
            </span>
          )}

          <Link
            href={`/places/${place.slug}`}
            onClick={handleCardInteraction}
            className="font-semibold text-primary hover:underline text-xs"
          >
            Chi tiết →
          </Link>
        </div>
      </div>

      {/* Save to Collection Modal */}
      <SaveToCollectionModal
        place={place}
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
      />
    </div>
  );
}

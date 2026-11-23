"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/common/RatingStars";
import { PlaceCard } from "@/components/place/PlaceCard";
import { PlaceDetailSkeleton } from "@/components/place/ExploreListSkeleton";
import { PhotoContributeModal } from "@/components/place/PhotoContributeModal";
import { PlacePhotoLightboxModal } from "@/components/place/PlacePhotoLightboxModal";
import { PendingContributedPhotosStrip } from "@/components/place/PendingContributedPhotosStrip";
import { usePlacePhotoContributions } from "@/components/place/use-place-photo-contributions";
import { SectionHeader } from "@/components/common/SectionHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { placeService } from "@/services/place.service";
import { Place } from "@/types/place";
import { toast } from "sonner";
import { useGeolocation } from "@/features/map/hooks/use-geolocation";
import { buildExploreHref } from "@/features/map/lib/explore-query";
import { routingService } from "@/services/routing.service";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useSavedPlaceIds, useToggleFavorite } from "@/features/collections/hooks/use-collections";
import { SaveToCollectionModal } from "@/features/collections/components/SaveToCollectionModal";
import { DEFAULT_COLLECTION_TITLE } from "@/services/collection.service";
import { AddPlaceToItineraryModal } from "@/features/planner/components/AddPlaceToItineraryModal";

export interface PlaceDetailClientProps {
  params: Promise<{ slug: string }>;
}

export default function PlaceDetailClient({ params }: PlaceDetailClientProps) {
  const router = useRouter();
  const resolvedParams = use(params);

  const initialSlug = resolvedParams?.slug || "";
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const { data: savedIdsSet } = useSavedPlaceIds({ enabled: isAuthenticated });

  const [place, setPlace] = useState<Place | null>(null);
  const [relatedPlaces, setRelatedPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isAddToItineraryOpen, setIsAddToItineraryOpen] = useState(false);
  const [isContributePhotoOpen, setIsContributePhotoOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mainImgError, setMainImgError] = useState(false);
  const [failedThumbnails, setFailedThumbnails] = useState<Record<number, boolean>>({});

  const toggleMutation = useToggleFavorite({
    onSaved: (data) => {
      if (!place) return;
      if (data.isSaved) {
        toast.success(`Đã lưu "${place.name}" vào ${DEFAULT_COLLECTION_TITLE}`, {
          action: {
            label: "Đổi bộ sưu tập",
            onClick: () => setIsSaveModalOpen(true),
          },
        });
      } else {
        toast.info(`Đã bỏ lưu "${place.name}"`);
      }
    },
  });

  const { coordinate: userLocation, requestLocation, locating } = useGeolocation();

  const {
    photos: contributedPhotos,
    enqueueUpload: enqueuePhotoUpload,
    retryUpload: retryPhotoUpload,
    dismissUpload: dismissPhotoUpload,
  } = usePlacePhotoContributions(place?.id, place?.pendingContributedImages);

  useEffect(() => {
    if (!userLocation) {
      requestLocation();
    }
  }, [userLocation, requestLocation]);

  const directDistanceKm =
    userLocation && place?.latitude && place?.longitude
      ? routingService.calculateDirectDistanceKm(userLocation, {
          latitude: place.latitude,
          longitude: place.longitude,
        })
      : null;

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      await Promise.resolve();
      if (isCancelled) return;
      setLoading(true);
      setErrorMessage(null);
      setLightboxIndex(null);
      setMainImgError(false);
      setFailedThumbnails({});

      try {
        const data = await placeService.getPlaceBySlug(initialSlug);
        if (!isCancelled) {
          setPlace(data);
          if (data) {
            const related = await placeService.getRelatedPlaces(data, 3);
            if (!isCancelled) {
              setRelatedPlaces(related);
            }
          } else {
            setRelatedPlaces([]);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Không thể tải thông tin địa điểm vào lúc này. Vui lòng thử lại sau."
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [initialSlug, reloadNonce]);

  if (loading) {
    return <PlaceDetailSkeleton />;
  }

  if (errorMessage) {
    return (
      <div className="max-w-[1280px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8">
        <ErrorState
          title="Không thể tải địa điểm"
          message={errorMessage}
          onRetry={() => setReloadNonce((n) => n + 1)}
        />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="max-w-[1280px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          title="Không tìm thấy địa điểm"
          description="Địa điểm bạn đang tìm kiếm không tồn tại hoặc đã được cập nhật."
          actionLabel="Trở về trang Khám phá"
          onAction={() => router.push("/explore")}
        />
      </div>
    );
  }

  const isSaved = isAuthenticated ? (savedIdsSet?.has(place.id) ?? false) : false;
  const galleryImages =
    place.images.length > 0
      ? place.images
      : place.coverImage
        ? [place.coverImage]
        : [];
  const displayedCover = galleryImages[0] || place.coverImage;
  const extraPhotosCount = Math.max(0, galleryImages.length - 3);
  const splitMapHref = `/explore?view=split&selected=${place.id}&lat=${place.latitude}&lng=${place.longitude}`;
  const seeMoreHref = buildExploreHref({
    areaId: place.areaId,
    areaSlug: place.areaSlug,
    category: place.categorySlug || place.category,
  });

  const toggleSave = () => {
    if (!isAuthenticated) {
      toast.info("Vui lòng đăng nhập để lưu địa điểm vào bộ sưu tập");
      router.push(`/login?next=${encodeURIComponent(`/places/${initialSlug}`)}`);
      return;
    }
    if (toggleMutation.isPending) return;
    toggleMutation.mutate({ placeId: place.id });
  };

  const handleOpenSaveCollectionModal = () => {
    if (!isAuthenticated) {
      toast.info("Vui lòng đăng nhập để lưu địa điểm vào bộ sưu tập");
      router.push(`/login?next=${encodeURIComponent(`/places/${initialSlug}`)}`);
      return;
    }
    setIsSaveModalOpen(true);
  };

  const handleOpenAddToItineraryModal = () => {
    if (!isAuthenticated) {
      toast.info("Vui lòng đăng nhập để thêm địa điểm vào lịch trình");
      router.push(`/login?next=${encodeURIComponent(`/places/${initialSlug}`)}`);
      return;
    }
    setIsAddToItineraryOpen(true);
  };

  const hasPracticalDetails = Boolean(
    place.priceRangeText ||
      place.openingHoursText ||
      place.phone ||
      place.website ||
      place.city ||
      place.tags.length > 0
  );

  return (
    <div className="max-w-[1280px] mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 space-y-6 pb-16 font-sans text-[#10243A]">
      {/* 1. Back Button & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 font-semibold text-[#10243A] hover:text-[#0194F3] transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
          <span>Quay lại</span>
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <Link href="/" className="hover:text-[#10243A] transition-colors">
            Trang chủ
          </Link>
          <span className="text-slate-300">/</span>
          <Link href="/explore" className="hover:text-[#10243A] transition-colors">
            Khám phá
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-[#10243A] truncate max-w-[220px]">
            {place.name}
          </span>
        </nav>
      </div>

      {/* 2. Main Hero Gallery (Visual-First) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Main Cover Photo (Span 8) */}
        <div
          onClick={() => {
            if (displayedCover && !mainImgError) {
              setLightboxIndex(0);
            }
          }}
          className={`lg:col-span-8 relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-slate-200 rounded-2xl border border-slate-200/80 group ${
            displayedCover && !mainImgError ? "cursor-pointer" : ""
          }`}
        >
          {displayedCover && !mainImgError ? (
            <>
              <Image
                src={displayedCover}
                alt={place.name}
                fill
                priority
                unoptimized={
                  displayedCover.includes("wikimedia.org") ||
                  displayedCover.includes("wikipedia.org")
                }
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                onError={() => setMainImgError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsContributePhotoOpen(true);
                }}
                className="absolute bottom-3.5 right-3.5 z-10 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 hover:bg-white backdrop-blur-md shadow-md text-xs font-bold text-[#10243A] border border-slate-200/80 transition-all hover:border-[#0194F3]/40 cursor-pointer"
                title="Đóng góp ảnh thực tế cho địa điểm này"
              >
                <i
                  className="fa-solid fa-camera text-[#0194F3]"
                  aria-hidden="true"
                />
                <span>Đóng góp ảnh</span>
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-100 text-center">
              <div className="size-14 rounded-full bg-white shadow-2xs flex items-center justify-center text-slate-400 mb-3">
                <i className="fa-solid fa-camera text-xl" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-[#10243A]">
                Chưa có ảnh thực tế cho {place.name}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Hình ảnh thực tế sẽ sớm được cập nhật từ cộng đồng du lịch TripGenie.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsContributePhotoOpen(true)}
                className="mt-3.5 gap-1.5 text-xs font-semibold rounded-xl border-slate-200 bg-white text-[#10243A] hover:bg-[#F0F7FF] hover:text-[#0194F3] shadow-2xs cursor-pointer"
              >
                <i
                  className="fa-solid fa-camera text-xs text-[#0194F3]"
                  aria-hidden="true"
                />
                <span>Đóng góp ảnh ngay</span>
              </Button>
            </div>
          )}
        </div>

        {/* Side Thumbnails (Span 4) */}
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-3.5">
          {[galleryImages[1] ?? null, galleryImages[2] ?? null].map(
            (img, idx) => {
              const galleryIdx = idx + 1;
              const isThirdSlotWithMore = idx === 1 && extraPhotosCount > 0;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (img && !failedThumbnails[idx]) {
                      setLightboxIndex(galleryIdx);
                    }
                  }}
                  className={`relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100 border border-slate-200/80 ${
                    img && !failedThumbnails[idx] ? "cursor-pointer group" : ""
                  }`}
                >
                  {img && !failedThumbnails[idx] ? (
                    <>
                      <Image
                        src={img}
                        alt={`${place.name} - ${galleryIdx + 1}`}
                        fill
                        unoptimized={
                          img.includes("wikimedia.org") ||
                          img.includes("wikipedia.org")
                        }
                        sizes="(max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                        onError={() =>
                          setFailedThumbnails((prev) => ({
                            ...prev,
                            [idx]: true,
                          }))
                        }
                      />

                      {isThirdSlotWithMore && (
                        <div className="absolute inset-0 bg-[#10243A]/55 group-hover:bg-[#10243A]/65 backdrop-blur-[1px] transition-colors flex flex-col items-center justify-center gap-1 text-white p-3 text-center">
                          <div className="inline-flex items-center gap-1.5 text-base sm:text-lg font-extrabold tracking-tight tabular-nums">
                            <i
                              className="fa-regular fa-images text-sm"
                              aria-hidden="true"
                            />
                            <span>+{extraPhotosCount} ảnh</span>
                          </div>
                          <span className="text-[11px] font-semibold text-white/90">
                            Xem tất cả {galleryImages.length} ảnh thực tế
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsContributePhotoOpen(true)}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-3 text-center hover:bg-[#F0F7FF] transition-colors cursor-pointer group w-full h-full"
                      title="Nhấn để đóng góp thêm ảnh"
                    >
                      <i
                        className="fa-solid fa-camera text-lg text-slate-400 mb-1.5 group-hover:text-[#0194F3] transition-colors"
                        aria-hidden="true"
                      />
                      <span className="text-xs text-slate-600 group-hover:text-[#0194F3] font-semibold">
                        + Thêm ảnh
                      </span>
                    </button>
                  )}
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* 3. Owner-Only Contributed Photos Strip (Uploading / Pending / Error with Retry) */}
      <PendingContributedPhotosStrip
        placeName={place.name}
        photos={contributedPhotos}
        onRetry={retryPhotoUpload}
        onDismiss={dismissPhotoUpload}
      />

      {/* 4. Title & Meta Row (Placed below Gallery — No Category Badge, includes Open Status, Rating, Address, Favorite & Share) */}
      <section className="rounded-2xl border border-slate-200/85 bg-white p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2.5 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#10243A] leading-tight">
              {place.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
              {place.openingHoursText && (
                <>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-semibold ${
                      place.isOpenNow === false
                        ? "bg-slate-100 border-slate-200 text-slate-700"
                        : "bg-emerald-50 border-emerald-200/80 text-emerald-800"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        place.isOpenNow === false
                          ? "bg-slate-400"
                          : "bg-emerald-600"
                      }`}
                    />
                    <span>{place.openingHoursText}</span>
                  </span>
                  <span className="text-slate-300">•</span>
                </>
              )}

              <div className="inline-flex items-center tabular-nums">
                <RatingStars
                  rating={place.rating}
                  showValue
                  reviewCount={place.reviewCount}
                  size="md"
                />
              </div>

              <span className="text-slate-300">•</span>

              <Link
                href={splitMapHref}
                className="inline-flex items-center gap-1.5 text-slate-700 hover:text-[#0194F3] font-medium transition-colors cursor-pointer"
                title="Xem trên bản đồ"
              >
                <i
                  className="fa-solid fa-location-dot text-slate-400 text-xs shrink-0"
                  aria-hidden="true"
                />
                <span className="underline decoration-slate-300 underline-offset-4 hover:decoration-[#0194F3]">
                  {place.address}
                </span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-end">
            <button
              type="button"
              onClick={toggleSave}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                isSaved
                  ? "border-rose-200 bg-rose-50/70 text-rose-700 font-bold"
                  : "border-slate-200/90 bg-white hover:bg-[#F8FAFC] text-[#10243A]"
              }`}
            >
              <i
                className={`${
                  isSaved
                    ? "fa-solid fa-heart text-rose-500"
                    : "fa-regular fa-heart text-slate-600"
                }`}
                aria-hidden="true"
              />
              <span>{isSaved ? "Đã lưu" : "Yêu thích"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                toast.success("Đã sao chép liên kết địa điểm!");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#10243A] transition-colors cursor-pointer"
            >
              <i
                className="fa-solid fa-share-nodes text-slate-600"
                aria-hidden="true"
              />
              <span>Chia sẻ</span>
            </button>
          </div>
        </div>
      </section>

      {/* 5. Two-Column Main Content & Sticky Sidebar */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Place Details (Span 8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Description Card */}
          <div className="rounded-2xl border border-slate-200/85 bg-white p-6 space-y-3 shadow-2xs">
            <h2 className="text-lg font-extrabold text-[#10243A] tracking-tight">
              Giới thiệu địa điểm
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line">
              {place.description}
            </p>
          </div>

          {/* Factual Practical Information Card */}
          {hasPracticalDetails && (
            <div className="rounded-2xl border border-slate-200/85 bg-white p-6 space-y-4 shadow-2xs">
              <h2 className="text-lg font-extrabold text-[#10243A] tracking-tight">
                Thông tin thực tế
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {place.priceRangeText && (
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-white border border-slate-200/80 text-[#10243A] flex items-center justify-center shrink-0">
                      <i
                        className="fa-solid fa-wallet text-emerald-600"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <div className="text-slate-500 font-medium">
                        Mức giá tham khảo
                      </div>
                      <div className="text-sm font-bold text-[#10243A] mt-0.5 tabular-nums">
                        {place.priceRangeText}
                      </div>
                    </div>
                  </div>
                )}

                {place.openingHoursText && (
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-white border border-slate-200/80 text-[#10243A] flex items-center justify-center shrink-0">
                      <i
                        className="fa-regular fa-clock text-slate-700"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <div className="text-slate-500 font-medium">
                        Trạng thái hoạt động
                      </div>
                      <div className="text-sm font-bold text-[#10243A] mt-0.5 tabular-nums">
                        {place.openingHoursText}
                      </div>
                    </div>
                  </div>
                )}

                {place.phone && (
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-white border border-slate-200/80 text-[#10243A] flex items-center justify-center shrink-0">
                      <i
                        className="fa-solid fa-phone text-slate-700"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <div className="text-slate-500 font-medium">
                        Số điện thoại
                      </div>
                      <div className="text-sm font-bold text-[#10243A] mt-0.5 tabular-nums">
                        {place.phone}
                      </div>
                    </div>
                  </div>
                )}

                {place.website ? (
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-white border border-slate-200/80 text-[#10243A] flex items-center justify-center shrink-0">
                      <i
                        className="fa-solid fa-globe text-slate-700"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-slate-500 font-medium">Website</div>
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-[#0194F3] hover:underline mt-0.5 block truncate"
                      >
                        {place.website}
                      </a>
                    </div>
                  </div>
                ) : (
                  place.city && (
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 flex items-start gap-3">
                      <div className="size-8 rounded-lg bg-white border border-slate-200/80 text-[#10243A] flex items-center justify-center shrink-0">
                        <i
                          className="fa-solid fa-map-pin text-slate-700"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-slate-500 font-medium">Khu vực</div>
                        <div className="text-sm font-bold text-[#10243A] mt-0.5 truncate">
                          {place.city}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {place.tags.length > 0 && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 mr-1">
                    Chủ đề:
                  </span>
                  {place.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-slate-200/80 text-xs font-semibold text-slate-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Focused Sticky Action Card (Span 4) */}
        <aside className="lg:col-span-4 sticky top-24">
          <div className="rounded-2xl border border-slate-200/85 bg-white p-5 space-y-5 shadow-2xs">
            {/* Primary Conversion Block: 1 Deliberate #0194F3 CTA + 1 Neutral Secondary CTA */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleOpenAddToItineraryModal}
                className="w-full h-11 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-[0_2px_8px_rgba(1,148,243,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-regular fa-calendar-plus" aria-hidden="true" />
                <span>Thêm vào lịch trình</span>
              </button>

              <button
                type="button"
                onClick={handleOpenSaveCollectionModal}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white hover:bg-[#F8FAFC] text-[#10243A] font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <i
                  className="fa-regular fa-bookmark text-slate-600"
                  aria-hidden="true"
                />
                <span>Lưu vào bộ sưu tập</span>
              </button>
            </div>

            <div className="border-t border-slate-100" />

            {/* Neutral Distance & Directions Island */}
            <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#10243A] flex items-center gap-1.5">
                  <i
                    className="fa-solid fa-route text-slate-600"
                    aria-hidden="true"
                  />
                  <span>Khoảng cách & Chỉ đường</span>
                </span>
                {userLocation && directDistanceKm !== null ? (
                  <span className="tabular-nums text-[11px] font-bold text-[#10243A] bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    ~{routingService.formatDistanceKm(directDistanceKm)}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestLocation()}
                    disabled={locating}
                    className="text-[11px] font-semibold text-[#0194F3] hover:underline cursor-pointer"
                  >
                    {locating ? "Đang định vị..." : "Bật vị trí"}
                  </button>
                )}
              </div>

              {userLocation && directDistanceKm !== null ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Đường chim bay:</span>
                    <strong className="tabular-nums text-[#10243A] font-bold">
                      ~{routingService.formatDistanceKm(directDistanceKm)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Ước tính di chuyển:</span>
                    <strong className="tabular-nums text-emerald-700 font-bold">
                      ~
                      {routingService.formatDurationMinutes(
                        routingService.estimateDurationMinutes(
                          directDistanceKm,
                          "motorcycle"
                        )
                      )}
                    </strong>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Bật quyền vị trí trên trình duyệt để xem khoảng cách từ bạn đến đây và ước tính thời gian di chuyển.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href={splitMapHref}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#0194F3]/40 px-3 py-2 text-xs font-semibold text-[#10243A] transition-colors"
                >
                  <i className="fa-regular fa-map text-xs" aria-hidden="true" />
                  <span>Trên bản đồ</span>
                </Link>

                <a
                  href={
                    userLocation
                      ? routingService.getGoogleMapsDirectionsUrl(
                          userLocation,
                          {
                            latitude: place.latitude,
                            longitude: place.longitude,
                          },
                          "motorcycle"
                        )
                      : `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#0194F3]/40 px-3 py-2 text-xs font-semibold text-[#10243A] transition-colors"
                >
                  <span>Google Maps</span>
                  <i
                    className="fa-solid fa-arrow-up-right-from-square text-[10px]"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* 6. Related Places Section ("Địa điểm gợi ý" + "Xem thêm" filtered by Area & Category) */}
      {relatedPlaces.length > 0 && (
        <section className="pt-6 border-t border-slate-200/80">
          <SectionHeader
            title="Địa điểm gợi ý"
            viewAllLabel="Xem thêm"
            viewAllHref={seeMoreHref}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedPlaces.map((relPlace) => (
              <PlaceCard key={relPlace.id} place={relPlace} />
            ))}
          </div>
        </section>
      )}

      {/* Full-Screen Photo Gallery Lightbox Modal */}
      <PlacePhotoLightboxModal
        placeName={place.name}
        images={galleryImages}
        open={lightboxIndex !== null}
        activeIndex={lightboxIndex ?? 0}
        onActiveIndexChange={(nextIdx) => setLightboxIndex(nextIdx)}
        onClose={() => setLightboxIndex(null)}
        onContributePhoto={() => setIsContributePhotoOpen(true)}
      />

      {/* Contribute Photo Dialog */}
      <PhotoContributeModal
        place={place}
        open={isContributePhotoOpen}
        onOpenChange={setIsContributePhotoOpen}
        onEnqueueUpload={enqueuePhotoUpload}
      />

      {/* Save to Collection Modal */}
      {isSaveModalOpen && (
        <SaveToCollectionModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          place={place}
        />
      )}

      {/* Add Place to Existing Itinerary Modal */}
      <AddPlaceToItineraryModal
        isOpen={isAddToItineraryOpen}
        onClose={() => setIsAddToItineraryOpen(false)}
        place={place}
      />
    </div>
  );
}

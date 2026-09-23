"use client";

import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Clock,
  DollarSign,
  Heart,
  Share2,
  CalendarPlus,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  Users,
  Lightbulb,
  Camera,
  Compass,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/common/RatingStars";
import { PlaceCard } from "@/components/place/PlaceCard";
import { SectionHeader } from "@/components/common/SectionHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { placeService } from "@/services/place.service";
import { Place } from "@/types/place";
import { MOCK_PLACES } from "@/mocks/data/places";
import { toast } from "sonner";
import { useGeolocation } from "@/features/map/hooks/use-geolocation";
import { routingService } from "@/services/routing.service";

interface PlaceDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default function PlaceDetailPage({ params }: PlaceDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);

  // Synchronous initial resolution from static mock data to avoid any stuck loading spinner
  const initialSlug = resolvedParams?.slug || "";
  let decodedSlug = initialSlug;
  try {
    decodedSlug = decodeURIComponent(initialSlug);
  } catch {
    // keep initialSlug
  }

  const initialPlace =
    MOCK_PLACES.find((p) => p.slug === initialSlug || p.slug === decodedSlug) || null;

  const [place, setPlace] = useState<Place | null>(initialPlace);
  const [relatedPlaces, setRelatedPlaces] = useState<Place[]>(() => {
    if (!initialPlace) return [];
    return MOCK_PLACES.filter((p) => p.id !== initialPlace.id).slice(0, 3);
  });
  const [loading, setLoading] = useState(!initialPlace);
  const [isSaved, setIsSaved] = useState(false);
  const [mainImgError, setMainImgError] = useState(false);
  const [failedThumbnails, setFailedThumbnails] = useState<Record<number, boolean>>({});

  // Geolocation for direct distance and directions
  const { coordinate: userLocation, requestLocation, locating } = useGeolocation();

  useEffect(() => {
    if (!userLocation) {
      requestLocation();
    }
  }, [userLocation, requestLocation]);

  const directDistanceKm = useMemo(() => {
    if (!userLocation || !place?.latitude || !place?.longitude) return null;
    return routingService.calculateDirectDistanceKm(userLocation, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
  }, [userLocation, place?.latitude, place?.longitude]);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const data = await placeService.getPlaceBySlug(initialSlug);
        if (!isCancelled && data) {
          setPlace(data);
          const related = await placeService.getRelatedPlaces(data.id, 3);
          if (!isCancelled) {
            setRelatedPlaces(related);
          }
        }
      } catch (err) {
        console.error("Failed to load place details:", err);
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
  }, [initialSlug]);

  if (loading) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <LoadingState message="Đang tải chi tiết địa điểm..." />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <EmptyState
          title="Không tìm thấy địa điểm"
          description="Địa điểm bạn đang tìm kiếm không tồn tại hoặc đã được cập nhật."
          actionLabel="Trở về trang Khám phá"
          onAction={() => router.push("/explore")}
        />
      </div>
    );
  }

  const toggleSave = () => {
    setIsSaved(!isSaved);
    if (!isSaved) {
      toast.success(`Đã lưu "${place.name}" vào danh sách yêu thích!`);
    } else {
      toast.info(`Đã gỡ "${place.name}" khỏi danh sách lưu.`);
    }
  };

  const handleAddToPlanner = () => {
    toast.success(`Đã thêm "${place.name}" vào lịch trình của bạn!`);
  };

  const handleCreatePlanWithAi = () => {
    toast.success(`AI đang tạo lịch trình du lịch xoay quanh "${place.name}"...`);
    router.push(`/planner/planner-dalat-3n2d`);
  };

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 space-y-12 pb-16">
      {/* Back Button & Breadcrumbs */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 font-semibold text-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Quay lại</span>
        </button>

        <div className="flex items-center gap-2">
          <Link href="/" className="hover:underline">Trang chủ</Link>
          <span>/</span>
          <Link href="/explore" className="hover:underline">Khám phá</Link>
          <span>/</span>
          <span className="font-semibold text-foreground truncate max-w-[200px]">{place.name}</span>
        </div>
      </div>

      {/* Main Hero Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-3xl overflow-hidden">
        {/* Main Cover Photo (Span 8) */}
        <div className="lg:col-span-8 relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-muted rounded-2xl">
          {place.coverImage && !mainImgError ? (
            <Image
              src={place.coverImage}
              alt={place.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="object-cover"
              onError={() => setMainImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-muted/60 text-center">
              <div className="size-16 rounded-full bg-background shadow-xs flex items-center justify-center text-muted-foreground mb-3">
                <Camera className="size-8 text-muted-foreground/70" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Chưa có ảnh thực tế cho {place.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Hình ảnh thực tế sẽ sớm được cập nhật từ cộng đồng du lịch TripGenie.
              </p>
            </div>
          )}
        </div>

        {/* Side Thumbnails (Span 4) */}
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
          {(place.images.length > 1 ? place.images.slice(1, 3) : [null, null]).map((img, idx) => (
            <div
              key={idx}
              className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted"
            >
              {img && !failedThumbnails[idx] ? (
                <Image
                  src={img}
                  alt={`${place.name} - ${idx + 1}`}
                  fill
                  sizes="(max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                  onError={() => setFailedThumbnails((prev) => ({ ...prev, [idx]: true }))}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/40 p-3 text-center">
                  <Camera className="size-6 text-muted-foreground/50 mb-1" />
                  <span className="text-[11px] text-muted-foreground">Ảnh #{idx + 2} (Trống)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Place Main Information & Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Place Details (Span 8) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Header Title Block */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-semibold px-3 py-1 text-xs">
                {place.categoryLabel}
              </Badge>
              {place.matchScore && (
                <Badge className="bg-primary/95 text-primary-foreground font-bold px-3 py-1 text-xs gap-1">
                  <Sparkles className="size-3" />
                  <span>{place.matchScore}% Phù hợp sở thích của bạn</span>
                </Badge>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold font-heading tracking-tight text-foreground">
              {place.name}
            </h1>

            {place.tagline && (
              <p className="text-base text-primary font-medium">
                {place.tagline}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <RatingStars
                rating={place.rating}
                showValue
                reviewCount={place.reviewCount}
                size="md"
              />
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 text-primary" />
                {place.address}
              </span>
              {directDistanceKm !== null && directDistanceKm > 0 && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full text-xs">
                    <span>📍 Cách bạn ~{routingService.formatDistanceKm(directDistanceKm)}</span>
                    <span className="text-[11px] text-muted-foreground font-normal">(đường chim bay)</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Highlights Box (Vì sao nên đi) */}
          {place.whyGo && place.whyGo.length > 0 && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="size-4 text-accent-foreground" />
                <span>Điểm nổi bật nhất (Highlights):</span>
              </h3>
              <ul className="space-y-2 text-sm text-foreground">
                {place.whyGo.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-foreground font-heading">
              Giới thiệu địa điểm
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {place.description}
            </p>
          </div>

          {/* Useful Tips */}
          {place.tips && place.tips.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Lightbulb className="size-4 text-amber-500" />
                <span>Mẹo & Lưu ý hữu ích:</span>
              </h3>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {place.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-bold text-primary">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-xs font-semibold text-muted-foreground">Chủ đề:</span>
            <div className="flex flex-wrap gap-2">
              {place.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg bg-secondary/80 px-3 py-1 text-xs font-medium text-secondary-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Floating Action Card (Span 4) */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-6 shadow-sm">
            {/* Quick Info Grid */}
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="size-4 text-emerald-600" /> Chi phí ước tính:
                </span>
                <span className="font-bold text-foreground text-sm">
                  {place.priceRangeText}
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-4 text-primary" /> Thời gian tham quan:
                </span>
                <span className="font-medium text-foreground">
                  {place.suggestedDuration || "1.5 - 2 giờ"}
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-4 text-primary" /> Phù hợp đối tượng:
                </span>
                <div className="flex gap-1">
                  {place.suitableFor.map((aud) => (
                    <Badge key={aud} variant="secondary" className="text-[10px] uppercase font-bold">
                      {aud}
                    </Badge>
                  ))}
                </div>
              </div>

              {place.openingHoursText && (
                <div className="space-y-1">
                  <span className="text-muted-foreground">Giờ mở cửa:</span>
                  <p className="font-semibold text-foreground">{place.openingHoursText}</p>
                </div>
              )}
            </div>

            {/* Distance & Directions Box */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="size-4 text-primary" />
                  <span>Khoảng cách & Chỉ đường</span>
                </span>
                {userLocation ? (
                  <span className="text-[11px] font-bold text-foreground bg-background/90 px-2 py-0.5 rounded-md border border-border/60 shadow-2xs">
                    ~{directDistanceKm ? routingService.formatDistanceKm(directDistanceKm) : "0 km"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={requestLocation}
                    disabled={locating}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    {locating ? "Đang định vị..." : "Bật vị trí"}
                  </button>
                )}
              </div>

              {userLocation && directDistanceKm !== null ? (
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Đường chim bay:</span>
                    <strong className="text-foreground font-semibold">
                      ~{routingService.formatDistanceKm(directDistanceKm)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Ước tính di chuyển:</span>
                    <span className="text-foreground font-semibold text-emerald-600 dark:text-emerald-400">
                      🏍️ ~{routingService.formatDurationMinutes(routingService.estimateDurationMinutes(directDistanceKm, "motorcycle"))}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Bật quyền vị trí trên trình duyệt để biết khoảng cách từ bạn đến đây và chỉ đường đi.
                </p>
              )}

              {/* Action Buttons for Directions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href={`/explore?view=split&areaId=${place.city || "all"}&selected=${place.id}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
                >
                  <Compass className="size-3.5" />
                  <span>Trên bản đồ</span>
                </Link>

                <a
                  href={
                    userLocation
                      ? routingService.getGoogleMapsDirectionsUrl(
                          userLocation,
                          { latitude: place.latitude, longitude: place.longitude },
                          "motorcycle"
                        )
                      : `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <Button
                onClick={handleAddToPlanner}
                className="w-full h-11 font-bold gap-2 rounded-xl bg-primary text-primary-foreground shadow-xs"
              >
                <CalendarPlus className="size-4" />
                <span>Thêm vào lịch trình</span>
              </Button>

              <Button
                onClick={handleCreatePlanWithAi}
                variant="outline"
                className="w-full h-11 font-semibold gap-2 rounded-xl border-primary/40 text-primary hover:bg-primary/10"
              >
                <Sparkles className="size-4 text-accent-foreground" />
                <span>✨ Tạo lịch trình AI từ điểm này</span>
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="ghost"
                  onClick={toggleSave}
                  className={`h-9 text-xs rounded-xl border border-border/70 ${
                    isSaved ? "text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/30" : ""
                  }`}
                >
                  <Heart className={`size-3.5 mr-1.5 ${isSaved ? "fill-current" : ""}`} />
                  <span>{isSaved ? "Đã lưu" : "Lưu điểm"}</span>
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    toast.success("Đã sao chép liên kết địa điểm!");
                  }}
                  className="h-9 text-xs rounded-xl border border-border/70 text-muted-foreground hover:text-foreground"
                >
                  <Share2 className="size-3.5 mr-1.5" />
                  <span>Chia sẻ</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Places Section */}
      {relatedPlaces.length > 0 && (
        <section className="pt-8 border-t border-border">
          <SectionHeader
            badge="Gợi ý thêm"
            title="Địa điểm tương tự bạn cũng sẽ thích"
            subtitle="Các điểm đến gần khu vực hoặc cùng phong cách để bạn kết hợp vào chuyến đi."
            viewAllHref="/explore"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedPlaces.map((relPlace) => (
              <PlaceCard key={relPlace.id} place={relPlace} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

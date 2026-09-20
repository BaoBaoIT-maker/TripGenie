"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Phone,
  Globe,
  Clock,
  MapPin,
  Star,
  Heart,
  CalendarPlus,
  Info,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mapDiscoveryService } from "./services/map-discovery.service";
import type { DiscoveryPlace } from "./types";

export interface MapPlaceDetailDialogProps {
  placeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MapPlaceDetailDialog({
  placeId,
  open,
  onOpenChange,
}: MapPlaceDetailDialogProps) {
  const [place, setPlace] = useState<DiscoveryPlace | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loading = Boolean(open && placeId && (!place || place.id !== placeId));

  useEffect(() => {
    let active = true;
    if (open && placeId) {
      mapDiscoveryService
        .getPlaceById(placeId)
        .then((data) => {
          if (active) {
            setPlace(data);
          }
        })
        .catch(() => {
          if (active) {
            setPlace(null);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [open, placeId]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPlace(null);
      setActionFeedback(null);
    }
    onOpenChange(nextOpen);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    setActionFeedback(
      !isFavorite
        ? "Đã lưu vào danh sách yêu thích (Bản demo)"
        : "Đã bỏ lưu khỏi danh sách yêu thích (Bản demo)"
    );
  };

  const handleAddToPlanner = () => {
    setActionFeedback(
      "Tính năng thêm vào lịch trình đang ở chế độ xem trước (Bản demo)."
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Đang tải thông tin địa điểm...</div>
        ) : place ? (
          <div className="flex flex-col">
            {/* Image Gallery / Cover */}
            <div className="relative h-60 w-full bg-muted overflow-hidden">
              {place.primaryImage ? (
                <Image
                  src={place.primaryImage}
                  alt={place.name}
                  fill
                  sizes="600px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground text-sm">
                  Chưa có ảnh địa điểm
                </div>
              )}

              {/* Demo Badge */}
              <div className="absolute top-3 left-3 z-10">
                <Badge variant="secondary" className="bg-background/90 backdrop-blur-xs text-xs font-semibold shadow-xs">
                  Dữ liệu mẫu
                </Badge>
              </div>

              {/* Heart favorite button */}
              <button
                type="button"
                onClick={toggleFavorite}
                aria-label="Lưu vào danh sách yêu thích"
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/90 backdrop-blur-xs text-muted-foreground hover:text-red-500 shadow-xs transition-colors"
              >
                <Heart className={`size-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4">
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-primary font-medium text-xs">
                    {place.categoryLabel}
                  </Badge>
                  {place.demoSimilarityScore && (
                    <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs">
                      <Sparkles className="size-3 text-amber-500" />
                      <span>Độ phù hợp AI: {place.demoSimilarityScore}% (Mô phỏng)</span>
                    </Badge>
                  )}
                  {place.isOpenNow === true ? (
                    <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs">
                      Đang mở cửa
                    </Badge>
                  ) : place.isOpenNow === false ? (
                    <Badge variant="outline" className="text-destructive bg-destructive/10 text-xs">
                      Đã đóng cửa
                    </Badge>
                  ) : null}
                </div>

                <DialogTitle className="text-xl font-bold text-foreground mt-1">
                  {place.name}
                </DialogTitle>

                {place.rating && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-1 text-amber-600 font-semibold text-sm">
                      <Star className="size-4 fill-amber-500 text-amber-500" />
                      {place.rating}
                    </span>
                    <span>({place.reviewCount} đánh giá)</span>
                    {place.priceLevel && (
                      <span className="font-medium text-emerald-700 dark:text-emerald-300 ml-2">
                        • Mức giá:{" "}
                        {place.priceLevel === 1 && "≤ 100.000 đ (Bình dân)"}
                        {place.priceLevel === 2 && "100.000 đ - 300.000 đ (Vừa phải)"}
                        {place.priceLevel === 3 && "300.000 đ - 800.000 đ (Cao cấp)"}
                        {place.priceLevel === 4 && "> 800.000 đ (Sang trọng)"}
                      </span>
                    )}
                  </div>
                )}
              </DialogHeader>

              {/* Feedback Alert */}
              {actionFeedback && (
                <div
                  role="status"
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary"
                >
                  <Info className="size-4 shrink-0" />
                  <span>{actionFeedback}</span>
                </div>
              )}

              {/* Address */}
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                <span>{place.address}</span>
              </div>

              {/* Hours */}
              {place.openingHours && (
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                  <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>{place.openingHours}</span>
                </div>
              )}

              {/* Contact Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {place.phone && (
                  <a
                    href={`tel:${place.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Phone className="size-3.5 text-primary" />
                    <span>Gọi {place.phone}</span>
                  </a>
                )}
                {place.website && (
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Globe className="size-3.5 text-primary" />
                    <span>Trang web</span>
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </a>
                )}
              </div>

              {/* Tags */}
              {place.tags && place.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                  {place.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Sources info */}
              {place.sources && place.sources.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                  <span>Dữ liệu tham khảo từ:</span>
                  {place.sources.map((s) => (
                    <Badge key={s.provider} variant="outline" className="text-[10px] py-0 px-1.5">
                      {s.provider}
                    </Badge>
                  ))}
                </div>
              )}

              {/* CTA Add to Trip */}
              <div className="pt-3 border-t">
                <Button
                  type="button"
                  onClick={handleAddToPlanner}
                  className="w-full gap-2 rounded-xl h-11 font-semibold"
                >
                  <CalendarPlus className="size-4" />
                  <span>+ Thêm vào lịch trình du lịch (Bản demo)</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Không tìm thấy địa điểm</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

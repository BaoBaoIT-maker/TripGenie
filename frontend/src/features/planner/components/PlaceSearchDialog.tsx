"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Search, MapPin, Star, AlertCircle } from "lucide-react";
import { Place } from "@/types/place";
import { placeService } from "@/services/place.service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PlaceSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlace: (place: Place) => void;
}

export function PlaceSearchDialog({
  open,
  onOpenChange,
  onSelectPlace,
}: PlaceSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChangeInternal = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setPlaces([]);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await placeService.getPlaces({
          keyword: query.trim() || undefined,
        });
        setPlaces(results);
      } catch {
        setError("Không thể tải danh sách địa điểm. Vui lòng thử lại.");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  const handleSelect = (place: Place) => {
    onSelectPlace(place);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeInternal}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle>Tìm kiếm địa điểm</DialogTitle>
          <DialogDescription>
            Tìm và thêm điểm đến từ kho dữ liệu du lịch vào lịch trình của bạn.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative my-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên quán cafe, bảo tàng, danh lam thắng cảnh..."
            className="pl-9 h-11 rounded-xl text-sm"
            autoFocus
          />
        </div>

        {/* Results / States */}
        <div className="flex-1 overflow-y-auto min-h-[250px] max-h-[400px] space-y-2 pr-1">
          {isLoading && (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-18 rounded-2xl bg-muted/40 animate-pulse"
                />
              ))}
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 text-destructive">
              <AlertCircle className="size-8" />
              <p className="text-xs font-semibold">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuery((q) => q + " ")}
                className="text-xs rounded-xl"
              >
                Thử lại
              </Button>
            </div>
          )}

          {!isLoading && !error && places.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-1">
              <MapPin className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">
                Không tìm thấy địa điểm phù hợp
              </p>
              <p className="text-xs">
                Hãy thử tìm kiếm với từ khóa khác (ví dụ: cafe, chợ, dinh, hồ...)
              </p>
            </div>
          )}

          {!isLoading &&
            !error &&
            places.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => handleSelect(place)}
                className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-border/80 hover:bg-muted/40 transition-colors group cursor-pointer"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted/40">
                  {place.coverImage ? (
                    <Image
                      src={place.coverImage}
                      alt={place.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      Ảnh
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {place.name}
                    </h4>
                    {place.rating && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 shrink-0">
                        <Star className="size-3 fill-amber-500" />
                        {place.rating}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground truncate">
                    {place.address || place.city}
                  </p>

                  <span className="inline-block text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.2 rounded-md">
                    {place.categoryLabel || place.category}
                  </span>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

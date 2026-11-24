"use client";

import { useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/LocaleProvider";

interface PlacePhotoLightboxModalProps {
  placeName: string;
  images: string[];
  open: boolean;
  activeIndex: number;
  onActiveIndexChange: (nextIndex: number) => void;
  onClose: () => void;
  onContributePhoto?: () => void;
}

export function PlacePhotoLightboxModal({
  placeName,
  images,
  open,
  activeIndex,
  onActiveIndexChange,
  onClose,
  onContributePhoto,
}: PlacePhotoLightboxModalProps) {
  const { t, messages } = useI18n();
  const lb = messages.place.lightbox;
  const total = images.length;
  const safeIndex = total > 0 ? ((activeIndex % total) + total) % total : 0;

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    onActiveIndexChange((safeIndex - 1 + total) % total);
  }, [onActiveIndexChange, safeIndex, total]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    onActiveIndexChange((safeIndex + 1) % total);
  }, [onActiveIndexChange, safeIndex, total]);

  useEffect(() => {
    if (!open || total <= 1) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, total, handlePrev, handleNext]);

  if (total === 0) return null;

  const currentUrl = images[safeIndex];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-4xl w-[95vw] rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/90 shadow-2xl font-sans text-[#10243A] space-y-3.5"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="min-w-0 flex items-center gap-2.5">
            <DialogTitle className="text-base sm:text-lg font-extrabold text-[#10243A] truncate">
              {placeName}
            </DialogTitle>
            <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-slate-700 tabular-nums">
              {safeIndex + 1} / {total}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onContributePhoto && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onContributePhoto();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-[#F0F7FF] hover:text-[#0194F3] hover:border-[#0194F3]/40 text-xs font-semibold text-[#10243A] transition-colors cursor-pointer"
              >
                <i
                  className="fa-solid fa-camera text-[#0194F3] text-xs"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">{lb.contributeMore}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label={lb.closeAria}
              className="size-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-[#10243A] inline-flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
            </button>
          </div>
        </DialogHeader>

        {/* Main Image Viewport */}
        <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-200/80 flex items-center justify-center select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={t("place.lightbox.imageAlt", { name: placeName, index: safeIndex + 1 })}
            className="max-h-full max-w-full w-full h-full object-contain"
          />

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                aria-label={lb.prevAria}
                className="absolute left-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-white/90 hover:bg-white text-[#10243A] shadow-md border border-slate-200/80 inline-flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              >
                <i
                  className="fa-solid fa-chevron-left text-sm"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={handleNext}
                aria-label={lb.nextAria}
                className="absolute right-3 top-1/2 -translate-y-1/2 size-11 rounded-full bg-white/90 hover:bg-white text-[#10243A] shadow-md border border-slate-200/80 inline-flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              >
                <i
                  className="fa-solid fa-chevron-right text-sm"
                  aria-hidden="true"
                />
              </button>
            </>
          )}
        </div>

        {/* Horizontal Filmstrip Thumbnails */}
        {total > 1 && (
          <div
            role="tablist"
            aria-label={lb.thumbnailsAria}
            className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5"
          >
            {images.map((imgUrl, idx) => {
              const isCurrent = idx === safeIndex;
              return (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  aria-label={t("place.lightbox.viewImageAria", { index: idx + 1 })}
                  onClick={() => onActiveIndexChange(idx)}
                  className={`relative h-14 w-20 shrink-0 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    isCurrent
                      ? "border-[#0194F3] ring-2 ring-[#0194F3] opacity-100"
                      : "border-slate-200 opacity-65 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

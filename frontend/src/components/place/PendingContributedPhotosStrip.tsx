"use client";

import { CONTRIBUTED_PHOTO_STATES } from "@/types/place";
import type { ContributedPhotoItem } from "@/components/place/use-place-photo-contributions";
import { useI18n } from "@/i18n";

interface PendingContributedPhotosStripProps {
  placeName: string;
  photos: ContributedPhotoItem[];
  onRetry: (clientKey: string) => void;
  onDismiss: (clientKey: string) => void;
}

export function PendingContributedPhotosStrip({
  placeName,
  photos,
  onRetry,
  onDismiss,
}: PendingContributedPhotosStripProps) {
  const { t, messages } = useI18n();
  const ps = messages.place.pendingStrip;
  if (photos.length === 0) return null;

  const uploadingCount = photos.filter(
    (p) => p.uploadState === CONTRIBUTED_PHOTO_STATES.UPLOADING
  ).length;
  const errorCount = photos.filter(
    (p) => p.uploadState === CONTRIBUTED_PHOTO_STATES.ERROR
  ).length;
  const pendingCount = photos.length - uploadingCount - errorCount;

  const pendingSuffix =
    pendingCount > 0
      ? t("place.pendingStrip.pendingSuffix", { count: pendingCount })
      : "";

  const containerToneClass =
    errorCount > 0
      ? "border-rose-200/90 bg-rose-50/40"
      : uploadingCount > 0
        ? "border-sky-200/90 bg-sky-50/40"
        : "border-amber-200/90 bg-amber-50/55";

  return (
    <section
      aria-label={ps.sectionAria}
      className={`rounded-2xl border p-4 space-y-2.5 transition-colors ${containerToneClass}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {uploadingCount > 0 ? (
            <i
              className="fa-solid fa-circle-notch fa-spin text-xs text-[#0194F3] shrink-0"
              aria-hidden="true"
            />
          ) : errorCount > 0 ? (
            <i
              className="fa-solid fa-circle-exclamation text-xs text-rose-600 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <i
              className="fa-regular fa-clock text-xs text-amber-600 shrink-0"
              aria-hidden="true"
            />
          )}

          <span className="text-xs font-bold text-[#10243A] tabular-nums">
            {uploadingCount > 0
              ? `${t("place.pendingStrip.uploadingTitle", { count: uploadingCount })}${pendingSuffix}`
              : errorCount > 0
                ? `${t("place.pendingStrip.errorTitle", { count: errorCount })}${pendingSuffix}`
                : t("place.pendingStrip.pendingOnlyTitle", { count: pendingCount })}
          </span>
        </div>

        <span className="text-[11px] font-medium text-slate-600">
          {uploadingCount > 0
            ? ps.uploadingHint
            : errorCount > 0
              ? ps.errorHint
              : ps.pendingHint}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((item) => {
          const isUploading =
            item.uploadState === CONTRIBUTED_PHOTO_STATES.UPLOADING;
          const isError = item.uploadState === CONTRIBUTED_PHOTO_STATES.ERROR;

          return (
            <div
              key={item.clientKey}
              title={item.errorMessage || item.caption || undefined}
              className={`relative aspect-[16/10] rounded-xl overflow-hidden border bg-white ${
                isError
                  ? "border-rose-300 ring-1 ring-rose-200"
                  : isUploading
                    ? "border-sky-300"
                    : "border-amber-200/90"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.caption || t("place.pendingStrip.photoAlt", { name: placeName })}
                loading="lazy"
                className={`w-full h-full object-cover transition-opacity ${
                  isUploading
                    ? "opacity-65"
                    : isError
                      ? "opacity-45"
                      : "opacity-90"
                }`}
              />

              {isUploading && (
                <>
                  <div className="absolute inset-0 bg-[#10243A]/35 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1 text-white px-2 text-center">
                    <i
                      className="fa-solid fa-circle-notch fa-spin text-xs"
                      aria-hidden="true"
                    />
                    <span className="text-[11px] font-bold tracking-tight">
                      {ps.uploadingOverlay}
                    </span>
                  </div>
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-sky-100/95 text-[#0369A1] border border-sky-300/80 text-[10px] font-extrabold">
                    {ps.sendingBadge}
                  </span>
                </>
              )}

              {isError && (
                <div className="absolute inset-0 bg-[#10243A]/65 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 p-2 text-center">
                  <span className="text-[11px] font-bold text-white leading-tight line-clamp-2">
                    {ps.failedOverlay}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onRetry(item.clientKey)}
                      className="inline-flex items-center gap-1 rounded-lg bg-white hover:bg-slate-100 text-[#10243A] text-[11px] font-bold px-2.5 py-1 transition-colors cursor-pointer"
                    >
                      <i
                        className="fa-solid fa-rotate-left text-[10px]"
                        aria-hidden="true"
                      />
                      <span>{ps.retry}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss(item.clientKey)}
                      aria-label={ps.dismissAria}
                      className="inline-flex items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 transition-colors cursor-pointer"
                    >
                      <i
                        className="fa-solid fa-xmark text-xs"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              )}

              {!isUploading && !isError && (
                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-amber-100/95 text-amber-900 border border-amber-300/80 text-[10px] font-extrabold">
                  {ps.pendingBadge}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/api-client";
import { placeService } from "@/services/place.service";
import { PLACE_PHOTO_UPLOAD_CONFIG } from "@/features/admin/admin.constants";
import type { EnqueuePhotoUploadPayload } from "@/components/place/use-place-photo-contributions";
import type { PendingContributedPhoto, Place } from "@/types/place";
import { useI18n } from "@/i18n";

interface PhotoContributeModalProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, hands off upload to caller for instant background Honest Optimistic UI */
  onEnqueueUpload?: (payload: EnqueuePhotoUploadPayload) => void;
  /** Used in standalone fallback mode when onEnqueueUpload is not supplied */
  onPhotoSubmitted?: (photo: PendingContributedPhoto) => void;
}

export function PhotoContributeModal({
  place,
  open,
  onOpenChange,
  onEnqueueUpload,
  onPhotoSubmitted,
}: PhotoContributeModalProps) {
  const { t, messages } = useI18n();
  const pm = messages.place.photoModal;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const resetForm = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setCaption("");
    setSubmitted(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const mime = (selected.type || "").toLowerCase().trim();
    if (mime.startsWith("video/")) {
      toast.error(pm.errorVideoNotSupported);
      e.target.value = "";
      return;
    }

    if (!PLACE_PHOTO_UPLOAD_CONFIG.ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
      toast.error(pm.errorInvalidFormat);
      e.target.value = "";
      return;
    }

    if (selected.size > PLACE_PHOTO_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES) {
      toast.error(
        t("place.photoModal.errorFileTooLarge", {
          maxMb: PLACE_PHOTO_UPLOAD_CONFIG.MAX_FILE_SIZE_MB,
        })
      );
      e.target.value = "";
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!place?.id) {
      toast.error(pm.errorMissingPlace);
      return;
    }
    if (!file) {
      toast.error(pm.errorMissingFile);
      return;
    }

    const trimmedCaption = caption.trim() || undefined;

    if (onEnqueueUpload) {
      onEnqueueUpload({
        placeId: place.id,
        file,
        caption: trimmedCaption,
      });
      resetForm();
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      const res = await placeService.contributePhoto(
        place.id,
        file,
        trimmedCaption
      );
      if (res.image) {
        onPhotoSubmitted?.({
          id: res.image.id,
          imageUrl: res.image.imageUrl,
          caption: res.image.caption,
        });
      }
      setSubmitted(true);
      toast.success(pm.uploadSuccess);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 401) {
        toast.error(pm.errorUnauthorized);
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
      } else {
        toast.error(pm.errorUploadFallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#0194F3] font-bold text-xs uppercase tracking-wider">
            <i className="fa-solid fa-camera text-xs" aria-hidden="true" />
            <span>{pm.eyebrow}</span>
          </div>
          <DialogTitle className="text-lg font-extrabold text-[#10243A]">
            {place?.name || pm.fallbackPlace}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {place?.address || place?.city}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-5 flex flex-col items-center text-center space-y-3">
            <div className="size-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <i className="fa-solid fa-circle-check text-xl" aria-hidden="true" />
            </div>
            <h4 className="text-base font-extrabold text-[#10243A]">
              {pm.submittedTitle}
            </h4>
            <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
              {pm.submittedDesc}
            </p>
            <div className="rounded-xl bg-[#F8FAFC] p-3 border border-slate-200 text-xs text-left space-y-1 w-full mt-2">
              <div className="flex items-center gap-1.5 font-bold text-[#10243A]">
                <i
                  className="fa-solid fa-shield-halved text-xs text-[#0194F3]"
                  aria-hidden="true"
                />
                <span>{pm.moderationTitle}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {pm.moderationDesc}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleClose}
              className="mt-3 w-full rounded-xl bg-[#0194F3] hover:bg-[#0084DE] text-white font-bold"
            >
              {pm.done}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-1">
            <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-3 text-xs text-amber-950 flex items-start gap-2.5">
              <i
                className="fa-solid fa-shield-halved text-xs text-amber-600 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-[11px] leading-relaxed">
                <strong>{pm.noteLabel}</strong> {pm.noteText}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="photo-input"
                className="text-xs font-bold text-[#10243A] block"
              >
                {pm.selectFromDevice}
              </label>
              {preview ? (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={pm.previewAlt}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      if (preview) URL.revokeObjectURL(preview);
                      setFile(null);
                      setPreview(null);
                    }}
                    className="absolute top-2 right-2 rounded-lg bg-[#10243A]/80 hover:bg-[#10243A] text-white text-xs font-semibold px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {pm.changePhoto}
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="photo-input"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 bg-[#F8FAFC] hover:bg-[#F0F7FF] hover:border-[#0194F3]/50 cursor-pointer transition-colors"
                >
                  <i
                    className="fa-solid fa-cloud-arrow-up text-2xl text-[#0194F3] mb-2"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-bold text-[#10243A]">
                    {pm.pickFromDevice}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {t("place.photoModal.formatHint", {
                      maxMb: PLACE_PHOTO_UPLOAD_CONFIG.MAX_FILE_SIZE_MB,
                    })}
                  </span>
                  <input
                    id="photo-input"
                    type="file"
                    accept={PLACE_PHOTO_UPLOAD_CONFIG.ACCEPT_ATTR}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="photo-caption"
                className="text-xs font-bold text-[#10243A] block"
              >
                {pm.captionLabel}
              </label>
              <Input
                id="photo-caption"
                value={caption}
                maxLength={PLACE_PHOTO_UPLOAD_CONFIG.MAX_CAPTION_LENGTH}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                onChange={(e) => setCaption(e.target.value)}
                placeholder={pm.captionPlaceholder}
                className="text-xs h-10 rounded-xl border-slate-200"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-xl"
              >
                {pm.cancel}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!file || submitting}
                className="gap-1.5 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] text-white font-bold"
              >
                {submitting && (
                  <i
                    className="fa-solid fa-circle-notch fa-spin text-xs"
                    aria-hidden="true"
                  />
                )}
                <span>{submitting ? pm.uploading : pm.submit}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

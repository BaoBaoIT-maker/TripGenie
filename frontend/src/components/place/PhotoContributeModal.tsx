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
import {
  PLACE_PHOTO_UPLOAD_CONFIG,
  PLACE_PHOTO_UPLOAD_MESSAGES,
} from "@/features/admin/admin.constants";
import type { EnqueuePhotoUploadPayload } from "@/components/place/use-place-photo-contributions";
import type { PendingContributedPhoto, Place } from "@/types/place";

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
      toast.error(
        "Không hỗ trợ tải lên video. Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WebP)."
      );
      e.target.value = "";
      return;
    }

    if (!PLACE_PHOTO_UPLOAD_CONFIG.ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
      toast.error("Định dạng không hợp lệ. Chỉ chấp nhận hình ảnh JPG, PNG hoặc WebP.");
      e.target.value = "";
      return;
    }

    if (selected.size > PLACE_PHOTO_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES) {
      toast.error(
        `Ảnh vượt quá dung lượng tối đa ${PLACE_PHOTO_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB.`
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
      toast.error("Không xác định được địa điểm để đóng góp ảnh.");
      return;
    }
    if (!file) {
      toast.error("Vui lòng chọn 1 tệp hình ảnh để đóng góp.");
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
      toast.success(res.message || PLACE_PHOTO_UPLOAD_MESSAGES.UPLOAD_SUCCESS);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 401) {
        toast.error(PLACE_PHOTO_UPLOAD_MESSAGES.UNAUTHORIZED);
      } else if (err instanceof Error && err.message) {
        toast.error(err.message);
      } else {
        toast.error(PLACE_PHOTO_UPLOAD_MESSAGES.UPLOAD_FAILED_FALLBACK);
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
            <span>Đóng góp ảnh thực tế</span>
          </div>
          <DialogTitle className="text-lg font-extrabold text-[#10243A]">
            {place?.name || "Địa điểm"}
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
              Đã gửi ảnh chờ kiểm duyệt
            </h4>
            <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
              Cảm ơn bạn đã đóng góp cho cộng đồng TripGenie. Ảnh của bạn đã được chuyển vào hàng đợi duyệt của Quản trị viên.
            </p>
            <div className="rounded-xl bg-[#F8FAFC] p-3 border border-slate-200 text-xs text-left space-y-1 w-full mt-2">
              <div className="flex items-center gap-1.5 font-bold text-[#10243A]">
                <i
                  className="fa-solid fa-shield-halved text-xs text-[#0194F3]"
                  aria-hidden="true"
                />
                <span>Quy trình kiểm duyệt chất lượng</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Quản trị viên sẽ xác minh ảnh thực tế trước khi hiển thị công khai trên trang chi tiết địa điểm.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleClose}
              className="mt-3 w-full rounded-xl bg-[#0194F3] hover:bg-[#0084DE] text-white font-bold"
            >
              Hoàn tất
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
                <strong>Lưu ý:</strong> Chỉ chấp nhận <strong>hình ảnh thực tế</strong> (JPG, PNG, WebP — không hỗ trợ video). Ảnh sẽ được Quản trị viên duyệt trước khi hiển thị.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="photo-input"
                className="text-xs font-bold text-[#10243A] block"
              >
                Chọn hình ảnh từ thiết bị
              </label>
              {preview ? (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Xem trước ảnh đóng góp"
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
                    Thay ảnh khác
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
                    Bấm để chọn ảnh từ máy
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    Chỉ hỗ trợ JPG, PNG, WebP (Tối đa{" "}
                    {PLACE_PHOTO_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB — Không nhận video)
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
                Mô tả ngắn (Tùy chọn)
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
                placeholder="Ví dụ: Góc chụp mặt tiền, không gian bên trong..."
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
                Hủy bỏ
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
                <span>{submitting ? "Đang tải lên..." : "Gửi ảnh kiểm duyệt"}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

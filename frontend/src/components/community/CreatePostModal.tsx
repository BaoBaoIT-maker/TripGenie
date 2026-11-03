"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  CalendarDays,
  Loader2,
  Film,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateCommunityPost,
  useUploadCommunityMedia,
} from "@/features/community/hooks/use-community";
import { useItinerariesListQuery } from "@/features/planner/hooks/use-itinerary-planner";
import { COMMUNITY_UI_CONSTANTS } from "@/services/community.service";
import type { UploadedMediaItem } from "@/types/community";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreatePostModal({ open, onClose }: CreatePostModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [selectedItineraryId, setSelectedItineraryId] = useState<string>("");
  const [uploadedItems, setUploadedItems] = useState<UploadedMediaItem[]>([]);

  const uploadMediaMutation = useUploadCommunityMedia();
  const createPostMutation = useCreateCommunityPost();

  const { data: myItineraries = [], isLoading: isLoadingItineraries } =
    useItinerariesListQuery();

  // WCAG 2.2 AA & frontend.md §4: Handle Escape key & lock background scroll when modal is open
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const remainingSlots =
      COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES - uploadedItems.length;
    const files = Array.from(fileList).slice(0, remainingSlots);
    if (files.length === 0) return;

    try {
      const res = await uploadMediaMutation.mutateAsync(files);
      setUploadedItems((prev) =>
        [...prev, ...(res.items || [])].slice(
          0,
          COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES
        )
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveMedia = (url: string) => {
    setUploadedItems((prev) => prev.filter((item) => item.url !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedTags = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    await createPostMutation.mutateAsync({
      title: title.trim(),
      caption: caption.trim() || undefined,
      mediaUrls: uploadedItems.map((item) => item.url),
      tags: parsedTags,
      itineraryId: selectedItineraryId || undefined,
    });

    setTitle("");
    setCaption("");
    setTagsInput("");
    setSelectedItineraryId("");
    setUploadedItems([]);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-card text-foreground shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2
              id="create-post-modal-title"
              className="text-lg font-bold font-heading text-foreground"
            >
              Tạo bài chia sẻ mới
            </h2>
            <p className="text-xs text-muted-foreground">
              Tải lên ảnh, video ngắn từ máy và đính kèm lịch trình chuyến đi của bạn
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Đóng hộp thoại tạo bài viết"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="post-title-input"
              className="block text-xs font-semibold text-foreground"
            >
              Tiêu đề bài viết <span className="text-destructive">*</span>
            </label>
            <input
              id="post-title-input"
              type="text"
              required
              maxLength={COMMUNITY_UI_CONSTANTS.MAX_TITLE_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Đà Lạt 3N2Đ săn mây Cầu Đất & lẩu gà lá é chiều mưa"
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="post-caption-input"
              className="block text-xs font-semibold text-foreground"
            >
              Nội dung chia sẻ kinh nghiệm
            </label>
            <textarea
              id="post-caption-input"
              rows={4}
              maxLength={COMMUNITY_UI_CONSTANTS.MAX_CAPTION_LENGTH}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Chia sẻ cảm nhận thực tế, thời điểm đẹp nhất trong ngày, chi phí ăn uống hoặc lưu ý di chuyển..."
              className="w-full p-3.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed"
            />
          </div>

          {/* Local Media Upload Zone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-foreground">
                Ảnh / Video ngắn từ thiết bị ({uploadedItems.length}/
                {COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES})
              </label>
              <span className="text-xs text-muted-foreground">
                Hỗ trợ JPG, PNG, WebP, GIF, MP4, WebM, MOV (tối đa 50MB/tệp)
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={COMMUNITY_UI_CONSTANTS.ACCEPTED_MEDIA_MIMES}
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              disabled={
                uploadMediaMutation.isPending ||
                uploadedItems.length >= COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES
              }
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 rounded-2xl border border-dashed border-border hover:border-primary/60 bg-muted/30 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {uploadMediaMutation.isPending ? (
                <>
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Đang tải tệp lên máy chủ...
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-primary">
                    <Upload className="size-4" />
                    <ImageIcon className="size-4" />
                    <Film className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    Nhấn để chọn ảnh hoặc video từ máy tính / điện thoại
                  </span>
                </>
              )}
            </button>

            {/* Uploaded Media Previews */}
            {uploadedItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {uploadedItems.map((item) => (
                  <div
                    key={item.url}
                    className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-video"
                  >
                    {item.mediaType === "VIDEO" ? (
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt="Tệp đa phương tiện đã tải lên"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(item.url)}
                      className="absolute top-1.5 right-1.5 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg bg-black/70 text-white hover:bg-destructive transition-colors cursor-pointer"
                      aria-label="Gỡ tệp đa phương tiện này"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/65 text-white text-xs font-medium">
                      {item.mediaType === "VIDEO" ? "Video" : "Ảnh"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attach Owned Itinerary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="post-itinerary-select"
                className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
              >
                <CalendarDays className="size-3.5 text-primary" />
                <span>Đính kèm lịch trình của bạn (Tùy chọn)</span>
              </label>
              <select
                id="post-itinerary-select"
                value={selectedItineraryId}
                onChange={(e) => setSelectedItineraryId(e.target.value)}
                disabled={isLoadingItineraries}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">-- Không đính kèm lịch trình --</option>
                {myItineraries.map((itin) => (
                  <option key={itin.id} value={itin.id}>
                    {itin.title} ({itin.destination || `${itin.totalDays} ngày`})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="post-tags-input"
                className="block text-xs font-semibold text-foreground"
              >
                Thẻ chủ đề (Hashtags)
              </label>
              <input
                id="post-tags-input"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="#DaLat, #SanMay, #AmThuc"
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={
                !title.trim() ||
                createPostMutation.isPending ||
                uploadMediaMutation.isPending
              }
              className="h-11 px-5 rounded-xl text-xs font-semibold gap-2 cursor-pointer"
            >
              {createPostMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              <span>Đăng lên Cộng đồng</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useCreateCommunityPost,
  useUploadCommunityMedia,
} from "@/features/community/hooks/use-community";
import { useItinerariesListQuery } from "@/features/planner/hooks/use-itinerary-planner";
import { COMMUNITY_UI_CONSTANTS } from "@/services/community.service";
import {
  POPULAR_COMMUNITY_TAGS,
  normalizeKeyword,
} from "@/features/community/config/community-suggestions";
import type { UploadedMediaItem } from "@/types/community";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  initialFiles?: File[];
  focusItinerary?: boolean;
}

export function CreatePostModal({
  open,
  onClose,
  initialFiles,
  focusItinerary,
}: CreatePostModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itinerarySelectRef = useRef<HTMLSelectElement | null>(null);
  const hasProcessedInitialFilesRef = useRef(false);

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedItineraryId, setSelectedItineraryId] = useState<string>("");
  const [uploadedItems, setUploadedItems] = useState<UploadedMediaItem[]>([]);

  // Calculate tag suggestions based on active token after comma
  const tagTokens = tagsInput.split(',');
  const currentTagToken = tagTokens[tagTokens.length - 1]?.trim() || '';
  const rawTagKeyword = currentTagToken.replace(/^#/, '');
  const normalizedTagKeyword = normalizeKeyword(rawTagKeyword);
  const existingTagsNormalized = new Set(
    tagTokens.slice(0, -1).map((t) => normalizeKeyword(t.trim().replace(/^#/, '')))
  );
  const suggestedTags = normalizedTagKeyword.length > 0
    ? POPULAR_COMMUNITY_TAGS.filter((tag) => {
        const tagNorm = normalizeKeyword(tag.replace(/^#/, ''));
        return !existingTagsNormalized.has(tagNorm) && tagNorm.includes(normalizedTagKeyword);
      }).slice(0, 6)
    : [];

  const handleSelectTag = (tag: string) => {
    const parts = tagsInput.split(',');
    parts[parts.length - 1] = (parts.length > 1 ? ' ' : '') + tag;
    const newText = parts.map((p) => p.trim()).filter(Boolean).join(', ') + ', ';
    setTagsInput(newText);
    setIsTagDropdownOpen(false);
    tagInputRef.current?.focus();
  };

  const uploadMediaMutation = useUploadCommunityMedia();
  const createPostMutation = useCreateCommunityPost();

  const { data: myItineraries = [], isLoading: isLoadingItineraries } =
    useItinerariesListQuery();

  const handleClose = () => {
    setTitle("");
    setCaption("");
    setTagsInput("");
    setIsTagDropdownOpen(false);
    setSelectedItineraryId("");
    setUploadedItems([]);
    hasProcessedInitialFilesRef.current = false;
    onClose();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(event.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(event.target as Node)
      ) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // WCAG 2.2 AA & frontend.md §4: Handle Escape key & lock background scroll when modal is open
  useEffect(() => {
    if (!open) {
      hasProcessedInitialFilesRef.current = false;
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Auto-upload initialFiles if triggered directly from quick-action buttons
  useEffect(() => {
    if (!open) {
      hasProcessedInitialFilesRef.current = false;
      return;
    }

    if (
      initialFiles &&
      initialFiles.length > 0 &&
      !hasProcessedInitialFilesRef.current
    ) {
      hasProcessedInitialFilesRef.current = true;
      const remainingSlots =
        COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES - uploadedItems.length;
      const filesToUpload = initialFiles.slice(0, remainingSlots);

      if (filesToUpload.length > 0) {
        uploadMediaMutation
          .mutateAsync(filesToUpload)
          .then((res) => {
            setUploadedItems((prev) =>
              [...prev, ...(res.items || [])].slice(
                0,
                COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES
              )
            );
          })
          .catch((err) => {
            console.error("Lỗi khi tải tệp khởi tạo:", err);
          });
      }
    }
  }, [open, initialFiles, uploadedItems.length, uploadMediaMutation]);

  // Auto-focus and scroll to itinerary selector if triggered via 'Đính kèm lịch trình'
  useEffect(() => {
    if (!open || !focusItinerary) return;

    const timer = setTimeout(() => {
      if (itinerarySelectRef.current) {
        itinerarySelectRef.current.focus();
        itinerarySelectRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [open, focusItinerary]);

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
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-card text-foreground shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative flex items-center justify-center px-6 py-5 border-b border-border">
          <h2
            id="create-post-modal-title"
            className="text-2xl font-bold text-foreground tracking-tight text-center"
          >
            Tạo bài viết
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Đóng hộp thoại tạo bài viết"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-7 space-y-5 overflow-y-auto flex-1"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="post-title-input"
              className="block text-sm font-semibold text-foreground"
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
              className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="post-caption-input"
              className="block text-sm font-semibold text-foreground"
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
              className="w-full p-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed transition-shadow resize-y"
            />
          </div>

          {/* Local Media Upload Zone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-foreground">
                Ảnh / Video ngắn từ thiết bị ({uploadedItems.length}/
                {COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES})
              </label>
              <span className="text-xs text-muted-foreground">
                Hỗ trợ JPG, PNG, WebP, MP4, MOV (tối đa 50MB/tệp)
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
              aria-label="Chọn ảnh hoặc video từ thiết bị"
              className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 min-h-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {uploadMediaMutation.isPending ? (
                <>
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Đang tải tệp lên máy chủ...
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-3 text-primary">
                  <Upload className="size-5" />
                  <ImageIcon className="size-5" />
                  <Film className="size-5" />
                </div>
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
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
              >
                <CalendarDays className="size-4 text-primary" />
                <span>Đính kèm lịch trình của bạn (Tùy chọn)</span>
              </label>
              <select
                ref={itinerarySelectRef}
                id="post-itinerary-select"
                value={selectedItineraryId}
                onChange={(e) => setSelectedItineraryId(e.target.value)}
                disabled={isLoadingItineraries}
                className={cn(
                  "w-full h-12 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all",
                  focusItinerary && "ring-2 ring-primary border-primary shadow-xs"
                )}
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
                className="block text-sm font-semibold text-foreground"
              >
                Thẻ chủ đề (Hashtags)
              </label>
              <div className="relative">
                <input
                  ref={tagInputRef}
                  id="post-tags-input"
                  type="text"
                  value={tagsInput}
                  onFocus={() => {
                    if (suggestedTags.length > 0) setIsTagDropdownOpen(true);
                  }}
                  onChange={(e) => {
                    setTagsInput(e.target.value);
                    setIsTagDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsTagDropdownOpen(false);
                    }
                  }}
                  placeholder="#DaLat, #SanMay, #AmThuc"
                  autoComplete="off"
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {isTagDropdownOpen && suggestedTags.length > 0 && (
                  <div
                    ref={tagDropdownRef}
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-card shadow-lg p-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div className="px-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Gợi ý thẻ chủ đề phổ biến
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {suggestedTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleSelectTag(tag)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted/80 hover:bg-primary hover:text-primary-foreground text-foreground transition-all cursor-pointer"
                        >
                          <Hash className="size-3 text-primary group-hover:text-primary-foreground" />
                          <span>{tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-11 px-5 rounded-xl text-sm font-medium cursor-pointer"
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
              className="h-11 px-6 rounded-xl text-sm font-semibold gap-2 cursor-pointer shadow-xs"
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

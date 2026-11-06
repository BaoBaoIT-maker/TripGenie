"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  CalendarDays,
  Loader2,
  Film,
  Lock,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateCommunityPost } from "@/features/community/hooks/use-community";
import {
  COMMUNITY_UI_CONSTANTS,
  isVideoUrl,
} from "@/services/community.service";
import type { CommunityPostItem } from "@/types/community";

interface EditPostModalProps {
  open: boolean;
  onClose: () => void;
  post: CommunityPostItem;
}

export function EditPostModal({ open, onClose, post }: EditPostModalProps) {
  const [title, setTitle] = useState(post.title);
  const [caption, setCaption] = useState(post.caption || "");
  const [tagsInput, setTagsInput] = useState(
    (post.tags || []).join(" ")
  );

  const updatePostMutation = useUpdateCommunityPost();

  const handleClose = useCallback(() => {
    if (!updatePostMutation.isPending) {
      onClose();
    }
  }, [updatePostMutation.isPending, onClose]);

  // Escape key & background scroll lock
  useEffect(() => {
    if (!open) return;

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
  }, [open, handleClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const parsedTags = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    await updatePostMutation.mutateAsync({
      postId: post.id,
      payload: {
        title: trimmedTitle,
        caption: caption.trim() || undefined,
        tags: parsedTags,
      },
    });

    handleClose();
  };

  const handleAddTagSuggestion = (tag: string) => {
    const existing = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!existing.includes(tag)) {
      setTagsInput((prev) => (prev ? `${prev.trim()} ${tag}` : tag));
    }
  };

  const mediaList =
    post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : post.itinerary?.coverPhoto
      ? [post.itinerary.coverPhoto]
      : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-post-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !updatePostMutation.isPending) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" />
            <h2
              id="edit-post-modal-title"
              className="text-base sm:text-lg font-bold font-heading text-foreground"
            >
              Chỉnh sửa bài chia sẻ
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={updatePostMutation.isPending}
            aria-label="Đóng cửa sổ chỉnh sửa bài viết"
            className="min-h-[44px] min-w-[44px] -mr-2 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Post Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <label htmlFor="edit-post-title">
                Tiêu đề bài viết <span className="text-destructive">*</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                {title.length}/{COMMUNITY_UI_CONSTANTS.MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              id="edit-post-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Review 3N2Đ Đà Lạt săn mây đồi chè Cầu Đất..."
              maxLength={COMMUNITY_UI_CONSTANTS.MAX_TITLE_LENGTH}
              className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Post Caption */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <label htmlFor="edit-post-caption">Nội dung chi tiết</label>
              <span className="text-[11px] text-muted-foreground">
                {caption.length}/{COMMUNITY_UI_CONSTANTS.MAX_CAPTION_LENGTH}
              </span>
            </div>
            <textarea
              id="edit-post-caption"
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Chia sẻ thêm lưu ý về ăn uống, trang phục, mẹo di chuyển..."
              maxLength={COMMUNITY_UI_CONSTANTS.MAX_CAPTION_LENGTH}
              className="w-full p-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none leading-relaxed"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-post-tags"
              className="text-xs font-semibold text-foreground block"
            >
              Hashtags (cách nhau bằng khoảng trắng)
            </label>
            <input
              id="edit-post-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="#DaLat #SanMay #CheckIn..."
              className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {/* Quick add popular tag suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMUNITY_UI_CONSTANTS.POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTagSuggestion(tag)}
                  className="px-2.5 py-0.5 rounded-full bg-muted hover:bg-secondary hover:text-secondary-foreground text-xs font-medium text-muted-foreground transition-colors cursor-pointer"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Protected Assets Banner (Media & Itinerary are locked by design) */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Lock className="size-3.5 text-primary shrink-0" />
              <span>Tệp đính kèm được bảo vệ (Không thể thay đổi)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Theo quy chuẩn minh bạch cộng đồng, ảnh/video và lịch trình đính kèm được giữ nguyên để bảo đảm tính toàn vẹn cho các thành viên đã thảo luận và nhân bản.
            </p>

            {/* Read-only Media Previews */}
            {mediaList.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {mediaList.map((url, idx) => (
                  <div
                    key={url}
                    className="relative size-14 rounded-lg overflow-hidden border border-border bg-muted shrink-0"
                  >
                    {isVideoUrl(url) ? (
                      <div className="w-full h-full flex items-center justify-center bg-black/80 text-white">
                        <Film className="size-5" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`Ảnh đính kèm ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
                <span className="text-[11px] text-muted-foreground font-medium pl-1">
                  ({mediaList.length} tệp)
                </span>
              </div>
            )}

            {/* Read-only Attached Itinerary */}
            {post.itinerary && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border/70 text-xs">
                <CalendarDays className="size-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate">
                  {post.itinerary.title}
                </span>
                <span className="text-muted-foreground ml-auto shrink-0">
                  {post.itinerary.totalPlaces} địa điểm
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={updatePostMutation.isPending}
              className="min-h-[44px] px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || updatePostMutation.isPending}
              className="min-h-[44px] px-5 rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
            >
              {updatePostMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>Lưu thay đổi</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

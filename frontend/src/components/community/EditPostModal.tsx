"use client";

import { useState, useCallback } from "react";
import {
  X,
  CalendarDays,
  Loader2,
  Film,
  Lock,
  Pencil,
  Users,
} from "lucide-react";
import {
  useCommunityGroups,
  useUpdateCommunityPost,
} from "@/features/community/hooks/use-community";
import {
  COMMUNITY_UI_CONSTANTS,
  isVideoUrl,
} from "@/services/community.service";
import { CommunityModalPortal } from "./CommunityModalPortal";
import type {
  CommunityGroupSummary,
  CommunityPostItem,
} from "@/types/community";

interface EditPostModalProps {
  open: boolean;
  onClose: () => void;
  post: CommunityPostItem;
  groups?: CommunityGroupSummary[];
}

export function EditPostModal({
  open,
  onClose,
  post,
  groups: providedGroups,
}: EditPostModalProps) {
  const [title, setTitle] = useState(post.title);
  const [caption, setCaption] = useState(post.caption || "");
  const [tagsInput, setTagsInput] = useState((post.tags || []).join(" "));
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    post.group?.slug || post.groupId || COMMUNITY_UI_CONSTANTS.DEFAULT_GROUP_SLUG
  );

  const updatePostMutation = useUpdateCommunityPost();
  const hasProvidedGroups = Boolean(
    providedGroups && providedGroups.length > 0
  );
  const { data: fetchedGroups = [] } = useCommunityGroups({
    enabled: open && !hasProvidedGroups,
  });
  const communityGroups = hasProvidedGroups ? providedGroups! : fetchedGroups;

  const handleClose = useCallback(() => {
    if (!updatePostMutation.isPending) {
      onClose();
    }
  }, [updatePostMutation.isPending, onClose]);

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
        groupId: selectedGroupId || undefined,
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
    <CommunityModalPortal
      open={open}
      onClose={handleClose}
      ariaLabelledBy="edit-post-modal-title"
      maxWidthClass="max-w-[560px]"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-[10px] bg-[#0194F3] text-white flex items-center justify-center shadow-[0_2px_6px_rgba(1,148,243,0.25)]">
            <Pencil className="size-4" />
          </div>
          <div>
            <h2
              id="edit-post-modal-title"
              className="text-[15px] font-black text-[#0F172A]"
            >
              Chỉnh sửa bài chia sẻ
            </h2>
            <p className="text-[11px] text-[#64748B]">
              Cập nhật tiêu đề, nội dung chia sẻ hoặc thẻ chủ đề bài viết
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={updatePostMutation.isPending}
          aria-label="Đóng cửa sổ chỉnh sửa bài viết"
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Form Body */}
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4 overflow-y-auto flex-1 custom-scroll"
      >
        {/* Community Group Selection */}
        <div className="space-y-1.5">
          <label
            htmlFor="edit-post-group"
            className="flex items-center gap-1.5 text-xs font-extrabold text-[#0F172A]"
          >
            <Users className="size-3.5 text-[#0194F3]" />
            <span>Nhóm cộng đồng</span>
          </label>
          <select
            id="edit-post-group"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          >
            {communityGroups.length > 0 ? (
              communityGroups.map((grp) => (
                <option key={grp.id} value={grp.slug}>
                  {grp.name} {grp.isDefault ? "(Mặc định)" : ""}
                </option>
              ))
            ) : (
              <option value={COMMUNITY_UI_CONSTANTS.DEFAULT_GROUP_SLUG}>
                Cộng đồng chung TripGenie
              </option>
            )}
          </select>
        </div>

        {/* Post Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-extrabold text-[#0F172A]">
            <label htmlFor="edit-post-title">
              Tiêu đề bài viết <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] font-medium text-[#94A3B8]">
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
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        {/* Post Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-extrabold text-[#0F172A]">
            <label htmlFor="edit-post-caption">Nội dung chi tiết</label>
            <span className="text-[11px] font-medium text-[#94A3B8]">
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
            className="w-full p-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0194F3] focus:bg-white resize-none leading-relaxed transition-colors"
          />
        </div>

        {/* Hashtags */}
        <div className="space-y-1.5">
          <label
            htmlFor="edit-post-tags"
            className="text-xs font-extrabold text-[#0F172A] block"
          >
            Hashtags (cách nhau bằng khoảng trắng)
          </label>
          <input
            id="edit-post-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="#DaLat #SanMay #CheckIn..."
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
          {/* Quick add popular tag suggestions */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {COMMUNITY_UI_CONSTANTS.POPULAR_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddTagSuggestion(tag)}
                className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] hover:bg-[#0194F3] hover:text-white text-[11px] font-semibold text-[#475569] transition-colors cursor-pointer"
              >
                +{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Protected Assets Banner (Media & Itinerary are locked by design) */}
        <div className="rounded-[14px] border border-[#BAE0FD] bg-[#F0F7FF]/60 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-[#0F172A]">
            <Lock className="size-3.5 text-[#0194F3] shrink-0" />
            <span>Tệp đính kèm được bảo vệ (Không thể thay đổi)</span>
          </div>
          <p className="text-[11px] text-[#475569] leading-relaxed">
            Theo quy chuẩn minh bạch cộng đồng, ảnh/video và lịch trình đính kèm
            được giữ nguyên để bảo đảm tính toàn vẹn cho các thành viên đã thảo
            luận và nhân bản.
          </p>

          {/* Read-only Media Previews */}
          {mediaList.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {mediaList.map((url, idx) => (
                <div
                  key={url}
                  className="relative size-14 rounded-lg overflow-hidden border border-[#E2E8F0] bg-white shrink-0"
                >
                  {isVideoUrl(url) ? (
                    <div className="w-full h-full flex items-center justify-center bg-[#0F172A] text-white">
                      <Film className="size-5" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`Ảnh đính kèm ${idx + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
              <span className="text-[11px] text-[#64748B] font-semibold pl-1">
                ({mediaList.length} tệp)
              </span>
            </div>
          )}

          {/* Read-only Attached Itinerary */}
          {post.itinerary && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs">
              <CalendarDays className="size-3.5 text-[#0194F3] shrink-0" />
              <span className="font-bold text-[#0F172A] truncate">
                {post.itinerary.title}
              </span>
              <span className="text-[#64748B] font-medium ml-auto shrink-0">
                {post.itinerary.totalPlaces} địa điểm
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F1F5F9] shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={updatePostMutation.isPending}
            className="h-9 px-4 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#334155] transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!title.trim() || updatePostMutation.isPending}
            className="h-9 px-5 rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-[0_2px_6px_rgba(1,148,243,0.25)] transition-colors cursor-pointer disabled:opacity-50"
          >
            {updatePostMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>Lưu thay đổi</span>
            )}
          </button>
        </div>
      </form>
    </CommunityModalPortal>
  );
}

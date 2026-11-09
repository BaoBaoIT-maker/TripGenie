"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Upload,
  CalendarDays,
  Loader2,
  Film,
  Image as ImageIcon,
  Trash2,
  Hash,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useCommunityGroups,
  useCreateCommunityPost,
} from "@/features/community/hooks/use-community";
import { useItinerariesListQuery } from "@/features/planner/hooks/use-itinerary-planner";
import { communityService, COMMUNITY_UI_CONSTANTS } from "@/services/community.service";
import {
  POPULAR_COMMUNITY_TAGS,
  normalizeKeyword,
} from "@/features/community/config/community-suggestions";
import { CommunityModalPortal } from "./CommunityModalPortal";
import type {
  CommunityGroupSummary,
  UploadedMediaItem,
} from "@/types/community";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  initialFiles?: File[];
  focusItinerary?: boolean;
  defaultGroupId?: string;
  groups?: CommunityGroupSummary[];
}

export function CreatePostModal({
  open,
  onClose,
  initialFiles,
  focusItinerary,
  defaultGroupId,
  groups: providedGroups,
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
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    defaultGroupId || COMMUNITY_UI_CONSTANTS.DEFAULT_GROUP_SLUG
  );
  const [uploadedItems, setUploadedItems] = useState<UploadedMediaItem[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedGroupId(
        defaultGroupId || COMMUNITY_UI_CONSTANTS.DEFAULT_GROUP_SLUG
      );
    }
  }, [open, defaultGroupId]);

  // Memoize tag suggestions so typing in title/caption never triggers regex normalization
  const suggestedTags = useMemo(() => {
    const tagTokens = tagsInput.split(",");
    const currentTagToken = tagTokens[tagTokens.length - 1]?.trim() || "";
    const rawTagKeyword = currentTagToken.replace(/^#/, "");
    const normalizedTagKeyword = normalizeKeyword(rawTagKeyword);
    if (normalizedTagKeyword.length === 0) return [];

    const existingTagsNormalized = new Set(
      tagTokens
        .slice(0, -1)
        .map((t) => normalizeKeyword(t.trim().replace(/^#/, "")))
    );

    return POPULAR_COMMUNITY_TAGS.filter((tag) => {
      const tagNorm = normalizeKeyword(tag.replace(/^#/, ""));
      return (
        !existingTagsNormalized.has(tagNorm) &&
        tagNorm.includes(normalizedTagKeyword)
      );
    }).slice(0, 6);
  }, [tagsInput]);

  const handleSelectTag = (tag: string) => {
    const parts = tagsInput.split(",");
    parts[parts.length - 1] = (parts.length > 1 ? " " : "") + tag;
    const newText =
      parts
        .map((p) => p.trim())
        .filter(Boolean)
        .join(", ") + ", ";
    setTagsInput(newText);
    setIsTagDropdownOpen(false);
    tagInputRef.current?.focus();
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const uploadAbortRef = useRef<AbortController | null>(null);

  const cancelUpload = useCallback((showToast = false) => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadingFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (showToast) {
      toast.info("Đã hủy tải tệp lên");
    }
  }, []);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadingFileName(
      files.length === 1 ? files[0].name : `${files.length} tệp`
    );

    try {
      const res = await communityService.uploadMedia(
        files,
        (percent) => setUploadProgress(percent),
        controller.signal
      );
      const rawRes = res as unknown as Record<string, unknown>;
      const newItems: UploadedMediaItem[] =
        (Array.isArray(res?.items) ? res.items : null) ||
        (Array.isArray((rawRes?.data as Record<string, unknown>)?.items)
          ? ((rawRes.data as Record<string, unknown>).items as UploadedMediaItem[])
          : null) ||
        [];

      setUploadedItems((prev) =>
        [...prev, ...newItems].slice(
          0,
          COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES
        )
      );
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        return;
      }
      toast.error((err as Error)?.message || "Tải lên ảnh/video thất bại");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName("");
      uploadAbortRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const createPostMutation = useCreateCommunityPost();

  const hasProvidedGroups = Boolean(
    providedGroups && providedGroups.length > 0
  );
  const { data: fetchedGroups = [] } = useCommunityGroups({
    enabled: open && !hasProvidedGroups,
  });
  const communityGroups = hasProvidedGroups ? providedGroups! : fetchedGroups;

  const { data: myItineraries = [], isLoading: isLoadingItineraries } =
    useItinerariesListQuery("OWNED", { enabled: open });

  const handleClose = useCallback(() => {
    if (createPostMutation.isPending) return;
    if (isUploading) {
      cancelUpload();
    }
    setTitle("");
    setCaption("");
    setTagsInput("");
    setIsTagDropdownOpen(false);
    setSelectedItineraryId("");
    setUploadedItems([]);
    hasProcessedInitialFilesRef.current = false;
    onClose();
  }, [createPostMutation.isPending, isUploading, cancelUpload, onClose]);

  useEffect(() => {
    if (!open || !isTagDropdownOpen) return;
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, isTagDropdownOpen]);

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
        uploadFiles(filesToUpload);
      }
    }
  }, [open, initialFiles, uploadedItems.length, uploadFiles]);

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
    }, 120);

    return () => clearTimeout(timer);
  }, [open, focusItinerary]);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const remainingSlots =
      COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES - uploadedItems.length;
    const files = Array.from(fileList).slice(0, remainingSlots);
    e.target.value = "";
    if (files.length === 0) return;

    uploadFiles(files);
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
      groupId: selectedGroupId || undefined,
    });

    setTitle("");
    setCaption("");
    setTagsInput("");
    setSelectedItineraryId("");
    setUploadedItems([]);
    onClose();
  };

  return (
    <CommunityModalPortal
      open={open}
      onClose={handleClose}
      disableClose={createPostMutation.isPending}
      ariaLabelledBy="create-post-modal-title"
      maxWidthClass="max-w-[600px]"
    >
      {/* Modal Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-[10px] bg-[#0194F3] text-white flex items-center justify-center text-sm shadow-[0_2px_6px_rgba(1,148,243,0.25)]">
            <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="create-post-modal-title"
              className="text-[15px] font-black text-[#0F172A] tracking-[-0.01em]"
            >
              Tạo bài chia sẻ mới
            </h2>
            <p className="text-[11px] text-[#64748B]">
              Chia sẻ ảnh, video và lộ trình thực tế cùng cộng đồng TripGenie
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={createPostMutation.isPending}
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Đóng hộp thoại tạo bài viết"
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
            htmlFor="post-group-select"
            className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#0F172A]"
          >
            <Users className="size-3.5 text-[#0194F3]" />
            <span>Nhóm cộng đồng đăng bài</span>
          </label>
          <select
            id="post-group-select"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] font-semibold text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          >
            {communityGroups.length > 0 ? (
              communityGroups.map((grp) => (
                <option key={grp.id} value={grp.slug}>
                  {grp.name} {grp.isDefault ? "(Mặc định - Tất cả)" : ""}
                </option>
              ))
            ) : (
              <option value={COMMUNITY_UI_CONSTANTS.DEFAULT_GROUP_SLUG}>
                Cộng đồng chung TripGenie (Mặc định)
              </option>
            )}
          </select>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="post-title-input"
              className="block text-[12px] font-extrabold text-[#0F172A]"
            >
              Tiêu đề bài viết <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-[#94A3B8]">
              {title.length}/{COMMUNITY_UI_CONSTANTS.MAX_TITLE_LENGTH}
            </span>
          </div>
          <input
            id="post-title-input"
            type="text"
            required
            maxLength={COMMUNITY_UI_CONSTANTS.MAX_TITLE_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Đà Lạt 3N2Đ săn mây Cầu Đất & lẩu gà lá é chiều mưa"
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="post-caption-input"
              className="block text-[12px] font-extrabold text-[#0F172A]"
            >
              Nội dung chia sẻ kinh nghiệm
            </label>
            <span className="text-[11px] text-[#94A3B8]">
              {caption.length}/{COMMUNITY_UI_CONSTANTS.MAX_CAPTION_LENGTH}
            </span>
          </div>
          <textarea
            id="post-caption-input"
            rows={4}
            maxLength={COMMUNITY_UI_CONSTANTS.MAX_CAPTION_LENGTH}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Chia sẻ cảm nhận thực tế, thời điểm đẹp nhất trong ngày, chi phí ăn uống hoặc lưu ý di chuyển..."
            className="w-full p-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0194F3] focus:bg-white leading-relaxed transition-colors resize-y"
          />
        </div>

        {/* Local Media Upload Zone */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[12px] font-extrabold text-[#0F172A]">
              Ảnh / Video ngắn từ thiết bị ({uploadedItems.length}/
              {COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES})
            </label>
            <span className="text-[11px] text-[#64748B]">
              JPG, PNG, WebP, MP4, MOV (tối đa 50MB/tệp)
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

          {/* Upload Button or Progress Bar */}
          {isUploading ? (
            <div className="w-full p-4 rounded-[16px] border border-[#BAE6FD] bg-[#F0F9FF] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Loader2 className="size-4 animate-spin text-[#0194F3] shrink-0" />
                  <span className="font-bold text-[#0F172A] truncate">
                    Đang tải {uploadingFileName || "tệp"} lên máy chủ...
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-extrabold text-[#0194F3] text-sm tabular-nums">
                    {uploadProgress}%
                  </span>
                  <button
                    type="button"
                    onClick={() => cancelUpload(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    title="Hủy tải lên"
                  >
                    <X className="size-3.5 stroke-[2.5]" />
                    <span>Hủy tải</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2 rounded-full bg-[#E0F2FE] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0194F3] to-[#0068B8] rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${Math.max(4, uploadProgress)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                <span>Bạn có thể nhấn Hủy bất cứ lúc nào</span>
                <span>
                  {uploadProgress === 100
                    ? "Đang hoàn tất xử lý..."
                    : `${uploadProgress}% hoàn tất`}
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={
                uploadedItems.length >= COMMUNITY_UI_CONSTANTS.MAX_MEDIA_FILES
              }
              onClick={() => fileInputRef.current?.click()}
              aria-label="Chọn ảnh hoặc video từ thiết bị"
              className="w-full py-3.5 px-4 rounded-[16px] border-2 border-dashed border-[#CBD5E1] hover:border-[#0194F3] bg-[#F8FAFC] hover:bg-[#F0F7FF]/50 transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 min-h-[54px]"
            >
              <div className="flex items-center gap-2 text-[#0194F3] text-[12px] font-bold">
                <Upload className="size-4" />
                <ImageIcon className="size-4" />
                <Film className="size-4" />
                <span>Nhấn để chọn ảnh hoặc video từ thiết bị</span>
              </div>
            </button>
          )}

          {/* Uploaded Media Previews */}
          {uploadedItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {uploadedItems.map((item) => (
                <div
                  key={item.url}
                  className="relative group rounded-[12px] overflow-hidden border border-[#E2E8F0] bg-[#F1F5F9] aspect-video"
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
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(item.url)}
                    className="absolute top-1.5 right-1.5 size-7 inline-flex items-center justify-center rounded-lg bg-black/70 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                    aria-label="Gỡ tệp đa phương tiện này"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/65 text-white text-[10px] font-bold">
                    {item.mediaType === "VIDEO" ? "Video" : "Ảnh"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attach Owned Itinerary & Hashtags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="post-itinerary-select"
              className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#0F172A]"
            >
              <CalendarDays className="size-3.5 text-[#0194F3]" />
              <span>Đính kèm lịch trình (Tùy chọn)</span>
            </label>
            <select
              ref={itinerarySelectRef}
              id="post-itinerary-select"
              value={selectedItineraryId}
              onChange={(e) => setSelectedItineraryId(e.target.value)}
              disabled={isLoadingItineraries}
              className={cn(
                "w-full h-10 px-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-[12px] font-semibold text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors",
                focusItinerary &&
                  "border-[#0194F3] bg-[#F0F7FF]/40 ring-2 ring-[#0194F3]/20"
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
              className="block text-[12px] font-extrabold text-[#0F172A]"
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
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setIsTagDropdownOpen(false);
                  }
                }}
                placeholder="#DaLat, #SanMay, #AmThuc"
                autoComplete="off"
                className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
              />
              {isTagDropdownOpen && suggestedTags.length > 0 && (
                <div
                  ref={tagDropdownRef}
                  className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-[12px] border border-[#E2E8F0] bg-white shadow-xl p-2 space-y-1.5"
                >
                  <div className="px-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                    Gợi ý thẻ chủ đề phổ biến
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scroll">
                    {suggestedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleSelectTag(tag)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F1F5F9] hover:bg-[#0194F3] hover:text-white text-[#1E293B] transition-colors cursor-pointer"
                      >
                        <Hash className="size-3" />
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
        <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#F1F5F9]">
          <button
            type="button"
            onClick={handleClose}
            disabled={createPostMutation.isPending}
            className="h-9 px-4 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[12px] font-bold text-[#334155] transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={
              !title.trim() ||
              createPostMutation.isPending ||
              isUploading
            }
            className="h-9 px-5 rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-[12px] font-extrabold inline-flex items-center gap-1.5 shadow-[0_2px_6px_rgba(1,148,243,0.25)] transition-colors cursor-pointer disabled:opacity-50"
          >
            {createPostMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            <span>Đăng lên Cộng đồng</span>
          </button>
        </div>
      </form>
    </CommunityModalPortal>
  );
}

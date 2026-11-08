"use client";

import { useState, useCallback } from "react";
import { X, Loader2, Upload } from "lucide-react";
import {
  useCreateCommunityGroup,
  useUploadCommunityMedia,
} from "@/features/community/hooks/use-community";
import { CommunityModalPortal } from "./CommunityModalPortal";

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ open, onClose }: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(10);

  const createGroupMutation = useCreateCommunityGroup();
  const uploadMediaMutation = useUploadCommunityMedia();

  const handleClose = useCallback(() => {
    if (!createGroupMutation.isPending && !uploadMediaMutation.isPending) {
      setName("");
      setSubtitle("");
      setCoverImageUrl("");
      setSortOrder(10);
      onClose();
    }
  }, [createGroupMutation.isPending, uploadMediaMutation.isPending, onClose]);

  if (!open) return null;

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadMediaMutation.mutateAsync([file]);
    if (res.mediaUrls?.[0]) {
      setCoverImageUrl(res.mediaUrls[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const trimmedCover = coverImageUrl.trim() || undefined;
    await createGroupMutation.mutateAsync({
      name: name.trim(),
      subtitle: subtitle.trim() || undefined,
      iconUrl: trimmedCover,
      coverUrl: trimmedCover,
      coverImageUrl: trimmedCover,
      sortOrder,
    });
    handleClose();
  };

  return (
    <CommunityModalPortal
      open={open}
      onClose={handleClose}
      ariaLabelledBy="create-group-modal-title"
      maxWidthClass="max-w-md"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-[10px] bg-[#0194F3] text-white flex items-center justify-center text-sm shadow-[0_2px_6px_rgba(1,148,243,0.25)]">
            <i className="fa-solid fa-layer-group" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="create-group-modal-title"
              className="text-sm font-black text-[#0F172A]"
            >
              Tạo Nhóm Cộng Đồng Mới
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Dành cho Quản trị viên (Admin) tạo chủ đề & điểm đến
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Đóng hộp thoại"
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="group-name-input"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            Tên nhóm chủ đề <span className="text-rose-500">*</span>
          </label>
          <input
            id="group-name-input"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Săn Mây & Núi Rừng"
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="group-subtitle-input"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            Điểm đến tiêu biểu / Mô tả ngắn
          </label>
          <input
            id="group-subtitle-input"
            type="text"
            maxLength={255}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="VD: Đà Lạt, Tà Xùa, Hà Giang"
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="group-cover-input"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            Ảnh đại diện nhóm (URL hoặc Tải lên)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="group-cover-input"
              type="text"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="flex-1 h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
            />
            <label className="h-10 px-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-slate-100 text-xs font-bold text-[#334155] inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors">
              {uploadMediaMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin text-[#0194F3]" />
              ) : (
                <Upload className="size-3.5 text-[#0194F3]" />
              )}
              <span>Tải ảnh</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUploadCover}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={createGroupMutation.isPending}
            className="h-9 px-4 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#334155] transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!name.trim() || createGroupMutation.isPending}
            className="h-9 px-4 rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            {createGroupMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            <span>Tạo nhóm</span>
          </button>
        </div>
      </form>
    </CommunityModalPortal>
  );
}

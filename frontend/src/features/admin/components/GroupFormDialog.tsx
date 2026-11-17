"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Upload } from "lucide-react";
import { AppModalPortal } from "@/components/common/AppModalPortal";
import { useUploadCommunityMedia } from "@/features/community/hooks/use-community";
import type { AdminCommunityGroupItem } from "@/types/admin";
import { ADMIN_UI_CONSTANTS } from "../admin.constants";
import {
  useCreateAdminCommunityGroup,
  useUpdateAdminCommunityGroup,
} from "../hooks/use-admin";

interface GroupFormDialogProps {
  open: boolean;
  group: AdminCommunityGroupItem | null;
  onClose: () => void;
}

export function GroupFormDialog({
  open,
  group,
  onClose,
}: GroupFormDialogProps) {
  const isEditing = Boolean(group);

  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const createMutation = useCreateAdminCommunityGroup();
  const updateMutation = useUpdateAdminCommunityGroup();
  const uploadMediaMutation = useUploadCommunityMedia();

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadMediaMutation.isPending;

  useEffect(() => {
    if (!open) return;
    if (group) {
      setName(group.name);
      setSubtitle(group.subtitle || "");
      setCoverUrl(group.coverUrl || group.iconUrl || "");
    } else {
      setName("");
      setSubtitle("");
      setCoverUrl("");
    }
  }, [open, group]);

  const handleClose = useCallback(() => {
    if (!isPending) {
      onClose();
    }
  }, [isPending, onClose]);

  if (!open) return null;

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadMediaMutation.mutateAsync([file]);
    if (res.mediaUrls?.[0]) {
      setCoverUrl(res.mediaUrls[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const trimmedCover = coverUrl.trim() || undefined;
    const payload = {
      name: trimmedName,
      subtitle: subtitle.trim() || undefined,
      iconUrl: trimmedCover,
      coverUrl: trimmedCover,
    };

    if (group) {
      await updateMutation.mutateAsync({
        groupId: group.id,
        payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }

    handleClose();
  };

  const previewSrc = coverUrl.trim() || ADMIN_UI_CONSTANTS.FALLBACK_GROUP_IMAGE;

  return (
    <AppModalPortal
      open={open}
      onClose={handleClose}
      ariaLabelledBy="admin-group-modal-title"
      maxWidthClass="max-w-md"
    >
      {/* Community-style Popup Header (Identical to CreateGroupModal.tsx) */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-[10px] bg-[#0194F3] text-white flex items-center justify-center text-sm shadow-[0_2px_6px_rgba(1,148,243,0.25)]">
            <i className="fa-solid fa-layer-group" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="admin-group-modal-title"
              className="text-sm font-bold text-slate-900"
            >
              {isEditing
                ? "Chỉnh sửa Chủ đề Cộng đồng"
                : "Tạo Chủ đề Cộng đồng Mới"}
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Định danh tự động chuẩn hóa bên dưới hệ thống
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isPending}
          aria-label="Đóng hộp thoại"
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
        {/* Image Upload + Live Preview */}
        <div className="flex items-center gap-3.5 p-3 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt="Ảnh đại diện chủ đề"
            className="size-14 rounded-[12px] object-cover border border-[#E2E8F0] shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="font-extrabold text-[#0F172A]">
              Hình ảnh đại diện chủ đề
            </div>
            <div className="flex items-center gap-2">
              <label className="h-9 px-3 rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors">
                {uploadMediaMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                <span>Tải ảnh lên</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleUploadImage}
                  className="hidden"
                />
              </label>
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="Hoặc dán URL ảnh..."
                className="flex-1 min-w-0 h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#0194F3]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="admin-group-name-input"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            Tên chủ đề cộng đồng <span className="text-rose-500">*</span>
          </label>
          <input
            id="admin-group-name-input"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Săn Mây & Núi Rừng"
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="admin-group-subtitle-input"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            Điểm đến tiêu biểu / Mô tả ngắn
          </label>
          <input
            id="admin-group-subtitle-input"
            type="text"
            maxLength={255}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="VD: Đà Lạt, Tà Xùa, Hà Giang"
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="h-9 px-4 rounded-[10px] border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#334155] transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isPending}
            className="h-9 px-4 rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isEditing ? "Lưu thay đổi" : "Tạo chủ đề"}</span>
          </button>
        </div>
      </form>
    </AppModalPortal>
  );
}

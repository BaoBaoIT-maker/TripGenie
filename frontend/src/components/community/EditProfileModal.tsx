"use client";

import { useState, useRef, useEffect } from "react";
import { X, Loader2, Camera, UploadCloud } from "lucide-react";
import { CommunityModalPortal } from "./CommunityModalPortal";
import {
  useUpdateProfileMutation,
  useUploadCommunityMedia,
} from "@/features/community/hooks/use-community";
import { toast } from "sonner";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { deriveHandleFromFullName } from "@/services/community.service";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  initialData: {
    fullName: string;
    username?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
  };
  onProfileUpdated?: (updated: {
    fullName: string;
    bio?: string;
    avatarUrl?: string;
  }) => void;
}

export function EditProfileModal({
  open,
  onClose,
  initialData,
  onProfileUpdated,
}: EditProfileModalProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialData.fullName || "");
  const [bio, setBio] = useState(initialData.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl || "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateProfileMutation = useUpdateProfileMutation();
  const uploadMediaMutation = useUploadCommunityMedia();

  useEffect(() => {
    if (open) {
      setFullName(initialData.fullName || "");
      setBio(initialData.bio || "");
      setAvatarUrl(initialData.avatarUrl || "");
    }
  }, [open, initialData]);

  if (!open) return null;

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh đại diện không được vượt quá 5MB");
      return;
    }

    try {
      const res = await uploadMediaMutation.mutateAsync([file]);
      if (res.items && res.items.length > 0) {
        setAvatarUrl(res.items[0].url);
        toast.success("Đã tải ảnh đại diện lên thành công!");
      }
    } catch {
      // Error handled by hook
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      toast.error("Họ và tên phải có ít nhất 2 ký tự");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        fullName: trimmedName,
        bio: bio.trim(),
        avatarUrl: avatarUrl || undefined,
      });

      onProfileUpdated?.({
        fullName: trimmedName,
        bio: bio.trim(),
        avatarUrl: avatarUrl || undefined,
      });

      router.refresh();
      onClose();
    } catch {
      // Error handled by mutation toast
    }
  };

  const isPending =
    updateProfileMutation.isPending || uploadMediaMutation.isPending;

  return (
    <CommunityModalPortal
      open={open}
      onClose={() => {
        if (!isPending) onClose();
      }}
      ariaLabelledBy="edit-profile-modal-title"
      maxWidthClass="max-w-[500px]"
    >
      {/* Modal Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-[10px] bg-[#0194F3]/10 text-[#0194F3] flex items-center justify-center text-sm">
            <i className="fa-regular fa-pen-to-square" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="edit-profile-modal-title"
              className="text-[15px] font-bold text-[#0F172A] tracking-[-0.01em]"
            >
              Chỉnh sửa thông tin hồ sơ
            </h2>
            <p className="text-[11.5px] text-[#64748B]">
              Cập nhật diện mạo Thổ địa hiển thị trên cộng đồng
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="size-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Đóng hộp thoại"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Modal Body Form */}
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Avatar Uploader Section */}
        <div className="flex items-center gap-4 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[14px]">
          <div className="relative size-16 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm bg-[#E2E8F0]">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Ảnh đại diện"
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="size-full flex items-center justify-center text-[#64748B] font-bold text-lg bg-[#E2E8F0]">
                {fullName.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            {uploadMediaMutation.isPending && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#0F172A]">
              Ảnh đại diện
            </div>
            <div className="text-[11.5px] text-[#64748B] mb-2">
              Khuyến nghị hình vuông JPG, PNG tối đa 5MB
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={isPending}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[12px] font-semibold text-[#334155] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <UploadCloud className="size-3.5 text-[#0194F3]" />
              <span>Chọn ảnh mới</span>
            </button>
          </div>
        </div>

        {/* Full Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="edit-fullname-input"
            className="block text-[12px] font-semibold text-[#0F172A]"
          >
            Họ và tên <span className="text-rose-500">*</span>
          </label>
          <input
            id="edit-fullname-input"
            type="text"
            required
            maxLength={50}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nhập họ và tên hiển thị..."
            className="w-full h-10 px-3.5 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        {/* Username (Readonly) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="edit-username-input"
              className="block text-[12px] font-semibold text-[#0F172A]"
            >
              Tên người dùng (Username)
            </label>
            <span className="text-[11px] text-[#94A3B8]">
              Đổi tại Cài đặt tài khoản ⚙️
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-[13px] font-semibold text-[#94A3B8]">
              @
            </span>
            <input
              id="edit-username-input"
              type="text"
              disabled
              value={
                initialData.username ||
                deriveHandleFromFullName(initialData.fullName || fullName).replace(/^@/, "")
              }
              className="w-full h-10 pl-8 pr-3.5 rounded-[10px] border border-[#E2E8F0] bg-[#F1F5F9] text-[13px] font-semibold text-[#64748B] cursor-not-allowed select-none"
            />
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="edit-bio-input"
              className="block text-[12px] font-semibold text-[#0F172A]"
            >
              Tiểu sử Thổ địa
            </label>
            <span className="text-[11px] text-[#94A3B8] font-medium">
              {bio.length} / 300
            </span>
          </div>
          <textarea
            id="edit-bio-input"
            rows={3}
            maxLength={300}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Mô tả phong cách du lịch, sở thích hoặc cung đường yêu thích của bạn..."
            className="w-full p-3 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] text-[13px] text-[#0F172A] leading-relaxed focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors resize-y"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end items-center gap-2.5 pt-3 border-t border-[#F1F5F9]">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-9 px-4 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[13px] font-semibold text-[#475569] cursor-pointer disabled:opacity-50 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="h-9 px-5 rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-[13px] font-semibold inline-flex items-center gap-2 cursor-pointer shadow-[0_1px_3px_rgba(1,148,243,0.2)] disabled:opacity-50 transition-all"
          >
            {updateProfileMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </form>
    </CommunityModalPortal>
  );
}

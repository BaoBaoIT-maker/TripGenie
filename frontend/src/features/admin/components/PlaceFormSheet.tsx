"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Upload } from "lucide-react";
import { AppModalPortal } from "@/components/common/AppModalPortal";
import { useUploadCommunityMedia } from "@/features/community/hooks/use-community";
import type {
  BackendCategoryItem,
  BackendTravelAreaItem,
} from "@/services/place.service";
import type { AdminPlaceItem } from "@/types/admin";
import { ADMIN_UI_CONSTANTS } from "../admin.constants";
import {
  useCreateAdminPlace,
  useUpdateAdminPlace,
} from "../hooks/use-admin";

interface PlaceFormSheetProps {
  open: boolean;
  place: AdminPlaceItem | null;
  travelAreas: BackendTravelAreaItem[];
  categories: BackendCategoryItem[];
  onClose: () => void;
}

export function PlaceFormSheet({
  open,
  place,
  travelAreas,
  categories,
  onClose,
}: PlaceFormSheetProps) {
  const isEditing = Boolean(place);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [areaId, setAreaId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [latitude, setLatitude] = useState<string>("16.0544");
  const [longitude, setLongitude] = useState<string>("108.2022");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const createMutation = useCreateAdminPlace();
  const updateMutation = useUpdateAdminPlace();
  const uploadMediaMutation = useUploadCommunityMedia();

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadMediaMutation.isPending;

  useEffect(() => {
    if (!open) return;
    if (place) {
      setName(place.name);
      setAddress(place.address);
      setAreaId(place.areaId ? String(place.areaId) : "");
      setCategoryId(place.categoryId ? String(place.categoryId) : "");
      setLatitude(String(place.latitude));
      setLongitude(String(place.longitude));
      setDescription(place.description || "");
      setImageUrl(place.images?.[0]?.imageUrl || "");
    } else {
      const defaultArea = travelAreas[0];
      setName("");
      setAddress("");
      setAreaId(defaultArea ? String(defaultArea.id) : "");
      setCategoryId(categories[0] ? String(categories[0].id) : "");
      setLatitude(
        defaultArea?.latitude ? String(defaultArea.latitude) : "16.0544"
      );
      setLongitude(
        defaultArea?.longitude ? String(defaultArea.longitude) : "108.2022"
      );
      setDescription("");
      setImageUrl("");
    }
  }, [open, place, travelAreas, categories]);

  const handleClose = useCallback(() => {
    if (!isPending) {
      onClose();
    }
  }, [isPending, onClose]);

  if (!open) return null;

  const handleAreaChange = (nextAreaId: string) => {
    setAreaId(nextAreaId);
    if (!isEditing) {
      const selected = travelAreas.find((a) => String(a.id) === nextAreaId);
      if (selected?.latitude && selected?.longitude) {
        setLatitude(String(selected.latitude));
        setLongitude(String(selected.longitude));
      } else if (
        selected?.bbox.minLat !== null &&
        selected?.bbox.maxLat !== null &&
        selected?.bbox.minLng !== null &&
        selected?.bbox.maxLng !== null &&
        selected
      ) {
        const centerLat = (selected.bbox.minLat + selected.bbox.maxLat) / 2;
        const centerLng = (selected.bbox.minLng + selected.bbox.maxLng) / 2;
        setLatitude(centerLat.toFixed(4));
        setLongitude(centerLng.toFixed(4));
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadMediaMutation.mutateAsync([file]);
    if (res.mediaUrls?.[0]) {
      setImageUrl(res.mediaUrls[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (
      !trimmedName ||
      !trimmedAddress ||
      Number.isNaN(latNum) ||
      Number.isNaN(lngNum)
    ) {
      return;
    }

    const trimmedImg = imageUrl.trim();
    const payload = {
      name: trimmedName,
      address: trimmedAddress,
      areaId: areaId ? Number(areaId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      latitude: latNum,
      longitude: lngNum,
      description: description.trim() || undefined,
      ...(trimmedImg
        ? {
            images: [
              {
                imageUrl: trimmedImg,
                isPrimary: true,
                displayOrder: 0,
              },
            ],
          }
        : {}),
    };

    if (place) {
      await updateMutation.mutateAsync({
        placeId: place.id,
        payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }

    handleClose();
  };

  const previewSrc = imageUrl.trim() || ADMIN_UI_CONSTANTS.FALLBACK_PLACE_IMAGE;

  return (
    <AppModalPortal
      open={open}
      onClose={handleClose}
      ariaLabelledBy="place-form-modal-title"
      maxWidthClass="max-w-lg"
    >
      {/* Community-style Popup Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-[10px] bg-[#0194F3] text-white flex items-center justify-center text-sm shadow-[0_2px_6px_rgba(1,148,243,0.25)]">
            <i className="fa-solid fa-map-location-dot" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="place-form-modal-title"
              className="text-sm font-bold text-slate-900"
            >
              {isEditing
                ? "Chỉnh sửa Địa điểm Du lịch"
                : "Thêm Địa điểm Du lịch Mới"}
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Kiểm tra tọa độ chuẩn WGS84 & khung vùng TravelArea
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

      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4 overflow-y-auto text-xs"
      >
        {/* Image Upload & Preview */}
        <div className="flex items-center gap-3.5 p-3 rounded-[14px] bg-[#F8FAFC] border border-[#E2E8F0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt="Ảnh địa điểm"
            className="size-14 rounded-[12px] object-cover border border-[#E2E8F0] shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="font-extrabold text-[#0F172A]">
              Hình ảnh đại diện địa điểm
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
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Hoặc dán URL hình ảnh..."
                className="flex-1 min-w-0 h-9 px-3 rounded-[10px] border border-[#E2E8F0] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#0194F3]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="place-name-input"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            Tên địa điểm du lịch <span className="text-rose-500">*</span>
          </label>
          <input
            id="place-name-input"
            type="text"
            required
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Sun World Bà Nà Hills"
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="place-area-select"
              className="block text-xs font-extrabold text-[#0F172A]"
            >
              Khu vực du lịch
            </label>
            <select
              id="place-area-select"
              value={areaId}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white"
            >
              <option value="">Chọn khu vực</option>
              {travelAreas.map((area) => (
                <option key={area.id} value={String(area.id)}>
                  {area.nameVi || area.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="place-category-select"
              className="block text-xs font-extrabold text-[#0F172A]"
            >
              Danh mục
            </label>
            <select
              id="place-category-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white"
            >
              <option value="">Chọn danh mục</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.nameVi || cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="place-address-input"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            Địa chỉ chi tiết <span className="text-rose-500">*</span>
          </label>
          <input
            id="place-address-input"
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Số nhà, đường, phường/xã, tỉnh/thành..."
            className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="place-lat-input"
              className="block text-xs font-extrabold text-[#0F172A]"
            >
              Vĩ độ (Latitude) <span className="text-rose-500">*</span>
            </label>
            <input
              id="place-lat-input"
              type="number"
              step="0.0001"
              required
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="place-lng-input"
              className="block text-xs font-extrabold text-[#0F172A]"
            >
              Kinh độ (Longitude) <span className="text-rose-500">*</span>
            </label>
            <input
              id="place-lng-input"
              type="number"
              step="0.0001"
              required
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full h-10 px-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="place-desc-input"
            className="block text-xs font-extrabold text-[#0F172A]"
          >
            Mô tả ngắn
          </label>
          <textarea
            id="place-desc-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Giới thiệu đặc trưng điểm đến..."
            className="w-full p-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:outline-none focus:border-[#0194F3] focus:bg-white transition-colors"
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
            disabled={!name.trim() || !address.trim() || isPending}
            className="h-9 px-4 rounded-[10px] bg-[#0194F3] hover:bg-[#007FE3] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isEditing ? "Lưu thay đổi" : "Tạo địa điểm"}</span>
          </button>
        </div>
      </form>
    </AppModalPortal>
  );
}

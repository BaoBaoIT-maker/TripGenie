"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  placeService,
  type BackendCategoryItem,
  type BackendTravelAreaItem,
} from "@/services/place.service";
import { ADMIN_UI_CONSTANTS } from "@/features/admin/admin.constants";
import { AdminDebouncedSearch } from "@/features/admin/components/AdminDebouncedSearch";
import { PlaceFormSheet } from "@/features/admin/components/PlaceFormSheet";
import {
  useAdminDashboardStats,
  useAdminPlaces,
  useDeleteAdminPlace,
} from "@/features/admin/hooks/use-admin";
import type { AdminPlaceItem } from "@/types/admin";

export default function AdminPlacesPage() {
  const [search, setSearch] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const [travelAreas, setTravelAreas] = useState<BackendTravelAreaItem[]>([]);
  const [categories, setCategories] = useState<BackendCategoryItem[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<AdminPlaceItem | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      placeService.getTravelAreas().catch(() => []),
      placeService.getCategories().catch(() => []),
    ]).then(([areas, cats]) => {
      if (!active) return;
      setTravelAreas(areas);
      setCategories(cats);
    });
    return () => {
      active = false;
    };
  }, []);

  const { data: stats } = useAdminDashboardStats();
  const { data, isLoading } = useAdminPlaces({
    page,
    limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
    search: search || undefined,
    areaId: selectedAreaId !== "ALL" ? Number(selectedAreaId) : undefined,
    categoryId:
      selectedCategoryId !== "ALL" ? Number(selectedCategoryId) : undefined,
  });

  const deletePlaceMutation = useDeleteAdminPlace();

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const places = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const totalCount = data?.meta.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Places Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Tổng kho địa điểm
          </div>
          <div className="text-2xl font-extrabold text-[#10243A] mt-2">
            {(stats?.places.total ?? totalCount).toLocaleString("vi-VN")}
          </div>
        </div>
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Đang hiển thị (Active)
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">
            {(stats?.places.active ?? 0).toLocaleString("vi-VN")}
          </div>
        </div>
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Đã xóa mềm (Inactive)
          </div>
          <div className="text-2xl font-extrabold text-slate-500 mt-2">
            {(stats?.places.inactive ?? 0).toLocaleString("vi-VN")}
          </div>
        </div>
      </div>

      {/* Places Filter Toolbar (Explore-style) + Server-Side Paginated Table */}
      <div className="bg-white rounded-[24px] p-6 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <AdminDebouncedSearch
              placeholder="Tìm tên địa điểm, địa chỉ..."
              onSearchChange={handleSearchChange}
              className="w-64"
            />

            <select
              value={selectedAreaId}
              onChange={(e) => {
                setSelectedAreaId(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc theo khu vực du lịch"
              className="h-10 px-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0194F3]"
            >
              <option value="ALL">Tất cả khu vực</option>
              {travelAreas.map((area) => (
                <option key={area.id} value={String(area.id)}>
                  {area.nameVi || area.name}
                </option>
              ))}
            </select>

            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc theo danh mục địa điểm"
              className="h-10 px-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0194F3]"
            >
              <option value="ALL">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.nameVi || cat.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingPlace(null);
              setIsFormOpen(true);
            }}
            className="h-10 px-4 rounded-2xl bg-[#0194F3] hover:bg-[#0084DE] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-colors"
          >
            <i className="fa-solid fa-plus" aria-hidden="true" />
            <span>Thêm địa điểm</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pr-4">Địa điểm</th>
                <th className="py-3.5 px-4">Khu vực & Danh mục</th>
                <th className="py-3.5 px-4">Tọa độ (Lat, Lng)</th>
                <th className="py-3.5 px-4">Độ phổ biến</th>
                <th className="py-3.5 pl-4 text-right w-14" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {places.length > 0 ? (
                places.map((p) => {
                  const thumb =
                    p.images?.[0]?.thumbnailUrl ||
                    p.images?.[0]?.imageUrl ||
                    ADMIN_UI_CONSTANTS.FALLBACK_PLACE_IMAGE;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumb}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-10 rounded-xl object-cover shrink-0 border border-slate-200"
                          />
                          <div>
                            <div className="font-bold text-[#10243A] line-clamp-1">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">
                              {p.address}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-[#E8F4FD] text-[#0194F3] font-bold text-[11px]">
                          {p.area?.nameVi || p.area?.name || "Việt Nam"}
                        </span>
                        <span className="text-slate-600 font-semibold ml-1.5">
                          {p.category?.nameVi ||
                            p.category?.name ||
                            "Điểm đến"}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-600 whitespace-nowrap">
                        {p._count?.destinations ?? 0} lịch trình
                      </td>
                      <td className="py-4 pl-4 text-right whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Mở menu thao tác địa điểm"
                            className="size-8 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-[#10243A] inline-flex items-center justify-center cursor-pointer outline-none"
                          >
                            <i
                              className="fa-solid fa-ellipsis text-sm"
                              aria-hidden="true"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 rounded-2xl p-1.5 border border-slate-200 bg-white shadow-xl"
                          >
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingPlace(p);
                                setIsFormOpen(true);
                              }}
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
                            >
                              <i
                                className="fa-regular fa-pen-to-square w-4 text-slate-400"
                                aria-hidden="true"
                              />
                              <span>Chỉnh sửa địa điểm</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deletePlaceMutation.mutate(p.id)}
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 cursor-pointer flex items-center gap-2.5"
                            >
                              <i
                                className="fa-regular fa-trash-can w-4"
                                aria-hidden="true"
                              />
                              <span>Xóa mềm địa điểm</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-slate-400 font-semibold"
                  >
                    {isLoading
                      ? "Đang tải trang địa điểm..."
                      : "Không tìm thấy địa điểm phù hợp bộ lọc."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="font-medium">
            Trang <b className="text-[#10243A]">{page}</b> /{" "}
            <b className="text-[#10243A]">{totalPages}</b> • Hiển thị{" "}
            <b className="text-[#10243A]">{places.length}</b> mục trên trang
            này (Tổng{" "}
            <b className="text-[#10243A]">
              {totalCount.toLocaleString("vi-VN")}
            </b>{" "}
            địa điểm)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer disabled:opacity-40"
            >
              Trước
            </button>
            <span className="px-3 h-8 rounded-xl bg-[#0194F3] text-white font-bold text-xs inline-flex items-center justify-center">
              {page}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      <PlaceFormSheet
        open={isFormOpen}
        place={editingPlace}
        travelAreas={travelAreas}
        categories={categories}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPlace(null);
        }}
      />
    </div>
  );
}

"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ADMIN_ROUTES,
  ADMIN_TAB_QUERY_PARAMS,
  ADMIN_UI_CONSTANTS,
} from "@/features/admin/admin.constants";
import { AdminDebouncedSearch } from "@/features/admin/components/AdminDebouncedSearch";
import { AdminPlacePhotosSection } from "@/features/admin/components/AdminPlacePhotosSection";
import { PlaceFormSheet } from "@/features/admin/components/PlaceFormSheet";
import {
  useAdminDashboardStats,
  useAdminPlaceReferences,
  useAdminPlaces,
  useDeleteAdminPlace,
} from "@/features/admin/hooks/use-admin";
import type { AdminPlaceItem } from "@/types/admin";

type AdminPlacesSubTab = "PLACES" | "PHOTOS";

function AdminPlacesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get(ADMIN_TAB_QUERY_PARAMS.KEY);
  const activeTab: AdminPlacesSubTab =
    tabParam === ADMIN_TAB_QUERY_PARAMS.PLACES_PHOTOS ? "PHOTOS" : "PLACES";

  const setActiveTab = useCallback(
    (next: AdminPlacesSubTab) => {
      router.replace(
        next === "PHOTOS" ? ADMIN_ROUTES.PLACES_PHOTOS : ADMIN_ROUTES.PLACES,
        { scroll: false }
      );
    },
    [router]
  );

  const [search, setSearch] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<AdminPlaceItem | null>(null);

  const isPlacesTab = activeTab === "PLACES";

  const { data: stats } = useAdminDashboardStats();
  const { data: refs } = useAdminPlaceReferences(isPlacesTab);
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useAdminPlaces(
    {
      page,
      limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
      search: search || undefined,
      areaId: selectedAreaId !== "ALL" ? Number(selectedAreaId) : undefined,
      categoryId:
        selectedCategoryId !== "ALL" ? Number(selectedCategoryId) : undefined,
    },
    { enabled: isPlacesTab }
  );

  const deletePlaceMutation = useDeleteAdminPlace();

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const travelAreas = refs?.travelAreas ?? [];
  const categories = refs?.categories ?? [];
  const places = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const totalCount = data?.meta.total ?? 0;
  const pendingPhotosCount = stats?.places.pendingPhotos ?? 0;

  return (
    <div className="space-y-4">
      {/* Row 1: 4 Summary Cards including Pending Photo Contributions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab("PLACES")}
          className={`text-left bg-white rounded-2xl p-5 border shadow-2xs transition-colors cursor-pointer ${
            activeTab === "PLACES"
              ? "border-[#0194F3]/50"
              : "border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">
            Tổng kho địa điểm
          </div>
          <div className="text-2xl font-extrabold text-[#10243A] mt-2 tabular-nums">
            {(stats?.places.total ?? totalCount).toLocaleString("vi-VN")}
          </div>
        </button>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">
            Đang hiển thị (Active)
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2 tabular-nums">
            {(stats?.places.active ?? 0).toLocaleString("vi-VN")}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">
            Đã ẩn (Inactive)
          </div>
          <div className="text-2xl font-extrabold text-slate-600 mt-2 tabular-nums">
            {(stats?.places.inactive ?? 0).toLocaleString("vi-VN")}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab("PHOTOS")}
          className={`text-left bg-white rounded-2xl p-5 border shadow-2xs transition-colors cursor-pointer ${
            activeTab === "PHOTOS"
              ? "border-[#0194F3]/50"
              : pendingPhotosCount > 0
                ? "border-amber-200 hover:border-amber-300"
                : "border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">
            Ảnh đóng góp chờ duyệt
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2 tabular-nums">
            {pendingPhotosCount.toLocaleString("vi-VN")} ảnh
          </div>
        </button>
      </div>

      {/* Row 2: Main Card with 2 Sub-tabs */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div
            role="tablist"
            aria-label="Quản lý địa điểm và ảnh đóng góp"
            className="inline-flex p-1 rounded-xl bg-[#F5F9FF] border border-slate-200/70 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "PLACES"}
              onClick={() => setActiveTab("PLACES")}
              className={`px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                activeTab === "PLACES"
                  ? "font-bold bg-[#0194F3] text-white shadow-2xs"
                  : "font-semibold text-slate-600 hover:text-[#10243A]"
              }`}
            >
              Kho địa điểm
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "PHOTOS"}
              onClick={() => setActiveTab("PHOTOS")}
              className={`px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === "PHOTOS"
                  ? "font-bold bg-[#0194F3] text-white shadow-2xs"
                  : "font-semibold text-slate-600 hover:text-[#10243A]"
              }`}
            >
              <i className="fa-regular fa-images text-[11px]" aria-hidden="true" />
              <span>Ảnh đóng góp</span>
              {pendingPhotosCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                    activeTab === "PHOTOS"
                      ? "bg-white text-[#0194F3]"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {pendingPhotosCount}
                </span>
              )}
            </button>
          </div>

          {isPlacesTab && (
            <button
              type="button"
              onClick={() => {
                setEditingPlace(null);
                setIsFormOpen(true);
              }}
              className="h-9 px-4 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] text-white text-xs font-bold shadow-[0_2px_8px_rgba(1,148,243,0.28)] cursor-pointer flex items-center gap-2 transition-colors"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              <span>Thêm địa điểm</span>
            </button>
          )}
        </div>

        {activeTab === "PHOTOS" ? (
          <AdminPlacePhotosSection pendingCount={pendingPhotosCount} />
        ) : (
          <>
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
                className="h-10 px-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0194F3]"
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
                className="h-10 px-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0194F3]"
              >
                <option value="ALL">Tất cả danh mục</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.nameVi || cat.name}
                  </option>
                ))}
              </select>
            </div>

            {isError ? (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-center justify-between text-xs text-rose-800">
                <span className="font-semibold">
                  Không thể tải danh sách địa điểm. Vui lòng thử lại.
                </span>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 pr-4">Địa điểm</th>
                      <th className="py-3 px-4">Khu vực & Danh mục</th>
                      <th className="py-3 px-4">Tọa độ (Lat, Lng)</th>
                      <th className="py-3 px-4">Độ phổ biến</th>
                      <th className="py-3 pl-4 text-right w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {isLoading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <tr key={idx}>
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <Skeleton className="size-10 rounded-xl shrink-0" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-4 w-44" />
                                <Skeleton className="h-3 w-52" />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Skeleton className="h-5 w-36 rounded-lg" />
                          </td>
                          <td className="py-3.5 px-4">
                            <Skeleton className="h-4 w-28" />
                          </td>
                          <td className="py-3.5 px-4">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="py-3.5 pl-4" />
                        </tr>
                      ))
                    ) : places.length > 0 ? (
                      places.map((p) => {
                        const thumb =
                          p.images?.[0]?.thumbnailUrl ||
                          p.images?.[0]?.imageUrl ||
                          ADMIN_UI_CONSTANTS.FALLBACK_PLACE_IMAGE;
                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-[#F8FAFC] transition-colors"
                          >
                            <td className="py-3.5 pr-4">
                              <div className="flex items-center gap-3">
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
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-lg bg-[#E8F4FD] text-[#0194F3] font-bold text-[11px]">
                                {p.area?.nameVi || p.area?.name || "Việt Nam"}
                              </span>
                              <span className="text-slate-600 font-semibold ml-1.5">
                                {p.category?.nameVi ||
                                  p.category?.name ||
                                  "Điểm đến"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                              {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap tabular-nums">
                              {p._count?.destinations ?? 0} lịch trình
                            </td>
                            <td className="py-3.5 pl-4 text-right whitespace-nowrap">
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
                                  className="w-48 rounded-xl p-1.5 border border-slate-200 bg-white shadow-xl"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingPlace(p);
                                      setIsFormOpen(true);
                                    }}
                                    className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
                                  >
                                    <i
                                      className="fa-regular fa-pen-to-square w-4 text-slate-400"
                                      aria-hidden="true"
                                    />
                                    <span>Chỉnh sửa địa điểm</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      deletePlaceMutation.mutate(p.id)
                                    }
                                    className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 cursor-pointer flex items-center gap-2.5"
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
                          className="py-12 text-center text-slate-500 font-medium"
                        >
                          Không tìm thấy địa điểm phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Server-Side Pagination Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div className="font-medium">
                Trang <b className="text-[#10243A]">{page}</b> /{" "}
                <b className="text-[#10243A]">{totalPages}</b> • Hiển thị{" "}
                <b className="text-[#10243A]">{places.length}</b> mục (Tổng{" "}
                <b className="text-[#10243A] tabular-nums">
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
                <span className="px-3 h-8 rounded-xl bg-[#0194F3] text-white font-bold text-xs inline-flex items-center justify-center tabular-nums">
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
          </>
        )}
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

export default function AdminPlacesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <AdminPlacesPageContent />
    </Suspense>
  );
}

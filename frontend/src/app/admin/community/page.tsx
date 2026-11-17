"use client";

import { useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_UI_CONSTANTS } from "@/features/admin/admin.constants";
import { AdminDebouncedSearch } from "@/features/admin/components/AdminDebouncedSearch";
import { GroupFormDialog } from "@/features/admin/components/GroupFormDialog";
import {
  useAdminCommunityGroups,
  useAdminDashboardStats,
  useDeleteAdminCommunityGroup,
} from "@/features/admin/hooks/use-admin";
import type { AdminCommunityGroupItem } from "@/types/admin";

export default function AdminCommunityPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] =
    useState<AdminCommunityGroupItem | null>(null);

  const { data: stats } = useAdminDashboardStats();
  const { data, isLoading } = useAdminCommunityGroups({
    page,
    limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
    search: search || undefined,
  });

  const deleteGroupMutation = useDeleteAdminCommunityGroup();

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const groups = data?.items ?? [];
  const defaultGroup = groups.find((g) => g.isDefault);

  return (
    <div className="space-y-4">
      {/* Community Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Chủ đề đang hoạt động
          </div>
          <div className="text-2xl font-extrabold text-[#10243A] mt-2">
            {(stats?.community.activeGroups ?? groups.length).toLocaleString(
              "vi-VN"
            )}
          </div>
        </div>
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Tổng bài viết cộng đồng
          </div>
          <div className="text-2xl font-extrabold text-[#0194F3] mt-2">
            {(stats?.community.approvedPosts ?? 0).toLocaleString("vi-VN")}
          </div>
        </div>
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Chủ đề mặc định
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2 truncate">
            {defaultGroup?.name || "Cộng đồng chung"}
          </div>
        </div>
      </div>

      {/* Community Groups Table Card (No Slug Column) */}
      <div className="bg-white rounded-[24px] p-6 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminDebouncedSearch
            placeholder="Tìm tên chủ đề, điểm đến..."
            onSearchChange={handleSearchChange}
          />

          <button
            type="button"
            onClick={() => {
              setEditingGroup(null);
              setIsDialogOpen(true);
            }}
            className="h-10 px-4 rounded-2xl bg-[#0194F3] hover:bg-[#0084DE] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-colors"
          >
            <i className="fa-solid fa-plus" aria-hidden="true" />
            <span>Tạo chủ đề mới</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pr-4">Chủ đề cộng đồng</th>
                <th className="py-3.5 px-4">Điểm đến / Mô tả ngắn</th>
                <th className="py-3.5 px-4">Số bài viết</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 pl-4 text-right w-14" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {groups.length > 0 ? (
                groups.map((g) => {
                  const cover =
                    g.coverUrl ||
                    g.iconUrl ||
                    ADMIN_UI_CONSTANTS.FALLBACK_GROUP_IMAGE;
                  return (
                    <tr
                      key={g.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cover}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-11 rounded-2xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="font-bold text-[#10243A] flex items-center gap-2">
                            <span>{g.name}</span>
                            {g.isDefault && (
                              <span className="px-2 py-0.5 rounded-md bg-[#10243A] text-white text-[10px] font-bold">
                                Mặc định
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {g.subtitle || "—"}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-700">
                        {(g._count?.posts ?? g.postCount ?? 0).toLocaleString(
                          "vi-VN"
                        )}{" "}
                        bài viết
                      </td>
                      <td className="py-4 px-4">
                        {g.isActive ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                            Đang mở
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px]">
                            Tạm ẩn
                          </span>
                        )}
                      </td>
                      <td className="py-4 pl-4 text-right whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Mở menu thao tác chủ đề"
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
                                setEditingGroup(g);
                                setIsDialogOpen(true);
                              }}
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
                            >
                              <i
                                className="fa-regular fa-pen-to-square w-4 text-slate-400"
                                aria-hidden="true"
                              />
                              <span>Chỉnh sửa chủ đề</span>
                            </DropdownMenuItem>
                            {g.isDefault ? (
                              <div className="px-3 py-2 text-[11px] text-slate-300 font-semibold flex items-center gap-2.5 cursor-not-allowed">
                                <i
                                  className="fa-solid fa-shield w-4"
                                  aria-hidden="true"
                                />
                                <span>Nhóm mặc định (Khóa xóa)</span>
                              </div>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  deleteGroupMutation.mutate(g.id)
                                }
                                className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 cursor-pointer flex items-center gap-2.5"
                              >
                                <i
                                  className="fa-regular fa-trash-can w-4"
                                  aria-hidden="true"
                                />
                                <span>Xóa mềm chủ đề</span>
                              </DropdownMenuItem>
                            )}
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
                      ? "Đang tải danh sách chủ đề..."
                      : "Không tìm thấy chủ đề cộng đồng nào."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <GroupFormDialog
        open={isDialogOpen}
        group={editingGroup}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingGroup(null);
        }}
      />
    </div>
  );
}

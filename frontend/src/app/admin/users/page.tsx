"use client";

import { useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_AVATAR } from "@/config/avatars";
import {
  ADMIN_UI_CONSTANTS,
  formatAdminDateOnly,
} from "@/features/admin/admin.constants";
import { AdminDebouncedSearch } from "@/features/admin/components/AdminDebouncedSearch";
import {
  UserActionDialog,
  type UserActionDialogState,
} from "@/features/admin/components/UserActionDialog";
import {
  useAdminDashboardStats,
  useAdminUsers,
  useUnbanAdminUser,
} from "@/features/admin/hooks/use-admin";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "BANNED"
  >("ALL");
  const [page, setPage] = useState(1);
  const [dialogTarget, setDialogTarget] =
    useState<UserActionDialogState | null>(null);

  const { data: stats } = useAdminDashboardStats();
  const { data, isLoading } = useAdminUsers({
    page,
    limit: ADMIN_UI_CONSTANTS.DEFAULT_PAGE_SIZE,
    search: search || undefined,
    isActive:
      statusFilter === "ACTIVE"
        ? true
        : statusFilter === "BANNED"
          ? false
          : undefined,
  });

  const unbanMutation = useUnbanAdminUser();

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const users = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const totalCount = data?.meta.total ?? 0;

  return (
    <div className="space-y-4">
      {/* User Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Tổng người dùng
          </div>
          <div className="text-2xl font-extrabold text-[#10243A] mt-2">
            {(stats?.users.total ?? totalCount).toLocaleString("vi-VN")}
          </div>
        </div>
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">
            Đang hoạt động
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">
            {(stats?.users.active ?? 0).toLocaleString("vi-VN")}
          </div>
        </div>
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)]">
          <div className="text-xs font-semibold text-slate-500">Đã khóa</div>
          <div className="text-2xl font-extrabold text-rose-600 mt-2">
            {(stats?.users.banned ?? 0).toLocaleString("vi-VN")}
          </div>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-white rounded-[24px] p-6 border border-slate-200/70 shadow-[0_4px_20px_rgba(16,36,58,0.03)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "BANNED");
              setPage(1);
            }}
            aria-label="Lọc trạng thái người dùng"
            className="h-10 px-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0194F3]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="BANNED">Đã khóa</option>
          </select>

          <AdminDebouncedSearch
            placeholder="Tìm họ tên, email, username..."
            onSearchChange={handleSearchChange}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pr-4">Người dùng</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Hoạt động</th>
                <th className="py-3.5 px-4">Ngày tham gia</th>
                <th className="py-3.5 pl-4 text-right w-14" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {users.length > 0 ? (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u.avatarUrl || DEFAULT_AVATAR}
                          alt=""
                          loading="lazy"
                          className="size-10 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="font-bold text-[#10243A]">
                            {u.fullName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {u.email}
                            {u.username ? ` • @${u.username}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                          <i
                            className="fa-regular fa-circle-check"
                            aria-hidden="true"
                          />
                          <span>Đang hoạt động</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px]">
                          <i className="fa-solid fa-ban" aria-hidden="true" />
                          <span>Đã khóa</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-600">
                      {u._count.posts} bài viết • {u._count.itineraries} lịch
                      trình
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-medium">
                      {formatAdminDateOnly(u.createdAt)}
                    </td>
                    <td className="py-4 pl-4 text-right whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="Mở menu thao tác người dùng"
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
                          {u.isActive ? (
                            <DropdownMenuItem
                              onClick={() =>
                                setDialogTarget({ user: u, mode: "BAN" })
                              }
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 cursor-pointer flex items-center gap-2.5"
                            >
                              <i
                                className="fa-solid fa-lock w-4"
                                aria-hidden="true"
                              />
                              <span>Khóa tài khoản</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => unbanMutation.mutate(u.id)}
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-emerald-600 cursor-pointer flex items-center gap-2.5"
                            >
                              <i
                                className="fa-solid fa-lock-open w-4"
                                aria-hidden="true"
                              />
                              <span>Mở khóa tài khoản</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onClick={() =>
                              setDialogTarget({ user: u, mode: "PROMOTE" })
                            }
                            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2.5"
                          >
                            <i
                              className="fa-solid fa-user-shield w-4 text-[#0194F3]"
                              aria-hidden="true"
                            />
                            <span>Thăng quyền Admin</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-slate-400 font-semibold"
                  >
                    {isLoading
                      ? "Đang tải danh sách người dùng..."
                      : "Không tìm thấy người dùng phù hợp."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Trang <b className="text-[#10243A]">{page}</b> /{" "}
              <b className="text-[#10243A]">{totalPages}</b> (Tổng{" "}
              <b className="text-[#10243A]">
                {totalCount.toLocaleString("vi-VN")}
              </b>{" "}
              người dùng)
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
        )}
      </div>

      <UserActionDialog
        target={dialogTarget}
        onClose={() => setDialogTarget(null)}
      />
    </div>
  );
}

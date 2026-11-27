"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  ShieldAlert,
  Search,
} from "lucide-react";
import { AppModalPortal } from "@/components/common/AppModalPortal";
import type {
  AdminBannedWordItem,
  BannedWordAction,
  BannedWordCategory,
} from "@/types/admin";
import {
  useAdminBannedWords,
  useCreateAdminBannedWord,
  useToggleAdminBannedWord,
  useUpdateAdminBannedWord,
  useDeleteAdminBannedWord,
} from "../hooks/use-admin";
import { AdminDebouncedSearch } from "./AdminDebouncedSearch";

const CATEGORY_MAP: Record<
  BannedWordCategory,
  { label: string; badgeClass: string }
> = {
  PROFANITY: {
    label: "Thô tục / Chửi bậy",
    badgeClass: "bg-red-50 text-red-700 border-red-200/60",
  },
  ADULT: {
    label: "Khiêu dâm / 18+",
    badgeClass: "bg-pink-50 text-pink-700 border-pink-200/60",
  },
  SCAM: {
    label: "Lừa đảo / Cọc bẩn",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200/60",
  },
  GAMBLING: {
    label: "Cờ bạc / Cá độ",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200/60",
  },
  OTHER: {
    label: "Chất cấm / Khác",
    badgeClass: "bg-slate-50 text-slate-700 border-slate-200/60",
  },
};

const ACTION_META: Record<
  BannedWordAction,
  { label: string; shortLabel: string; hint: string; badgeClass: string }
> = {
  BLOCK: {
    label: "Chặn ngay (Tầng 1)",
    shortLabel: "Chặn ngay (T1)",
    hint: "Từ chối ngay lập tức khi gửi bài/bình luận, không lưu DB và không gọi AI.",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80",
  },
  REVIEW: {
    label: "AI duyệt (Tầng 2)",
    shortLabel: "AI duyệt (T2)",
    hint: "Cho đăng trước, đẩy nền sang Gemini AI / Admin đọc ngữ cảnh để thu hồi nếu vi phạm.",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200/80",
  },
};

const ACTION_FILTERS: ReadonlyArray<{
  value: "ALL" | BannedWordAction;
  label: string;
}> = [
  { value: "ALL", label: "Tất cả mức" },
  { value: "BLOCK", label: ACTION_META.BLOCK.shortLabel },
  { value: "REVIEW", label: ACTION_META.REVIEW.shortLabel },
];

export function AdminBannedWordsSection() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedAction, setSelectedAction] = useState<
    "ALL" | BannedWordAction
  >("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryCategory =
    selectedCategory === "ALL"
      ? undefined
      : (selectedCategory as BannedWordCategory);
  const queryAction = selectedAction === "ALL" ? undefined : selectedAction;

  const { data, isLoading, isPlaceholderData } = useAdminBannedWords({
    page,
    limit: 20,
    category: queryCategory,
    action: queryAction,
    search: search || undefined,
  });

  const toggleMutation = useToggleAdminBannedWord();
  const updateMutation = useUpdateAdminBannedWord();
  const deleteMutation = useDeleteAdminBannedWord();

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handleActionFilterChange = (action: "ALL" | BannedWordAction) => {
    setSelectedAction(action);
    setPage(1);
  };

  const handleActionChange = (
    item: AdminBannedWordItem,
    nextAction: BannedWordAction
  ) => {
    if (updateMutation.isPending || item.action === nextAction) return;
    updateMutation.mutate({ id: item.id, payload: { action: nextAction } });
  };

  const handleToggle = (item: AdminBannedWordItem) => {
    if (toggleMutation.isPending) return;
    toggleMutation.mutate({ id: item.id, isActive: !item.isActive });
  };

  const handleDelete = async (id: string) => {
    if (deleteMutation.isPending) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  };

  const items = data?.items ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter Pills */}
          <div className="inline-flex p-1 rounded-2xl bg-[#F4F7FB] border border-slate-200/60 text-xs">
            <button
              type="button"
              onClick={() => handleCategoryChange("ALL")}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                selectedCategory === "ALL"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange("PROFANITY")}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                selectedCategory === "PROFANITY"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              Thô tục
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange("ADULT")}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                selectedCategory === "ADULT"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              Khiêu dâm 18+
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange("SCAM")}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                selectedCategory === "SCAM"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              Lừa đảo
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange("GAMBLING")}
              className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                selectedCategory === "GAMBLING"
                  ? "font-bold bg-[#10243A] text-white"
                  : "font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              Cờ bạc
            </button>
          </div>

          {/* Action Level Filter Pills */}
          <div className="inline-flex p-1 rounded-2xl bg-[#F4F7FB] border border-slate-200/60 text-xs">
            {ACTION_FILTERS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleActionFilterChange(opt.value)}
                className={`px-3 py-1.5 rounded-xl cursor-pointer transition-colors ${
                  selectedAction === opt.value
                    ? "font-bold bg-[#0194F3] text-white"
                    : "font-semibold text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <AdminDebouncedSearch
            placeholder="Tìm từ khóa hoặc ghi chú..."
            onSearchChange={handleSearchChange}
          />
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0194F3] hover:bg-[#0180d2] shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Thêm từ khóa</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 pr-4">Từ khóa kiểm duyệt</th>
              <th className="py-3.5 px-4">Danh mục</th>
              <th className="py-3.5 px-4">Mức xử lý</th>
              <th className="py-3.5 px-4">Ghi chú</th>
              <th className="py-3.5 px-4 text-center">Trạng thái (RAM)</th>
              <th className="py-3.5 px-4">Ngày tạo</th>
              <th className="py-3.5 pl-4 text-right w-16">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <Loader2 className="size-6 animate-spin mx-auto text-[#0194F3] mb-2" />
                  Đang nạp danh sách từ khóa...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <ShieldAlert className="size-8 text-slate-300 mx-auto mb-2" />
                  Không tìm thấy từ khóa nào phù hợp
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const catMeta =
                  CATEGORY_MAP[item.category] || CATEGORY_MAP.OTHER;
                const actionMeta =
                  ACTION_META[item.action] || ACTION_META.BLOCK;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 pr-4">
                      <span className="font-extrabold text-slate-900 font-mono text-[13px] bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.word}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catMeta.badgeClass}`}
                      >
                        {catMeta.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        aria-label={`Đổi mức xử lý cho từ khóa ${item.word}`}
                        value={item.action}
                        disabled={updateMutation.isPending}
                        onChange={(e) =>
                          handleActionChange(
                            item,
                            e.target.value as BannedWordAction
                          )
                        }
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 disabled:opacity-50 ${actionMeta.badgeClass}`}
                      >
                        <option value="BLOCK">
                          {ACTION_META.BLOCK.shortLabel}
                        </option>
                        <option value="REVIEW">
                          {ACTION_META.REVIEW.shortLabel}
                        </option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-[200px] truncate">
                      {item.notes || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.isActive}
                        aria-label={`Bật hoặc tắt từ cấm ${item.word}`}
                        disabled={toggleMutation.isPending}
                        onClick={() => handleToggle(item)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 ${
                          item.isActive ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm transition duration-200 ${
                            item.isActive ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <button
                        type="button"
                        title="Xóa từ cấm"
                        aria-label={`Xóa từ cấm ${item.word}`}
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id)}
                        className="size-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
          <span className="text-slate-400">
            Tổng cộng: <strong className="text-slate-700">{total}</strong> từ khóa
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isPlaceholderData}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Trang trước
            </button>
            <span className="text-slate-500">
              Trang {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || isPlaceholderData}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}

      {/* Create Modal Dialog */}
      {isCreateOpen && (
        <CreateBannedWordDialog onClose={() => setIsCreateOpen(false)} />
      )}
    </div>
  );
}

function CreateBannedWordDialog({ onClose }: { onClose: () => void }) {
  const [word, setWord] = useState("");
  const [category, setCategory] = useState<BannedWordCategory>("PROFANITY");
  const [action, setAction] = useState<BannedWordAction>("BLOCK");
  const [notes, setNotes] = useState("");

  const createMutation = useCreateAdminBannedWord();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord || cleanWord.length < 2) return;

    try {
      await createMutation.mutateAsync({
        word: cleanWord,
        category,
        action,
        notes: notes.trim() || undefined,
      });

      onClose();
    } catch {
      // Mutation hook already surfaces error toast; keep dialog open so admin can adjust input.
    }
  };

  return (
    <AppModalPortal
      open={true}
      onClose={onClose}
      ariaLabelledBy="create-banned-word-title"
      maxWidthClass="max-w-[480px]"
    >
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="size-4" />
            </div>
            <h3
              id="create-banned-word-title"
              className="text-base font-bold text-slate-900"
            >
              Thêm từ khóa kiểm duyệt
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="banned-word-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Từ / Cụm từ khóa <span className="text-rose-500">*</span>
            </label>
            <input
              id="banned-word-input"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Ví dụ: nắc, cá độ, đánh bạc, cc..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Hệ thống tự động biên dịch sang RAM và chuẩn hóa lách ký tự (đ.ụ,
              c*ặ*c, đ.á.n.h b.ạ.c).
            </p>
          </div>

          <div>
            <label
              htmlFor="banned-word-action"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Mức xử lý
            </label>
            <select
              id="banned-word-action"
              value={action}
              onChange={(e) => setAction(e.target.value as BannedWordAction)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
            >
              <option value="BLOCK">{ACTION_META.BLOCK.label}</option>
              <option value="REVIEW">{ACTION_META.REVIEW.label}</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {ACTION_META[action].hint}
            </p>
          </div>

          <div>
            <label
              htmlFor="banned-word-category"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Phân loại danh mục
            </label>
            <select
              id="banned-word-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as BannedWordCategory)
              }
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
            >
              <option value="PROFANITY">Thô tục / Chửi bậy / Xúc phạm</option>
              <option value="ADULT">Khiêu dâm / Đồi trụy / 18+</option>
              <option value="SCAM">Lừa đảo / Cọc bẩn / Vé giả</option>
              <option value="GAMBLING">Cờ bạc / Cá độ / Tài xỉu</option>
              <option value="OTHER">Chất cấm / Vi phạm khác</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="banned-word-notes"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Ghi chú nội bộ (tùy chọn)
            </label>
            <input
              id="banned-word-notes"
              type="text"
              maxLength={255}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lý do bổ sung hoặc ngữ cảnh phát hiện..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3]/30 focus:border-[#0194F3]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || word.trim().length < 2}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0194F3] hover:bg-[#0180d2] disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Lưu & Nạp RAM
            </button>
          </div>
        </form>
      </div>
    </AppModalPortal>
  );
}

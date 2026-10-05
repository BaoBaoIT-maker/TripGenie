'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Calendar,
  MapPin,
  Plus,
  ArrowRight,
  Compass,
  ShieldAlert,
  Trash2,
  Loader2,
  CheckSquare,
  Square,
  CheckCheck,
  X,
  Info,
} from 'lucide-react';
import {
  useItinerariesListQuery,
  useDeleteItinerary,
  useBulkDeleteItineraries,
} from '@/features/planner/hooks/use-itinerary-planner';
import { toast } from 'sonner';
import ItineraryWizardModal from '@/features/planner/components/ItineraryWizardModal';
import { formatVnd } from '@/features/planner/model/itinerary-format';
import type { ItineraryDetail } from '@/types/itinerary';

const BUDGET_LABELS: Record<string, string> = {
  LOW: 'Tiết kiệm',
  MEDIUM: 'Tiêu chuẩn',
  HIGH: 'Cao cấp',
  LUXURY: 'Hạng sang',
};

function getDestinationCover(destination?: string | null): string {
  const dest = (destination || '').toLowerCase();
  if (dest.includes('hội an') || dest.includes('quảng nam')) {
    return 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80';
  }
  if (dest.includes('đà nẵng')) {
    return 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80';
  }
  if (dest.includes('đà lạt')) {
    return 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
  }
  if (dest.includes('phú quốc')) {
    return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80';
  }
  if (dest.includes('hà nội')) {
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80';
  }
  return 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80';
}

function formatTripDates(start?: string | null, end?: string | null): string {
  if (!start) return '';
  if (!end || start === end) return start;
  return `${start} – ${end}`;
}

export default function PlannerListPage() {
  const router = useRouter();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPreselectedDest, setWizardPreselectedDest] = useState<string | undefined>(undefined);

  // Fetch real itineraries from database endpoint GET /api/v1/itineraries
  const { data: itineraries = [], isLoading } = useItinerariesListQuery();
  const deleteMutation = useDeleteItinerary();
  const bulkDeleteMutation = useBulkDeleteItineraries();

  const [deletingItin, setDeletingItin] = useState<ItineraryDetail | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const handleDelete = async () => {
    if (!deletingItin) return;
    try {
      await deleteMutation.mutateAsync(deletingItin.id);
      toast.success(`Đã xóa lịch trình "${deletingItin.title}" thành công!`);
      setDeletingItin(null);
    } catch (err: any) {
      toast.error(err?.message || "Không thể xóa lịch trình. Vui lòng thử lại!");
    }
  };

  const toggleSelectMode = () => {
    setIsSelectMode((prev) => {
      if (prev) {
        setSelectedIds([]);
      }
      return !prev;
    });
  };

  const handleToggleSelectId = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === itineraries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(itineraries.map((i) => i.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const countToDelete = selectedIds.length;
      await bulkDeleteMutation.mutateAsync(selectedIds);
      toast.success(`Đã xóa thành công ${countToDelete} lịch trình!`);
      setSelectedIds([]);
      setIsSelectMode(false);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Không thể xóa các lịch trình đã chọn. Vui lòng thử lại!");
    }
  };

  function handleOpenWizard(dest?: string) {
    setWizardPreselectedDest(dest);
    setIsWizardOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      {/* Full-width container spanning wide monitors without empty borders */}
      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8 space-y-10">
        {/* =========================================================================
            1. HERO PROMO BANNER (Full-width responsive with AI accent)
            ========================================================================= */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white p-8 sm:p-12 shadow-md border border-teal-900/40">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="size-3.5" />
              <span>Trí tuệ nhân tạo • Dữ liệu giao thông đa phương thức Việt Nam</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white">
              Lên kế hoạch du lịch thông minh, chuẩn xác từng chặng đường
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              TripGenie tự động tính cự ly nối chặng, đề xuất phương tiện liên tỉnh tối ưu, phân bổ ngân sách 5 phần và sắp xếp điểm đến liên tục tránh đi ziczac.
            </p>

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenWizard()}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:-translate-y-0.5"
              >
                <Sparkles className="size-4" />
                <span>Tạo lịch trình tự động bằng AI</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>

          {/* Decorative background blur bubbles */}
          <div className="absolute -right-20 -top-20 size-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
          <div className="absolute right-40 -bottom-20 size-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        </div>

        {/* =========================================================================
            2. MY ITINERARIES SECTION (Real Database Trips Only)
            ========================================================================= */}
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Chuyến đi của bạn</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  {itineraries.length}
                </span>
                {isSelectMode && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-600 text-white animate-in fade-in">
                    Đã chọn {selectedIds.length}/{itineraries.length}
                  </span>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isSelectMode
                  ? "Nhấp vào các thẻ chuyến đi để chọn hoặc bỏ chọn nhiều lịch trình"
                  : "Lịch trình du lịch thực tế được tạo và lưu trữ trên tài khoản của bạn"}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              {!isLoading && itineraries.length > 0 && (
                <>
                  {isSelectMode ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                      >
                        <CheckCheck className="size-3.5 text-teal-600" />
                        <span>
                          {selectedIds.length === itineraries.length ? "Bỏ chọn tất cả" : `Chọn tất cả (${itineraries.length})`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={toggleSelectMode}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                      >
                        <X className="size-3.5" />
                        <span>Hủy chọn</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleSelectMode}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                    >
                      <CheckSquare className="size-4 text-teal-600" />
                      <span>Chọn nhiều</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => handleOpenWizard()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Plus className="size-4" />
                <span>Tạo chuyến đi mới</span>
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse flex flex-col h-[340px]"
                >
                  <div className="h-48 bg-slate-200" />
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                    <div className="h-4 bg-slate-100 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && itineraries.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center space-y-4 max-w-2xl mx-auto my-6">
              <div className="size-16 rounded-full bg-teal-50 text-teal-600 mx-auto flex items-center justify-center">
                <Compass className="size-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Bạn chưa có lịch trình nào
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Hãy nhấn nút bên dưới để chọn điểm đến và để AI tự động lập lịch trình tối ưu theo ngân sách và sở thích của bạn!
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenWizard()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Sparkles className="size-4" />
                <span>Bắt đầu tạo lịch trình với AI</span>
              </button>
            </div>
          )}

          {/* Real Trips Grid */}
          {!isLoading && itineraries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {itineraries.map((itin) => {
                const totalDays = itin.totalDays || itin.days?.length || 3;
                const totalNights = Math.max(0, totalDays - 1);
                const budgetText = itin.budgetBreakdown?.totalEstimated
                  ? formatVnd(itin.budgetBreakdown.totalEstimated)
                  : 'Theo thực tế';
                const imageUrl = getDestinationCover(itin.destination);
                const dateText = formatTripDates(itin.startDate, itin.endDate);

                const isSelected = selectedIds.includes(itin.id);

                return (
                  <div
                    key={itin.id}
                    onClick={(e) => {
                      if (isSelectMode) {
                        handleToggleSelectId(itin.id, e);
                      } else {
                        router.push(`/itineraries/${itin.id}`);
                      }
                    }}
                    className={`group cursor-pointer bg-white rounded-2xl border overflow-hidden transition-all flex flex-col duration-200 relative ${
                      isSelected
                        ? 'border-teal-500 ring-2 ring-teal-500 bg-teal-50/15 shadow-md'
                        : 'border-slate-200/90 hover:border-teal-500 hover:shadow-md'
                    }`}
                  >
                    {/* Card Cover Image */}
                    <div className="h-48 bg-slate-100 relative overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={itin.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

                      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
                        {isSelectMode && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleSelectId(itin.id, e)}
                            aria-label={isSelected ? "Bỏ chọn" : "Chọn lịch trình"}
                            className={`size-7 rounded-lg backdrop-blur flex items-center justify-center transition-all shadow-xs cursor-pointer ${
                              isSelected
                                ? 'bg-teal-600 text-white shadow-teal-500/30 ring-2 ring-white'
                                : 'bg-white/90 text-slate-700 hover:bg-white'
                            }`}
                          >
                            {isSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                          </button>
                        )}
                        <span className="px-2.5 py-1 bg-white/95 backdrop-blur text-slate-900 text-[11px] font-bold rounded-lg shadow-xs">
                          {totalDays}N{totalNights}Đ
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                        <span className="px-2.5 py-0.5 bg-slate-900/90 backdrop-blur text-white text-[10px] font-semibold rounded-md shadow-xs">
                          {BUDGET_LABELS[itin.budgetLevel] || 'Tiêu chuẩn'}
                        </span>
                        {!isSelectMode && (
                          <button
                            type="button"
                            title="Xóa lịch trình này"
                            aria-label="Xóa lịch trình này"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingItin(itin);
                            }}
                            className="size-6 rounded-md bg-black/50 hover:bg-rose-600 backdrop-blur text-white/90 hover:text-white flex items-center justify-center transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>

                      {itin.destination && (
                        <span className="absolute bottom-2.5 left-3 text-white text-xs font-semibold drop-shadow-sm flex items-center gap-1">
                          <MapPin className="size-3 text-teal-300" />
                          <span>{itin.destination}</span>
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-2 leading-snug">
                          {itin.title}
                        </h3>
                        {dateText && (
                          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                            <Calendar className="size-3 text-slate-400 shrink-0" />
                            <span>{dateText}</span>
                          </p>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            Dự toán
                          </span>
                          <strong className="text-slate-900 font-bold text-xs sm:text-sm">
                            {budgetText}
                          </strong>
                        </div>
                        <span className="font-semibold text-teal-700 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                          <span>Chi tiết</span>
                          <ArrowRight className="size-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Quick Launch Card */}
              <div
                onClick={() => handleOpenWizard()}
                className="cursor-pointer border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 hover:bg-teal-50/30 transition-all min-h-[300px] group"
              >
                <div className="size-12 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                  +
                </div>
                <div className="text-sm font-bold text-slate-800 group-hover:text-teal-700">
                  Lên kế hoạch mới
                </div>
                <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                  Chọn điểm đến và để AI tự động tối ưu hóa lộ trình trong 30 giây
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Bulk Action Bar */}
      {isSelectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <span className="size-6 rounded-full bg-teal-500 text-white font-bold flex items-center justify-center text-xs">
              {selectedIds.length}
            </span>
            <span>Đã chọn {selectedIds.length} lịch trình</span>
          </div>

          <div className="h-5 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              Bỏ chọn
            </button>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-900/30 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
            >
              <Trash2 className="size-3.5" />
              <span>Xóa {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !bulkDeleteMutation.isPending && setShowBulkDeleteModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="size-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                Xóa hàng loạt {selectedIds.length} lịch trình?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa <strong className="text-slate-900 font-semibold">{selectedIds.length} lịch trình</strong> đã chọn? Hành động này sẽ gỡ bỏ chúng khỏi danh sách của bạn.
              </p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed flex items-start gap-1.5">
                <Info className="size-4 text-teal-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong>Bảo vệ bản sao (Clone-safe):</strong> Nếu bất kỳ lịch trình nào trong số này đã được người khác sao chép (clone) về chuyến đi của họ, thì bản sao của họ <strong>hoàn toàn an toàn và không bị ảnh hưởng</strong>.</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={bulkDeleteMutation.isPending}
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {bulkDeleteMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Đang xóa {selectedIds.length} mục...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Xác nhận xóa ({selectedIds.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !deleteMutation.isPending && setDeletingItin(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="size-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                Xóa lịch trình chuyến đi?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa chuyến đi <strong className="text-slate-900 font-semibold">&quot;{deletingItin.title}&quot;</strong>?
              </p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed flex items-start gap-1.5">
                <Info className="size-4 text-teal-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong>Lưu ý:</strong> Chuyến đi sẽ được gỡ khỏi danh sách của bạn. Nếu có người khác đã sao chép (clone) lịch trình này về tài khoản của họ thì bản sao của họ <strong>hoàn toàn không bị mất</strong>.</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setDeletingItin(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creation Wizard Modal */}
      <ItineraryWizardModal
        isOpen={isWizardOpen}
        initialDestination={wizardPreselectedDest}
        onClose={() => {
          setIsWizardOpen(false);
          setWizardPreselectedDest(undefined);
        }}
      />
    </div>
  );
}

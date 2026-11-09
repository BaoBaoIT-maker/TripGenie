"use client";

import * as React from "react";
import { X } from "lucide-react";
import { SuitableAudience } from "@/types/place";
import { RadiusKm, MAP_RADIUS_OPTIONS } from "@/features/map/types";
import { cn } from "@/lib/utils";
import { CommunityModalPortal } from "@/components/community/CommunityModalPortal";

const AUDIENCES: { id: SuitableAudience | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "couple", label: "Cặp đôi" },
  { id: "family", label: "Gia đình" },
  { id: "friends", label: "Nhóm bạn" },
  { id: "solo", label: "Đi một mình" },
];

const RATING_FILTER_OPTIONS: { val: number | null; label: string }[] = [
  { val: null, label: "Tất cả" },
  { val: 3, label: "3.0★+" },
  { val: 4, label: "4.0★+" },
  { val: 4.5, label: "4.5★+" },
];

const BUDGET_LEVEL_OPTIONS: { id: string; label: string; desc: string }[] = [
  { id: "LOW", label: "Dưới 100k", desc: "Tiết kiệm" },
  { id: "MEDIUM", label: "100k - 300k", desc: "Phổ thông" },
  { id: "HIGH", label: "300k - 1 triệu", desc: "Cao cấp" },
  { id: "LUXURY", label: "Trên 1 triệu", desc: "Sang trọng" },
];

const RADIUS_OPTIONS = MAP_RADIUS_OPTIONS;

export interface ExploreFilterValues {
  minRating: number | null;
  budgetLevel: string | null;
  audience: SuitableAudience | "all";
  radiusKm: RadiusKm;
}

export interface ExploreFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  minRating: number | null;
  selectedBudgetLevel: string | null;
  selectedAudience: SuitableAudience | "all";
  useGpsSearch: boolean;
  radiusKm: RadiusKm;
  onApplyFilters: (values: ExploreFilterValues) => void;
  onResetFilters: () => void;
}

export function ExploreFilterModal({
  open,
  onOpenChange,
  minRating,
  selectedBudgetLevel,
  selectedAudience,
  useGpsSearch,
  radiusKm,
  onApplyFilters,
  onResetFilters,
}: ExploreFilterModalProps) {
  // Staging / Draft state to isolate interactions from network queries & map re-renders
  const [draftMinRating, setDraftMinRating] = React.useState<number | null>(minRating);
  const [draftBudgetLevel, setDraftBudgetLevel] = React.useState<string | null>(selectedBudgetLevel);
  const [draftAudience, setDraftAudience] = React.useState<SuitableAudience | "all">(selectedAudience);
  const [draftRadiusKm, setDraftRadiusKm] = React.useState<RadiusKm>(radiusKm);

  // Sync draft states when modal opens
  React.useEffect(() => {
    if (open) {
      setDraftMinRating(minRating);
      setDraftBudgetLevel(selectedBudgetLevel);
      setDraftAudience(selectedAudience);
      setDraftRadiusKm(radiusKm);
    }
  }, [open, minRating, selectedBudgetLevel, selectedAudience, radiusKm]);

  const draftActiveCount = React.useMemo(() => {
    let count = 0;
    if (draftMinRating !== null) count++;
    if (draftBudgetLevel !== null) count++;
    if (draftAudience !== "all") count++;
    if (useGpsSearch && draftRadiusKm !== 5) count++;
    return count;
  }, [draftMinRating, draftBudgetLevel, draftAudience, useGpsSearch, draftRadiusKm]);

  // Single select for budget level: clicking active unselects it, clicking inactive sets it
  const handleToggleBudget = (id: string) => {
    setDraftBudgetLevel((prev) => (prev === id ? null : id));
  };

  const handleApply = () => {
    onApplyFilters({
      minRating: draftMinRating,
      budgetLevel: draftBudgetLevel,
      audience: draftAudience,
      radiusKm: draftRadiusKm,
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraftMinRating(null);
    setDraftBudgetLevel(null);
    setDraftAudience("all");
    setDraftRadiusKm(5);
    onResetFilters();
    onOpenChange(false);
  };

  return (
    <CommunityModalPortal
      open={open}
      onClose={() => onOpenChange(false)}
      ariaLabelledBy="explore-filter-modal-title"
      maxWidthClass="max-w-md"
      dialogClassName="max-h-[85vh] font-sans"
    >
      {/* Sticky Header - Identical to Community Post Detail Modal */}
      <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] bg-white shrink-0">
        <div>
          <h2
            id="explore-filter-modal-title"
            className="text-[16px] font-black text-[#0F172A] tracking-tight"
          >
            Bộ lọc nâng cao
          </h2>
          <p className="text-[11px] text-[#64748B]">
            Chọn tiêu chí phù hợp với kế hoạch của bạn
          </p>
        </div>

        <div className="flex items-center gap-2">
          {draftActiveCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#0194F3]/10 text-[#0194F3] text-[11px] font-bold border border-[#0194F3]/20">
              {draftActiveCount} đang chọn
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-8 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] hover:text-[#0F172A] inline-flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Đóng bộ lọc"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Modal Body - Scrollable without layout shifts */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin">
        {/* Section 1: Rating */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
            <i className="fa-solid fa-star text-amber-500 text-xs shrink-0" />
            <span>Đánh giá tối thiểu</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {RATING_FILTER_OPTIONS.map((opt) => {
              const isSelected = draftMinRating === opt.val;
              return (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => setDraftMinRating(opt.val)}
                  className={cn(
                    "py-1.5 px-2 rounded-xl text-xs font-semibold transition-all text-center cursor-pointer border",
                    isSelected
                      ? "bg-[#0194F3] text-white border-[#0194F3] shadow-xs font-bold"
                      : "bg-[#F8FAFC] border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9]"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Budget - SINGLE SELECT */}
        <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
              <i className="fa-solid fa-wallet text-emerald-600 text-xs shrink-0" />
              <span>Khoảng chi phí</span>
            </div>
            <span className="text-[10px] text-[#64748B] font-medium">Chọn 1 mức</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {BUDGET_LEVEL_OPTIONS.map((opt) => {
              const isSelected = draftBudgetLevel === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleToggleBudget(opt.id)}
                  className={cn(
                    "p-2.5 rounded-xl text-left transition-all cursor-pointer border flex flex-col gap-0.5",
                    isSelected
                      ? "bg-[#0194F3]/10 border-[#0194F3] text-[#0194F3] font-bold shadow-2xs ring-1 ring-[#0194F3]"
                      : "bg-[#F8FAFC] border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-bold", isSelected ? "text-[#0194F3]" : "text-[#0F172A]")}>
                      {opt.label}
                    </span>
                    {isSelected && (
                      <i className="fa-solid fa-circle-check text-[11px] text-[#0194F3]" />
                    )}
                  </div>
                  <span className="text-[10px] text-[#64748B] line-clamp-1">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Audience */}
        <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
            <i className="fa-solid fa-users text-[#0194F3] text-xs shrink-0" />
            <span>Phù hợp với đối tượng</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AUDIENCES.map((aud) => {
              const isSelected = draftAudience === aud.id;
              return (
                <button
                  key={aud.id}
                  type="button"
                  onClick={() => setDraftAudience(aud.id)}
                  className={cn(
                    "py-1.5 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer border",
                    isSelected
                      ? "bg-[#0194F3] text-white border-[#0194F3] shadow-xs font-bold"
                      : "bg-[#F8FAFC] border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9]"
                  )}
                >
                  {aud.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 4: GPS Radius (if GPS search active) */}
        {useGpsSearch && (
          <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0194F3]">
              <i className="fa-solid fa-location-crosshairs text-xs shrink-0" />
              <span>Bán kính tìm kiếm quanh vị trí</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {RADIUS_OPTIONS.map((r) => {
                const isSelected = draftRadiusKm === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDraftRadiusKm(r)}
                    className={cn(
                      "py-1.5 rounded-xl text-xs font-semibold transition-all text-center cursor-pointer border",
                      isSelected
                        ? "bg-[#0194F3] text-white border-[#0194F3] shadow-xs font-bold"
                        : "bg-[#F8FAFC] border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9]"
                    )}
                  >
                    {r}km
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={handleReset}
          className="text-[#64748B] hover:text-[#E11D48] hover:bg-rose-50 px-3 py-1.5 rounded-[12px] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <i className="fa-solid fa-rotate-left text-xs" />
          <span>Đặt lại</span>
        </button>

        <button
          type="button"
          onClick={handleApply}
          className="px-5 py-2 rounded-[12px] bg-[#0194F3] hover:bg-[#0082d6] text-white text-xs font-bold transition-all shadow-md shadow-[#0194F3]/20 cursor-pointer active:scale-95"
        >
          Áp dụng {draftActiveCount > 0 ? `(${draftActiveCount})` : "bộ lọc"}
        </button>
      </div>
    </CommunityModalPortal>
  );
}

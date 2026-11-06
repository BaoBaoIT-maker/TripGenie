"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Star,
  DollarSign,
  Users,
  LocateFixed,
  RotateCcw,
} from "lucide-react";
import { SuitableAudience } from "@/types/place";
import { RadiusKm } from "@/features/map/types";
import { cn } from "@/lib/utils";

const AUDIENCES: { id: SuitableAudience | "all"; label: string }[] = [
  { id: "all", label: "Tất cả đối tượng" },
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
  { id: "LOW", label: "Dưới 100k", desc: "Tiết kiệm (< 100.000đ)" },
  { id: "MEDIUM", label: "100k - 300k", desc: "Phổ thông (100.000đ - 300.000đ)" },
  { id: "HIGH", label: "300k - 1 triệu", desc: "Cao cấp (300.000đ - 1.000.000đ)" },
  { id: "LUXURY", label: "Trên 1 triệu", desc: "Sang trọng (> 1.000.000đ)" },
];

const RADIUS_OPTIONS: RadiusKm[] = [1, 3, 5, 10, 20];

interface ExploreFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  minRating: number | null;
  onMinRatingChange: (val: number | null) => void;
  selectedBudgetLevels: string[];
  onBudgetLevelToggle: (id: string) => void;
  selectedAudience: SuitableAudience | "all";
  onAudienceChange: (val: SuitableAudience | "all") => void;
  useGpsSearch: boolean;
  radiusKm: RadiusKm;
  onRadiusKmChange: (val: RadiusKm) => void;
  onReset: () => void;
  activeFilterCount: number;
}

export function ExploreFilterSheet({
  open,
  onOpenChange,
  minRating,
  onMinRatingChange,
  selectedBudgetLevels,
  onBudgetLevelToggle,
  selectedAudience,
  onAudienceChange,
  useGpsSearch,
  radiusKm,
  onRadiusKmChange,
  onReset,
  activeFilterCount,
}: ExploreFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-white text-slate-900 border-l border-slate-200"
      >
        {/* Header */}
        <SheetHeader className="p-5 border-b border-slate-100 text-left">
          <div className="flex items-center justify-between pr-6">
            <div>
              <SheetTitle className="text-lg font-black tracking-tight text-slate-900">
                Bộ lọc nâng cao
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500 mt-0.5">
                Tinh chỉnh tìm kiếm địa điểm theo nhu cầu của bạn
              </SheetDescription>
            </div>
            {activeFilterCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-sky-50 text-[#0194F3] text-xs font-bold border border-sky-200">
                {activeFilterCount} đang bật
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable Filters Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Rating */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Star className="size-4 text-amber-500 fill-amber-500" />
              <span>Đánh giá tối thiểu</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {RATING_FILTER_OPTIONS.map((opt) => {
                const isSelected = minRating === opt.val;
                return (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => onMinRatingChange(opt.val)}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border",
                      isSelected
                        ? "bg-[#0194F3] text-white border-[#0194F3] shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Budget */}
          <div className="space-y-2.5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <DollarSign className="size-4 text-emerald-600" />
              <span>Khoảng chi phí</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {BUDGET_LEVEL_OPTIONS.map((opt) => {
                const isSelected = selectedBudgetLevels.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onBudgetLevelToggle(opt.id)}
                    title={opt.desc}
                    className={cn(
                      "p-3 rounded-xl text-left transition-all cursor-pointer border flex flex-col gap-0.5",
                      isSelected
                        ? "bg-sky-50 border-[#0194F3] text-[#0194F3] shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Audience */}
          <div className="space-y-2.5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Users className="size-4 text-[#0194F3]" />
              <span>Phù hợp với đối tượng</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((aud) => {
                const isSelected = selectedAudience === aud.id;
                return (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => onAudienceChange(aud.id)}
                    className={cn(
                      "py-2 px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer border",
                      isSelected
                        ? "bg-[#0194F3] text-white border-[#0194F3] shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
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
            <div className="space-y-2.5 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0194F3]">
                <LocateFixed className="size-4" />
                <span>Bán kính tìm kiếm vị trí hiện tại</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {RADIUS_OPTIONS.map((r) => {
                  const isSelected = radiusKm === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onRadiusKmChange(r)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border",
                        isSelected
                          ? "bg-[#0194F3] text-white border-[#0194F3] shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
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
        <SheetFooter className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 text-xs font-bold gap-1.5 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Xóa tất cả</span>
          </Button>

          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-6 py-2.5 rounded-xl bg-[#0194F3] hover:bg-[#0073D1] text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            Xem kết quả
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { Sparkles, SlidersHorizontal, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SearchMode } from "../types";

export interface MapSearchTabsProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

export function MapSearchTabs({ mode, onModeChange }: MapSearchTabsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="Chế độ tìm kiếm" className="flex items-center gap-2 border-b pb-2">
        <button
          role="tab"
          type="button"
          aria-selected={mode === "keyword"}
          onClick={() => onModeChange("keyword")}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
            mode === "keyword"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="size-4" />
          <span>Bộ lọc & Tìm kiếm</span>
        </button>

        <button
          role="tab"
          type="button"
          aria-selected={mode === "ai"}
          onClick={() => onModeChange("ai")}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
            mode === "ai"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground border border-dashed border-border/80"
          }`}
        >
          <Sparkles className="size-4 text-amber-500" />
          <span>Trợ lý AI</span>
          <Badge
            variant="outline"
            className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
          >
            AI mô phỏng
          </Badge>
        </button>
      </div>

      {mode === "ai" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg text-amber-900 dark:text-amber-300">
          <Info className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Chế độ AI mô phỏng (Demo): Nhập câu tự nhiên như <em>&ldquo;quán cafe yên tĩnh làm việc gần biển&rdquo;</em>, hệ thống sẽ tính điểm phù hợp dựa trên dữ liệu mẫu.
          </span>
        </div>
      )}
    </div>
  );
}

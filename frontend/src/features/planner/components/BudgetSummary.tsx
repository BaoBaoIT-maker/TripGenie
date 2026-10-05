"use client";

import { Planner } from "@/types/planner";
import { Wallet, AlertTriangle } from "lucide-react";

interface BudgetSummaryProps {
  planner: Planner;
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

export function BudgetSummary({ planner }: BudgetSummaryProps) {
  const budget = planner.budget || 0;
  const estimatedCost = planner.estimatedTotalCost || 0;
  const isOverBudget = budget > 0 && estimatedCost > budget;
  const percentage = budget > 0 ? Math.min(100, Math.round((estimatedCost / budget) * 100)) : 0;

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <Wallet className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Tổng kết chi phí</h3>
            <p className="text-[11px] text-muted-foreground">Ước tính theo các chặng</p>
          </div>
        </div>

        {isOverBudget && (
          <span className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
            <AlertTriangle className="size-3" />
            Vượt ngân sách
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground font-medium">Chi phí ước tính:</span>
          <span className="text-base font-bold text-foreground">{formatVnd(estimatedCost)}</span>
        </div>

        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground font-medium">Ngân sách dự kiến:</span>
          <span className="font-semibold text-muted-foreground">{formatVnd(budget)}</span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1 pt-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isOverBudget ? "bg-destructive" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Đã dùng {percentage}%</span>
            <span>{budget > estimatedCost ? `Còn dư ${formatVnd(budget - estimatedCost)}` : "Đã chạm ngưỡng"}</span>
          </div>
        </div>
      </div>

      {/* Per-day breakdown */}
      {planner.days && planner.days.length > 0 && (
        <div className="pt-2 border-t border-border/70 space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Chi tiết theo ngày
          </h4>
          <div className="space-y-1.5 text-xs">
            {planner.days.map((day) => (
              <div key={day.day} className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">Ngày {day.day}:</span>
                <span className="font-medium text-foreground">{formatVnd(day.dayTotalCost || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

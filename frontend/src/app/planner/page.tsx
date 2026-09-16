"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  PenTool,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlannerCard } from "@/components/planner/PlannerCard";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { usePlannersQuery } from "@/features/planner/hooks/use-planner";

export default function PlannerListPage() {
  const router = useRouter();
  const { data: planners = [], isLoading, isError, refetch } = usePlannersQuery();

  if (isLoading) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <LoadingState message="Đang tải danh sách lịch trình..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-4">
          <div className="flex justify-center text-destructive">
            <AlertCircle className="size-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Lỗi khi tải lịch trình</h2>
          <p className="text-sm text-muted-foreground">
            Không thể tải danh sách lịch trình. Vui lòng kiểm tra lại kết nối.
          </p>
          <Button onClick={() => refetch()} variant="outline" className="rounded-xl">
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  // User's personal planners (owned or edited)
  const myPlanners = planners.filter(
    (p) =>
      p.members?.some((m) => m.userId === "user-current") ||
      p.authorName?.includes("Của bạn") ||
      p.authorName?.includes("Trọng Phúc") ||
      !p.authorName?.includes("AI")
  );

  // Recommended AI planners
  const recommendedPlanners = planners.filter((p) => p.authorName?.includes("AI"));

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 xl:px-10 space-y-10 pb-16">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER BANNER
      ───────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5 border-b border-border pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
          Lịch trình chuyến đi
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Lên kế hoạch tự động bằng AI hoặc tự thiết kế lộ trình theo ý bạn.
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DUAL CREATION METHODS (AI vs THỦ CÔNG)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {/* METHOD 1: AI PLANNER */}
        <div className="flex flex-col justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-background p-5 shadow-xs transition-all hover:border-primary hover:shadow-md">
          <div className="space-y-2.5">
            <Badge className="bg-primary text-primary-foreground font-bold px-2.5 py-0.5 text-xs gap-1 shadow-2xs w-fit">
              <Sparkles className="size-3" />
              <span>AI Tối ưu</span>
            </Badge>

            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold font-heading text-foreground">
                Tạo bằng AI
              </h2>
              <p className="text-xs text-muted-foreground">
                Tự động sắp xếp lộ trình và thời gian tối ưu theo ngân sách và sở thích.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Link href="/planner/new?mode=ai" className="block w-full">
              <Button className="w-full h-10 rounded-xl font-bold gap-2 text-xs sm:text-sm bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all">
                <Sparkles className="size-3.5" />
                <span>Tạo lịch trình AI</span>
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            </Link>
          </div>
        </div>

        {/* METHOD 2: MANUAL PLANNER */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-border hover:shadow-md">
          <div className="space-y-2.5">
            <Badge variant="outline" className="font-semibold px-2.5 py-0.5 text-xs gap-1 w-fit">
              <PenTool className="size-3 text-muted-foreground" />
              <span>Tự do tùy biến</span>
            </Badge>

            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold font-heading text-foreground">
                Tự thiết kế
              </h2>
              <p className="text-xs text-muted-foreground">
                Chủ động chọn địa điểm yêu thích và sắp xếp thời gian theo ý bạn.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Link href="/planner/new?mode=manual" className="block w-full">
              <Button
                variant="outline"
                className="w-full h-10 rounded-xl font-bold gap-2 text-xs sm:text-sm border-border hover:bg-muted transition-colors"
              >
                <PenTool className="size-3.5" />
                <span>Tạo thủ công</span>
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SECTION: LỊCH TRÌNH CỦA BẠN
      ───────────────────────────────────────────────────────────── */}
      <section className="space-y-5 pt-2">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight font-heading text-foreground">
              Chuyến đi của bạn
            </h2>
            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
              {myPlanners.length}
            </span>
          </div>
        </div>

        {myPlanners.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {myPlanners.map((planner) => (
              <div key={planner.id} className="relative group/item">
                <PlannerCard
                  planner={planner}
                  editHref={`/planner/${planner.id}/edit`}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Chưa có lịch trình nào"
            description="Bắt đầu tạo lịch trình đầu tiên bằng AI hoặc tự thiết kế thủ công."
            actionLabel="Tạo ngay"
            onAction={() => router.push("/planner/new?mode=ai")}
          />
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. SECTION: LỊCH TRÌNH GỢI Ý
      ───────────────────────────────────────────────────────────── */}
      <section className="space-y-5 pt-4">
        <div className="space-y-1 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight font-heading text-foreground">
              Lịch trình gợi ý
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
              {recommendedPlanners.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Các lộ trình du lịch phổ biến được nhiều người lựa chọn.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recommendedPlanners.map((planner) => (
            <PlannerCard key={planner.id} planner={planner} />
          ))}
        </div>
      </section>
    </div>
  );
}

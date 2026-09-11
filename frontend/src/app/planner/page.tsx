"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CalendarDays,
  PenTool,
  ArrowRight,
  History,
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
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <LoadingState message="Đang tải danh sách lịch trình..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12 pb-16">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER BANNER
      ───────────────────────────────────────────────────────────── */}
      <div className="space-y-2 border-b border-border pb-6">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary tracking-wider">
          <CalendarDays className="size-3.5" />
          <span>Quản lý lịch trình du lịch</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading text-foreground">
          Lập kế hoạch & Lịch trình chuyến đi
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Tùy chọn tạo lịch trình bằng Trí tuệ nhân tạo (AI) để tối ưu lộ trình trong 5 giây, hoặc tự do thiết kế lịch trình thủ công theo từng địa điểm yêu thích.
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DUAL CREATION METHODS (AI vs THỦ CÔNG)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* METHOD 1: AI PLANNER */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-background p-5 sm:p-6 shadow-xs transition-all hover:border-primary hover:shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge className="bg-primary text-primary-foreground font-bold px-2.5 py-0.5 text-xs gap-1 shadow-2xs">
                <Sparkles className="size-3" />
                <span>AI Tối ưu</span>
              </Badge>
              <span className="text-[11px] font-medium text-muted-foreground">
                ⚡ Tạo trong 5 giây
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold font-heading text-foreground">
                Khởi tạo với Trợ lý AI
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nhập điểm đến, ngân sách và sở thích; AI sẽ tự động phân tích và sắp xếp các chặng dừng tối ưu về khoảng cách và thời gian.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Link href="/planner/new?mode=ai" className="block w-full">
              <Button className="w-full h-11 rounded-xl font-bold gap-2 text-xs sm:text-sm bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all">
                <Sparkles className="size-3.5" />
                <span>Bắt đầu tạo với AI</span>
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            </Link>
          </div>
        </div>

        {/* METHOD 2: MANUAL PLANNER */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs transition-all hover:border-border hover:shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="font-semibold px-2.5 py-0.5 text-xs gap-1">
                <PenTool className="size-3 text-muted-foreground" />
                <span>Tự thiết kế</span>
              </Badge>
              <span className="text-[11px] font-medium text-muted-foreground">
                🛠️ Tùy biến 100%
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold font-heading text-foreground">
                Lập lịch trình thủ công
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tự tay chọn quán cafe, nhà hàng, khách sạn và sắp xếp thời gian theo đúng lịch trình của bạn.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Link href="/planner/new?mode=manual" className="block w-full">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl font-bold gap-2 text-xs sm:text-sm border-border hover:bg-muted transition-colors"
              >
                <PenTool className="size-3.5" />
                <span>Tạo lịch trình thủ công</span>
                <ArrowRight className="size-3.5 ml-auto" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SECTION: LỊCH TRÌNH CỦA TÔI (LỊCH SỬ CHUYẾN ĐI)
      ───────────────────────────────────────────────────────────── */}
      <section className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase text-primary tracking-wider">
              <History className="size-4 text-primary" />
              <span>Lịch trình của tôi (Lịch sử)</span>
              <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-bold">
                {myPlanners.length} chuyến đi
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight font-heading text-foreground">
              Các chuyến đi bạn đã tạo & lưu lại
            </h2>
          </div>
        </div>

        {myPlanners.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            title="Bạn chưa có lịch trình nào trong lịch sử"
            description="Hãy bắt đầu tạo lịch trình đầu tiên bằng Trợ lý AI hoặc công cụ Lập lịch trình thủ công ở phía trên!"
            actionLabel="Tạo với AI ngay"
            onAction={() => router.push("/planner/new?mode=ai")}
          />
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. SECTION: LỊCH TRÌNH GỢI Ý & MẪU AI PHỔ BIẾN
      ───────────────────────────────────────────────────────────── */}
      <section className="space-y-6 pt-6">
        <div className="space-y-1 border-b border-border pb-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase text-accent-foreground tracking-wider">
            <Sparkles className="size-4 text-primary" />
            <span>Mẫu lịch trình đề xuất</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
              {recommendedPlanners.length} mẫu có sẵn
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight font-heading text-foreground">
            Lịch trình mẫu tối ưu bởi AI & Chuyên gia du lịch
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Bạn có thể mở bất kỳ lịch trình nào dưới đây để xem lộ trình chi tiết và sao chép hoặc nhờ AI điều chỉnh theo sở thích riêng.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recommendedPlanners.map((planner) => (
            <PlannerCard key={planner.id} planner={planner} />
          ))}
        </div>
      </section>
    </div>
  );
}

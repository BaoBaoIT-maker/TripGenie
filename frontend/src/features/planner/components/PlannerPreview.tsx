"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  DollarSign,
  Clock,
  Navigation,
  Share2,
  ArrowLeft,
  Wallet,
  Edit3,
  Users,
  Calendar,
  UserPlus,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { usePlannerQuery } from "@/features/planner/hooks/use-planner";
import { PlannerDay, PlannerItem } from "@/types/planner";
import { toast } from "sonner";

interface PlannerPreviewProps {
  plannerId: string;
}

export function PlannerPreview({ plannerId }: PlannerPreviewProps) {
  const router = useRouter();
  const { data: planner, isLoading, isError } = usePlannerQuery(plannerId);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  if (isLoading) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <LoadingState message="Đang tải kế hoạch chuyến đi..." />
      </div>
    );
  }

  if (isError || !planner) {
    return (
      <div className="max-w-[1536px] mx-auto w-full px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <EmptyState
          title="Không tìm thấy lịch trình"
          description="Lịch trình này không tồn tại hoặc đã bị xóa."
          actionLabel="Quay lại danh sách lịch trình"
          onAction={() => {
            router.push("/planner");
          }}
        />
      </div>
    );
  }

  const currentDay: PlannerDay | undefined =
    planner.days[activeDayIndex] || planner.days[0];

  const allExpenseItems = planner.days.flatMap((day) =>
    day.items.map((item) => ({
      name: item.place?.name || item.note || "Hoạt động trải nghiệm",
      cost: item.estimatedCost || 0,
    }))
  );

  const handleShare = async () => {
    if (typeof window !== "undefined") {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Đã sao chép đường link lịch trình vào clipboard!");
      } catch {
        toast.info(window.location.href);
      }
    }
  };

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 space-y-8 pb-20">
      {/* TOP TOOLBAR: BREADCRUMB & ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs border-b border-border pb-4">
        <Link
          href="/planner"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "gap-1.5 font-semibold text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeft className="size-4" />
          <span>Danh sách lịch trình</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Share Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="h-9 px-3.5 rounded-xl font-semibold gap-1.5"
          >
            <Share2 className="size-3.5" />
            <span>Chia sẻ</span>
          </Button>

          {/* Edit Trip Primary CTA */}
          <Link
            href={`/planner/${planner.id}/edit`}
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-9 px-4 rounded-xl font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
            )}
          >
            <Edit3 className="size-3.5" />
            <span>Chỉnh sửa chuyến đi</span>
          </Link>
        </div>
      </div>

      {/* MAIN 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: INFO & ITINERARY */}
        <div className="lg:col-span-8 space-y-8">
          {/* Header & Cover Image Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
                {planner.title}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Xem chi tiết lịch trình và kế hoạch trải nghiệm từng ngày của chuyến đi.
              </p>
            </div>

            {/* Cover Image Banner */}
            <div className="relative aspect-[16/7] sm:aspect-[16/6] w-full overflow-hidden rounded-3xl bg-muted shadow-xs">
              <Image
                src={planner.coverImage}
                alt={planner.title}
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground text-xs font-bold py-1 px-3 shadow-md">
                    {planner.durationText}
                  </Badge>
                  <span className="text-xs font-semibold drop-shadow-sm flex items-center gap-1">
                    <MapPin className="size-3.5 text-primary" />
                    {planner.destination}
                  </span>
                  {planner.startDate && (
                    <span className="text-xs font-medium drop-shadow-sm flex items-center gap-1 opacity-90">
                      <Calendar className="size-3.5" />
                      {planner.startDate} {planner.endDate ? `→ ${planner.endDate}` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Trip Info Box */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed space-y-1.5">
              <div className="flex flex-wrap items-center gap-3 font-medium text-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-primary" /> {planner.destination}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5 text-primary" /> {planner.durationDays} ngày
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="size-3.5 text-primary" /> {planner.people} người
                </span>
              </div>
              {planner.summaryRoute && (
                <p className="pt-1 text-foreground/90">
                  📍 <strong>Lộ trình chính:</strong> {planner.summaryRoute}
                </p>
              )}
            </div>
          </div>

          {/* Detailed Itinerary */}
          <div className="space-y-6 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <h2 className="text-xl font-bold font-heading text-foreground">
                Lộ trình chi tiết
              </h2>

              {/* Day Selector Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {planner.days.map((day, idx) => (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => setActiveDayIndex(idx)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all shrink-0 ${
                      activeDayIndex === idx
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Ngày {day.day}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Day Subheader */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Ngày {currentDay?.day || 1}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {currentDay?.items.length || 0} điểm dừng tham quan & trải nghiệm
                </p>
              </div>
            </div>

            {/* Read-only Timeline Items */}
            {currentDay && currentDay.items.length > 0 ? (
              <div className="space-y-4">
                {currentDay.items.map((item: PlannerItem, idx: number) => (
                  <div key={item.id} className="space-y-3">
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Step Number Circle */}
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm border border-primary/20 shadow-2xs mt-3">
                        {idx + 1}
                      </div>

                      {/* Main Card */}
                      <div className="flex-1 overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
                        <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
                          <div className="flex gap-3 sm:gap-4 items-start">
                            {item.place?.coverImage && (
                              <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                                <Image
                                  src={item.place.coverImage}
                                  alt={item.place.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}

                            <div className="space-y-1">
                              <h4 className="text-sm sm:text-base font-bold text-foreground leading-snug">
                                {item.place?.name || "Điểm tham quan"}
                              </h4>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                📍 {item.place?.address || "Địa chỉ cập nhật theo bản đồ"}
                              </p>

                              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                                <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 font-semibold text-foreground">
                                  <Clock className="size-3 text-primary" />
                                  {item.startTime} - {item.endTime || "11:30 SA"}
                                </span>

                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 font-semibold">
                                  <DollarSign className="size-3" />
                                  {item.estimatedCost ? item.estimatedCost.toLocaleString() + " đ" : "Miễn phí"}
                                </span>
                              </div>

                              {item.note && (
                                <p className="text-xs text-muted-foreground italic pt-1">
                                  &ldquo;{item.note}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Travel Time Box */}
                    {idx < currentDay.items.length - 1 && (
                      <div className="ml-11 sm:ml-12 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3.5 py-2 rounded-xl w-fit border border-border/60">
                        <Navigation className="size-3.5 text-orange-500 shrink-0" />
                        <span>
                          Di chuyển <strong>{item.travelTimeToNext?.durationMinutes || 15} phút</strong> ({item.travelTimeToNext?.distanceKm || 2.5} km)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Chưa có điểm dừng nào trong ngày này.
                </p>
                <Link
                  href={`/planner/${planner.id}/edit`}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "text-xs font-bold rounded-xl")}
                >
                  Chỉnh sửa để thêm điểm dừng
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: BUDGET & COMPANIONS */}
        <div className="lg:col-span-4 space-y-6">
          {/* WIDGET 1: BUDGET SUMMARY */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                  <Wallet className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  Ngân sách chuyến đi
                </h3>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black font-heading text-orange-500">
                {planner.estimatedTotalCost ? planner.estimatedTotalCost.toLocaleString() : "0"} đ
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tổng chi phí ước tính từ toàn bộ lịch trình
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-border/70 max-h-64 overflow-y-auto">
              {allExpenseItems.length > 0 ? (
                allExpenseItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[180px]">
                      {item.name}
                    </span>
                    <span className="font-bold text-foreground shrink-0">
                      {item.cost ? item.cost.toLocaleString() + " đ" : "Miễn phí"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Chưa có khoản chi phí nào.</p>
              )}
            </div>
          </div>

          {/* WIDGET 2: MEMBERS & INVITATIONS */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Bạn đồng hành ({planner.members?.length || 0})
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {planner.people} người
              </Badge>
            </div>

            <div className="space-y-3">
              {planner.members && planner.members.length > 0 ? (
                planner.members.map((member) => (
                  <div key={member.userId} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-8">
                        <AvatarImage src={member.avatarUrl} alt={member.displayName} />
                        <AvatarFallback className="text-[10px] font-bold">
                          {member.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">
                          {member.displayName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {member.email}
                        </div>
                      </div>
                    </div>
                    <Badge variant={member.role === "owner" ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {member.role === "owner" ? "Trưởng nhóm" : member.role === "editor" ? "Chỉnh sửa" : "Xem"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Chưa có bạn đồng hành.</p>
              )}
            </div>

            {planner.invitations && planner.invitations.length > 0 && (
              <div className="pt-2 border-t border-border/70 space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Lời mời đang chờ ({planner.invitations.filter((i) => i.status === "pending").length})
                </span>
                {planner.invitations
                  .filter((inv) => inv.status === "pending")
                  .map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground truncate">{inv.invitee.displayName}</span>
                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                        Đang chờ ({inv.permission === "editor" ? "sửa" : "xem"})
                      </Badge>
                    </div>
                  ))}
              </div>
            )}

            <Link
              href={`/planner/${planner.id}/edit`}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full h-10 rounded-xl font-bold text-xs mt-2"
              )}
            >
              <UserPlus className="size-3.5 mr-1.5" />
              <span>Quản lý bạn đồng hành</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

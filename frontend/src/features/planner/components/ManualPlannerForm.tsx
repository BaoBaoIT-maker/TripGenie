"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FilePlus2, MapPinPlus, ListOrdered, Calendar, MapPin, Users, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ManualPlannerInput } from "@/types/planner";
import { manualPlannerSchema } from "../schemas/manual-planner-schema";
import { getDefaultManualPlannerDates } from "../model/manual-planner";
import { useCreateManualPlannerMutation } from "../hooks/use-planner";

export interface ManualPlannerFormProps {
  coverOptions: string[];
}

export function ManualPlannerForm({ coverOptions }: ManualPlannerFormProps) {
  const router = useRouter();
  const createManual = useCreateManualPlannerMutation();
  const defaultDates = useMemo(() => getDefaultManualPlannerDates(new Date()), []);

  const form = useForm<ManualPlannerInput>({
    resolver: zodResolver(manualPlannerSchema),
    defaultValues: {
      title: "",
      description: "",
      destination: "",
      ...defaultDates,
      people: 2,
      budget: 3_000_000,
      coverImage: coverOptions[0] || "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const selectedCover = watch("coverImage");

  const onSubmit = handleSubmit(async (input) => {
    try {
      const created = await createManual.mutateAsync(input);
      toast.success("Đã tạo chuyến đi trống. Hãy chọn địa điểm đầu tiên!");
      router.push(`/planner/${created.id}/edit`);
    } catch {
      toast.error("Không thể tạo chuyến đi. Vui lòng thử lại!");
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* ─────────────────────────────────────────────────────────────
          LEFT COLUMN (lg:col-span-7): COVER IMAGE, TITLE, DESCRIPTION
      ───────────────────────────────────────────────────────────── */}
      <div className="lg:col-span-7 space-y-6">
        {/* Cover Preview and Selection */}
        <div className="space-y-3">
          <div className="relative aspect-[16/8] sm:aspect-[16/7] w-full overflow-hidden rounded-2xl border border-border/80 bg-muted/30">
            {selectedCover ? (
              <Image
                src={selectedCover}
                alt="Cover preview"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 60vw"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Chưa có ảnh bìa
              </div>
            )}
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute bottom-3 left-3 text-white text-xs font-semibold px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-xs">
              Ảnh bìa chuyến đi
            </div>
          </div>

          {/* Thumbnail options */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {coverOptions.map((url, index) => {
              const isChosen = selectedCover === url;
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => setValue("coverImage", url, { shouldValidate: true })}
                  aria-label={coverOptions.length === 1 ? "Chọn ảnh bìa" : `Chọn ảnh bìa ${index + 1}`}
                  aria-pressed={isChosen}
                  className={`relative size-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${
                    isChosen
                      ? "border-primary ring-2 ring-primary/30 scale-105"
                      : "border-border/80 opacity-70 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={url}
                    alt={`Cover option ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="56px"
                    unoptimized
                  />
                </button>
              );
            })}
          </div>
          {errors.coverImage?.message && (
            <p className="min-h-5 text-xs text-destructive">{errors.coverImage.message}</p>
          )}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="manual-title" className="text-xs font-bold uppercase text-foreground">
            Tên chuyến đi <span className="text-destructive">*</span>
          </label>
          <Input
            id="manual-title"
            placeholder="Ví dụ: Cuối tuần ở Sài Gòn, Nghỉ dưỡng Đà Lạt..."
            {...register("title")}
            aria-invalid={Boolean(errors.title)}
            aria-describedby="manual-title-error"
            className="h-11 rounded-xl text-sm"
          />
          <p id="manual-title-error" className="min-h-5 text-xs text-destructive">
            {errors.title?.message}
          </p>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="manual-description" className="text-xs font-bold uppercase text-foreground">
            Mô tả chuyến đi
          </label>
          <textarea
            id="manual-description"
            rows={3}
            placeholder="Ghi chú thêm về mục tiêu, sở thích hay điều bạn muốn trải nghiệm..."
            {...register("description")}
            aria-invalid={Boolean(errors.description)}
            aria-describedby="manual-description-error"
            className="w-full rounded-xl border border-input bg-card p-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground resize-none"
          />
          <p id="manual-description-error" className="min-h-5 text-xs text-destructive">
            {errors.description?.message}
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT COLUMN (lg:col-span-5): DESTINATION, DATES, TRAVELERS,
          BUDGET, THREE-STEP GUIDE, SUBMIT
      ───────────────────────────────────────────────────────────── */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-4 shadow-xs">
          {/* Destination */}
          <div className="space-y-1.5">
            <label htmlFor="manual-destination" className="flex items-center gap-1.5 text-xs font-bold uppercase text-foreground">
              <MapPin className="size-3.5 text-primary" />
              <span>Điểm đến</span> <span className="text-destructive">*</span>
            </label>
            <Input
              id="manual-destination"
              placeholder="TP. Hồ Chí Minh, Đà Lạt, Hà Nội..."
              {...register("destination")}
              aria-invalid={Boolean(errors.destination)}
              aria-describedby="manual-destination-error"
              className="h-11 rounded-xl text-sm"
            />
            <p id="manual-destination-error" className="min-h-5 text-xs text-destructive">
              {errors.destination?.message}
            </p>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="manual-startDate" className="flex items-center gap-1.5 text-xs font-bold uppercase text-foreground">
                <Calendar className="size-3.5 text-primary" />
                <span>Ngày bắt đầu</span> <span className="text-destructive">*</span>
              </label>
              <Input
                id="manual-startDate"
                type="date"
                {...register("startDate")}
                aria-invalid={Boolean(errors.startDate)}
                aria-describedby="manual-startDate-error"
                className="h-11 rounded-xl text-sm"
              />
              <p id="manual-startDate-error" className="min-h-5 text-xs text-destructive">
                {errors.startDate?.message}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="manual-endDate" className="flex items-center gap-1.5 text-xs font-bold uppercase text-foreground">
                <Calendar className="size-3.5 text-primary" />
                <span>Ngày kết thúc</span> <span className="text-destructive">*</span>
              </label>
              <Input
                id="manual-endDate"
                type="date"
                {...register("endDate")}
                aria-invalid={Boolean(errors.endDate)}
                aria-describedby="manual-endDate-error"
                className="h-11 rounded-xl text-sm"
              />
              <p id="manual-endDate-error" className="min-h-5 text-xs text-destructive">
                {errors.endDate?.message}
              </p>
            </div>
          </div>

          {/* People and Budget row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="manual-people" className="flex items-center gap-1.5 text-xs font-bold uppercase text-foreground">
                <Users className="size-3.5 text-primary" />
                <span>Số người</span> <span className="text-destructive">*</span>
              </label>
              <Input
                id="manual-people"
                type="number"
                min={1}
                max={50}
                {...register("people", { valueAsNumber: true })}
                aria-invalid={Boolean(errors.people)}
                aria-describedby="manual-people-error"
                className="h-11 rounded-xl text-sm"
              />
              <p id="manual-people-error" className="min-h-5 text-xs text-destructive">
                {errors.people?.message}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="manual-budget" className="flex items-center gap-1.5 text-xs font-bold uppercase text-foreground">
                <DollarSign className="size-3.5 text-primary" />
                <span>Ngân sách dự kiến (VND)</span>
              </label>
              <Input
                id="manual-budget"
                type="number"
                min={0}
                step={500000}
                {...register("budget", { valueAsNumber: true })}
                aria-invalid={Boolean(errors.budget)}
                aria-describedby="manual-budget-error"
                className="h-11 rounded-xl text-sm"
              />
              <p id="manual-budget-error" className="min-h-5 text-xs text-destructive">
                {errors.budget?.message}
              </p>
            </div>
          </div>
        </div>

        {/* Ordered Three-step guide */}
        <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-2.5">
          <p className="text-xs font-bold uppercase text-foreground">
            Quy trình tạo lịch trình
          </p>
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2 font-medium text-foreground">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <FilePlus2 aria-hidden="true" className="size-3.5" />
              </span>
              <span>1. Tạo chuyến đi</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                <MapPinPlus aria-hidden="true" className="size-3.5" />
              </span>
              <span>2. Chọn địa điểm</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                <ListOrdered aria-hidden="true" className="size-3.5" />
              </span>
              <span>3. Sắp xếp lịch trình</span>
            </li>
          </ol>
        </div>

        {/* Submit action */}
        <Button
          type="submit"
          disabled={createManual.isPending}
          className="h-12 w-full rounded-xl font-bold text-sm bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all cursor-pointer"
        >
          {createManual.isPending ? "Đang tạo chuyến đi…" : "Tạo chuyến đi trống"}
        </Button>
      </div>
    </form>
  );
}

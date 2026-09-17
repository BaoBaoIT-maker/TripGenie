"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { Planner } from "@/types/planner";
import { Input } from "@/components/ui/input";

const SAMPLE_COVERS = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1528127269322-539801943592?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1000&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1000&auto=format&fit=crop&q=80",
];

const tripDetailsSchema = z
  .object({
    title: z.string().trim().min(1, "Vui lòng nhập tên chuyến đi"),
    destination: z.string().trim().min(1, "Vui lòng nhập điểm đến"),
    description: z.string().optional(),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc"),
    people: z.number({ message: "Vui lòng nhập số" }).min(1, "Số người tối thiểu là 1"),
    budget: z.number({ message: "Vui lòng nhập số" }).min(0, "Ngân sách không được âm"),
    style: z.string().optional(),
    coverImage: z.string().optional(),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    {
      message: "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu",
      path: ["endDate"],
    }
  );

type TripDetailsFormData = z.infer<typeof tripDetailsSchema>;

interface TripDetailsEditorProps {
  planner: Planner;
  onPatch: (partial: Partial<Planner>) => void;
}

export function TripDetailsEditor({ planner, onPatch }: TripDetailsEditorProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useForm<TripDetailsFormData>({
    resolver: zodResolver(tripDetailsSchema),
    defaultValues: {
      title: planner.title || "",
      destination: planner.destination || "",
      description: planner.description || "",
      startDate: planner.startDate || "",
      endDate: planner.endDate || "",
      people: planner.people || 2,
      budget: planner.budget || 0,
      style: planner.style || "",
      coverImage: planner.coverImage || SAMPLE_COVERS[0],
    },
    mode: "onChange",
  });

  const formValues = useWatch({ control });
  const coverImage = formValues.coverImage || SAMPLE_COVERS[0];

  useEffect(() => {
    if (formValues) {
      onPatch({
        title: formValues.title ?? "",
        destination: formValues.destination ?? "",
        description: formValues.description ?? "",
        startDate: formValues.startDate ?? "",
        endDate: formValues.endDate ?? "",
        people: Number(formValues.people) || 1,
        budget: Number(formValues.budget) || 0,
        style: formValues.style ?? "",
        coverImage: formValues.coverImage ?? SAMPLE_COVERS[0],
      });
    }
  }, [formValues, onPatch]);

  const handleCycleCover = () => {
    const currentIdx = SAMPLE_COVERS.indexOf(coverImage);
    const nextIdx = (currentIdx + 1) % SAMPLE_COVERS.length;
    const nextCover = SAMPLE_COVERS[nextIdx];
    setValue("coverImage", nextCover, { shouldDirty: true });
    onPatch({ coverImage: nextCover });
  };

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-7 space-y-6 shadow-xs">
      {/* Cover Image */}
      <div className="space-y-2">
        <div className="relative aspect-[16/8] sm:aspect-[16/6] w-full overflow-hidden rounded-2xl border border-border/80 bg-muted/30 group">
          <Image
            src={coverImage}
            alt="Ảnh bìa chuyến đi"
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/25 transition-opacity group-hover:bg-black/40" />
          <button
            type="button"
            onClick={handleCycleCover}
            className="absolute bottom-3 right-3 rounded-xl bg-background/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-md backdrop-blur-md hover:bg-background transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ImageIcon className="size-3.5 text-primary" />
            <span>Đổi ảnh bìa</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-1">
          <label
            htmlFor="trip-title"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Tên chuyến đi
          </label>
          <Input
            id="trip-title"
            {...register("title")}
            placeholder="Nhập tên chuyến đi..."
            className="h-12 text-base font-bold rounded-xl"
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label
            htmlFor="trip-description"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Mô tả chuyến đi
          </label>
          <textarea
            id="trip-description"
            rows={2}
            {...register("description")}
            placeholder="Mô tả tóm tắt cho chuyến đi..."
            className="w-full rounded-xl border border-border/80 bg-card p-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground resize-none"
          />
        </div>

        {/* Destination & Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label
              htmlFor="trip-destination"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Điểm đến
            </label>
            <Input
              id="trip-destination"
              {...register("destination")}
              placeholder="VD: Đà Lạt, TP.HCM..."
              className="h-10 rounded-xl text-sm font-medium"
            />
            {errors.destination && (
              <p className="text-xs text-destructive">{errors.destination.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="trip-style"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Phong cách chuyến đi
            </label>
            <Input
              id="trip-style"
              {...register("style")}
              placeholder="VD: Khám phá & Ẩm thực..."
              className="h-10 rounded-xl text-sm font-medium"
            />
          </div>
        </div>

        {/* Dates & Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label
              htmlFor="trip-start-date"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Ngày bắt đầu
            </label>
            <Input
              id="trip-start-date"
              type="date"
              {...register("startDate")}
              className="h-10 rounded-xl text-xs font-medium"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="trip-end-date"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Ngày kết thúc
            </label>
            <Input
              id="trip-end-date"
              type="date"
              {...register("endDate")}
              className="h-10 rounded-xl text-xs font-medium"
            />
            {errors.endDate && (
              <p className="text-xs text-destructive">{errors.endDate.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="trip-people"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Số người
            </label>
            <Input
              id="trip-people"
              type="number"
              min={1}
              {...register("people", { valueAsNumber: true })}
              className="h-10 rounded-xl text-xs font-medium"
            />
            {errors.people && (
              <p className="text-xs text-destructive">{errors.people.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="trip-budget"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Ngân sách dự kiến (đ)
            </label>
            <Input
              id="trip-budget"
              type="number"
              min={0}
              step={100000}
              {...register("budget", { valueAsNumber: true })}
              className="h-10 rounded-xl text-xs font-medium"
            />
            {errors.budget && (
              <p className="text-xs text-destructive">{errors.budget.message}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

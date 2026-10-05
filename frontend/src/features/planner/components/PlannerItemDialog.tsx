"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlannerItem } from "@/types/planner";
import { Place } from "@/types/place";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const plannerItemSchema = z.object({
  startTime: z.string().min(1, "Vui lòng nhập giờ bắt đầu"),
  endTime: z.string().optional(),
  durationMinutes: z.number({ message: "Vui lòng nhập số" }).min(0, "Thời lượng không được âm"),
  estimatedCost: z.number({ message: "Vui lòng nhập số" }).min(0, "Chi phí không được âm"),
  note: z.string().optional(),
});

type PlannerItemFormData = z.infer<typeof plannerItemSchema>;

function generateItemId(dayNumber: number): string {
  return `item-${dayNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

interface PlannerItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PlannerItem | null;
  place?: Place | null;
  dayNumber: number;
  onSave: (savedItem: PlannerItem) => void;
}

export function PlannerItemDialog({
  open,
  onOpenChange,
  item,
  place,
  dayNumber,
  onSave,
}: PlannerItemDialogProps) {
  const isEditing = Boolean(item);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlannerItemFormData>({
    resolver: zodResolver(plannerItemSchema),
    defaultValues: {
      startTime: "09:00",
      endTime: "10:30",
      durationMinutes: 90,
      estimatedCost: 100000,
      note: "",
    },
  });

  useEffect(() => {
    if (item) {
      reset({
        startTime: item.startTime || "09:00",
        endTime: item.endTime || "",
        durationMinutes: item.durationMinutes || 90,
        estimatedCost: item.estimatedCost || 0,
        note: item.note || "",
      });
    } else {
      reset({
        startTime: "09:00",
        endTime: "10:30",
        durationMinutes: 90,
        estimatedCost: 100000,
        note: "",
      });
    }
  }, [item, reset, open]);

  const onSubmit = (data: PlannerItemFormData) => {
    const currentPlace = item?.place || place;
    if (!currentPlace) return;

    const resultItem: PlannerItem = {
      id: item?.id || generateItemId(dayNumber),
      placeId: currentPlace.id,
      place: currentPlace,
      startTime: data.startTime,
      endTime: data.endTime || undefined,
      durationMinutes: Number(data.durationMinutes) || 0,
      estimatedCost: Number(data.estimatedCost) || 0,
      note: data.note || undefined,
      order: item?.order || 999,
    };

    onSave(resultItem);
    onOpenChange(false);
  };

  const activePlaceName = item?.place?.name || place?.name || "Điểm đến";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Chỉnh sửa điểm dừng" : "Thêm điểm dừng mới"}
          </DialogTitle>
          <DialogDescription>
            {activePlaceName} — Ngày {dayNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="stop-start-time"
                className="text-xs font-bold text-muted-foreground"
              >
                Thời gian bắt đầu
              </label>
              <Input
                id="stop-start-time"
                {...register("startTime")}
                placeholder="08:30"
                className="h-10 text-xs rounded-xl"
              />
              {errors.startTime && (
                <p className="text-xs text-destructive">{errors.startTime.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="stop-end-time"
                className="text-xs font-bold text-muted-foreground"
              >
                Thời gian kết thúc
              </label>
              <Input
                id="stop-end-time"
                {...register("endTime")}
                placeholder="10:00"
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="stop-duration"
                className="text-xs font-bold text-muted-foreground"
              >
                Thời lượng (phút)
              </label>
              <Input
                id="stop-duration"
                type="number"
                min={0}
                {...register("durationMinutes", { valueAsNumber: true })}
                className="h-10 text-xs rounded-xl"
              />
              {errors.durationMinutes && (
                <p className="text-xs text-destructive">
                  {errors.durationMinutes.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="stop-cost"
                className="text-xs font-bold text-muted-foreground"
              >
                Chi phí ước tính (đ)
              </label>
              <Input
                id="stop-cost"
                type="number"
                min={0}
                step={10000}
                {...register("estimatedCost", { valueAsNumber: true })}
                className="h-10 text-xs rounded-xl"
              />
              {errors.estimatedCost && (
                <p className="text-xs text-destructive">
                  {errors.estimatedCost.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="stop-note"
              className="text-xs font-bold text-muted-foreground"
            >
              Ghi chú
            </label>
            <textarea
              id="stop-note"
              rows={2}
              {...register("note")}
              placeholder="Ghi chú chi tiết cho điểm dừng này..."
              className="w-full rounded-xl border border-border/80 bg-card p-3 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground resize-none"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="text-xs rounded-xl font-bold bg-primary text-primary-foreground"
            >
              {isEditing ? "Cập nhật điểm dừng" : "Thêm vào lịch trình"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

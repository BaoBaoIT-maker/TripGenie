"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { GripVertical, Clock, DollarSign, Edit3, Trash2 } from "lucide-react";
import { PlannerItem } from "@/types/planner";
import { Button } from "@/components/ui/button";

interface SortablePlannerItemProps {
  item: PlannerItem;
  dayNumber: number;
  onEdit: (item: PlannerItem) => void;
  onDelete: (item: PlannerItem) => void;
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

export function SortablePlannerItem({
  item,
  dayNumber,
  onEdit,
  onDelete,
}: SortablePlannerItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      day: dayNumber,
      item,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 transition-all shadow-xs hover:border-border hover:shadow-sm ${
        isDragging ? "ring-2 ring-primary shadow-lg" : ""
      }`}
    >
      {/* Drag handle & Ordinal */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Kéo để đổi thứ tự"
          className="touch-none cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        >
          <GripVertical className="size-5" />
        </button>

        <span className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
          #{item.order}
        </span>
      </div>

      {/* Place Image */}
      <div className="relative size-16 sm:size-18 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted/40">
        {item.place?.coverImage ? (
          <Image
            src={item.place.coverImage}
            alt={item.place.name || "Địa điểm"}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Ảnh
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-bold text-foreground truncate">
            {item.place?.name}
          </h4>
        </div>

        <p className="text-xs text-muted-foreground truncate">
          {item.place?.address || item.place?.city}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Clock className="size-3 text-primary" />
            {item.startTime}
            {item.endTime ? ` - ${item.endTime}` : ""}
            <span className="text-muted-foreground">({item.durationMinutes} phút)</span>
          </span>

          <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
            <DollarSign className="size-3" />
            {formatVnd(item.estimatedCost)}
          </span>
        </div>

        {item.note && (
          <p className="text-xs italic text-muted-foreground/90 pt-0.5">
            &ldquo;{item.note}&rdquo;
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Chỉnh sửa điểm dừng"
          onClick={() => onEdit(item)}
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <Edit3 className="size-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Xóa điểm dừng"
          onClick={() => onDelete(item)}
          className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

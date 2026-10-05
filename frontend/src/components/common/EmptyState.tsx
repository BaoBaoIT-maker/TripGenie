import { ReactNode } from "react";
import { Compass, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  actionNode?: ReactNode;
  className?: string;
}

export function EmptyState({
  title = "Không tìm thấy dữ liệu",
  description = "Chưa có địa điểm hoặc mục nào trong danh sách này. Hãy thử thay đổi bộ lọc hoặc tìm kiếm lại.",
  icon: Icon = Compass,
  actionLabel,
  onAction,
  actionNode,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
        <Icon className="size-7 stroke-[1.75]" />
      </div>
      <h3 className="text-lg font-semibold text-foreground tracking-tight">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-6" size="default">
          {actionLabel}
        </Button>
      )}

      {actionNode && <div className="mt-6">{actionNode}</div>}
    </div>
  );
}

import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  type?: "spinner" | "cards" | "text";
  message?: string;
  count?: number;
  className?: string;
}

export function LoadingState({
  type = "spinner",
  message = "Đang tải dữ liệu...",
  count = 3,
  className,
}: LoadingStateProps) {
  if (type === "cards") {
    return (
      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full",
          className
        )}
      >
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col space-y-3 rounded-xl border border-border bg-card p-4 shadow-xs"
          >
            <Skeleton className="h-48 w-full rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "text") {
    return (
      <div className={cn("space-y-2 w-full", className)}>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center",
        className
      )}
    >
      <Loader2 className="size-8 animate-spin text-primary mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

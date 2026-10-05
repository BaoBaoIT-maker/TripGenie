import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Đã xảy ra lỗi",
  message = "Không thể tải dữ liệu vào lúc này. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-12 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
        <AlertTriangle className="size-7 stroke-[1.75]" />
      </div>
      <h3 className="text-lg font-semibold text-foreground tracking-tight">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">
        {message}
      </p>

      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="mt-6 gap-2 border-destructive/30 hover:bg-destructive/10 text-destructive"
        >
          <RefreshCw className="size-4" />
          Thử lại
        </Button>
      )}
    </div>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  viewAllHref,
  viewAllLabel = "Xem tất cả",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 mb-5",
        className
      )}
    >
      <div className="space-y-1">
        {badge && (
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#0194F3]">
            {badge}
          </span>
        )}
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#10243A]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0194F3] hover:text-[#0084DE] transition-colors shrink-0 group self-start sm:self-auto"
        >
          <span>{viewAllLabel}</span>
          <i
            className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}

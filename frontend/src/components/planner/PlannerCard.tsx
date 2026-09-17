import Link from "next/link";
import Image from "next/image";
import { MapPin, Users, DollarSign, Sparkles } from "lucide-react";
import { Planner } from "@/types/planner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlannerCardProps {
  planner: Planner;
  className?: string;
  editHref?: string;
}

export function PlannerCard({ planner, className, editHref }: PlannerCardProps) {
  return (
    <div className={cn("group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md", className)}>
      {/* Cover Image */}
      <Link
        href={`/planner/${planner.id}`}
        className="relative block h-44 sm:h-48 w-full overflow-hidden bg-muted"
      >
        <Image
          src={planner.coverImage}
          alt={planner.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <Badge className="bg-primary text-primary-foreground text-[11px] font-bold py-0.5 px-2 shadow-xs">
            {planner.durationText}
          </Badge>
          {planner.matchScore && (
            <Badge className="bg-background/90 text-foreground backdrop-blur-md text-[11px] font-semibold gap-1">
              <Sparkles className="size-3 text-primary" />
              <span>{planner.matchScore}% Match</span>
            </Badge>
          )}
        </div>

        {/* Bottom Destination */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5 text-white text-xs font-semibold drop-shadow-sm">
          <MapPin className="size-3.5 text-primary shrink-0" />
          <span className="truncate">{planner.destination}</span>
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 justify-between space-y-3">
        <div className="space-y-1.5">
          {planner.authorName && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-0.5 font-semibold text-foreground truncate max-w-full">
                {planner.authorName}
              </span>
            </div>
          )}
          <Link href={`/planner/${planner.id}`}>
            <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 font-heading leading-snug">
              {planner.title}
            </h3>
          </Link>
          {planner.summaryRoute && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              📍 {planner.summaryRoute}
            </p>
          )}
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-border/70 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-primary shrink-0" />
            <span className="text-[11px]">{planner.people} người</span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="size-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-foreground text-[11px]">
              {planner.estimatedTotalCost.toLocaleString()}đ
            </span>
          </div>
        </div>

        {/* CTA */}
        {editHref ? (
          <div className="flex items-center gap-2 pt-1">
            <Link href={`/planner/${planner.id}`} className="flex-1">
              <Button
                variant="outline"
                className="w-full text-xs font-semibold rounded-xl h-8.5 hover:bg-muted transition-colors"
              >
                Xem chi tiết
              </Button>
            </Link>
            <Link href={editHref} className="flex-1">
              <Button className="w-full text-xs font-bold rounded-xl h-8.5 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors">
                Chỉnh sửa
              </Button>
            </Link>
          </div>
        ) : (
          <Link href={`/planner/${planner.id}`} className="w-full pt-1">
            <Button
              variant="outline"
              className="w-full text-xs font-semibold rounded-xl h-8.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            >
              Xem chi tiết →
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

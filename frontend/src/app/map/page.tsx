import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { MapExplorer } from "@/features/map/MapExplorer";

export const metadata: Metadata = {
  title: "Bản đồ địa điểm gần bạn | TripTailor",
  description: "Khám phá địa điểm theo vị trí và bán kính trên bản đồ TripTailor.",
};

export default function MapPage() {
  return (
    <div className="max-w-[1536px] mx-auto w-full space-y-6 px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Bản đồ địa điểm
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Khám phá các điểm đến và trải nghiệm quanh bạn.
        </p>
      </header>
      <Suspense
        fallback={
          <Skeleton
            className="h-[640px] w-full rounded-2xl"
            aria-label="Đang chuẩn bị bản đồ"
          />
        }
      >
        <MapExplorer />
      </Suspense>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { VietMapProps } from "@/features/map/types";
import { Skeleton } from "@/components/ui/skeleton";

const DynamicVietMap = dynamic(() => import("./VietMap"), {
  ssr: false,
  loading: () => (
    <Skeleton
      className="h-[430px] w-full rounded-2xl md:h-[520px]"
      aria-label="Đang tải bản đồ"
    />
  ),
});

export function VietMapLoader(props: VietMapProps) {
  return <DynamicVietMap {...props} />;
}

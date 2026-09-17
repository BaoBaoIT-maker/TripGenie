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
  if (!process.env.NEXT_PUBLIC_VIETMAP_API_KEY) {
    return (
      <div
        role="status"
        className="flex h-[430px] items-center justify-center rounded-2xl border bg-muted/30 p-6 text-center md:h-[520px]"
      >
        Chưa cấu hình khóa VietMap. Danh sách địa điểm vẫn có thể sử dụng.
      </div>
    );
  }
  return <DynamicVietMap {...props} />;
}

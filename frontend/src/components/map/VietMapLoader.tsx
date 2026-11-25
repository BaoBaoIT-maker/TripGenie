"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import type { VietMapProps } from "@/features/map/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";

function MapLoadingSkeleton() {
  const { t } = useI18n();
  return (
    <Skeleton
      className="h-[430px] w-full rounded-2xl md:h-[520px]"
      aria-label={t("map.loadingAria")}
    />
  );
}

const DynamicVietMap = dynamic(() => import("./VietMap"), {
  ssr: false,
  loading: () => <MapLoadingSkeleton />,
});

export const VietMapLoader = memo(function VietMapLoader(props: VietMapProps) {
  return <DynamicVietMap {...props} />;
});

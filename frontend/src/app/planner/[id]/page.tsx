import { Suspense } from "react";
import { LoadingState } from "@/components/common/LoadingState";
import { PlannerPreview } from "@/features/planner/components/PlannerPreview";

interface PlannerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlannerDetailPage({ params }: PlannerDetailPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingState message="Đang tải kế hoạch chuyến đi..." />}>
      <PlannerPreview plannerId={id} />
    </Suspense>
  );
}

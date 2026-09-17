import { Suspense } from "react";
import { PlannerEditor } from "@/features/planner/components/PlannerEditor";
import { LoadingState } from "@/components/common/LoadingState";

interface PlannerEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlannerEditPage({ params }: PlannerEditPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingState message="Đang mở trình chỉnh sửa..." />}>
      <PlannerEditor plannerId={id} />
    </Suspense>
  );
}

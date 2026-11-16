import { redirect } from 'next/navigation';

interface PlannerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlannerDetailPage({ params }: PlannerDetailPageProps) {
  const { id } = await params;
  redirect(`/itineraries/${id}`);
}

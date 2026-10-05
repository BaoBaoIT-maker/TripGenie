import ItineraryView from '@/features/planner/components/itinerary/ItineraryView';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ItineraryDetailPage({ params }: Props) {
  const { id } = await params;
  return <ItineraryView id={id} />;
}

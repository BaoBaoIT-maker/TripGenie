import { use } from 'react';
import { TripInvitationContent } from '@/features/planner/components/companions/TripInvitationContent';

interface TripInvitationPageProps {
  params: Promise<{ id: string }>;
}

export default function TripInvitationPage({ params }: TripInvitationPageProps) {
  const resolvedParams = use(params);
  const invitationId = decodeURIComponent(resolvedParams.id || '');

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <TripInvitationContent invitationId={invitationId} />
    </main>
  );
}

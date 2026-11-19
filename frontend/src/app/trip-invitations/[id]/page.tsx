import type { Metadata } from 'next';
import { TripInvitationContent } from '@/features/planner/components/companions/TripInvitationContent';

interface TripInvitationPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Lời mời tham gia chuyến đi',
  description: 'Bạn vừa nhận được lời mời tham gia cùng lên kế hoạch và trải nghiệm chuyến đi trên TripGenie.',
  openGraph: {
    title: 'Lời mời tham gia chuyến đi | TripGenie',
    description: 'Bạn vừa nhận được lời mời tham gia cùng lên kế hoạch và trải nghiệm chuyến đi trên TripGenie.',
    type: 'website',
    images: [
      {
        url: '/images/curated/da-nang.jpg',
        width: 1200,
        height: 630,
        alt: 'Lời mời đồng hành TripGenie',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lời mời tham gia chuyến đi | TripGenie',
    description: 'Bạn vừa nhận được lời mời tham gia cùng lên kế hoạch và trải nghiệm chuyến đi trên TripGenie.',
    images: ['/images/curated/da-nang.jpg'],
  },
};

export default async function TripInvitationPage({ params }: TripInvitationPageProps) {
  const { id } = await params;
  const invitationId = decodeURIComponent(id || '');

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <TripInvitationContent invitationId={invitationId} />
    </main>
  );
}

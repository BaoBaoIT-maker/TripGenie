import type { Metadata } from 'next';
import ItineraryView from '@/features/planner/components/itinerary/ItineraryView';
import { itineraryService } from '@/services/itinerary-planner.service';
import { getDestinationCover } from '@/features/planner/constants/itinerary.constants';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const itinerary = await itineraryService.getItinerary(id);
    if (!itinerary) {
      return {
        title: 'Chi tiết lịch trình',
      };
    }

    const destinationText = itinerary.destination ? ` tại ${itinerary.destination}` : '';
    const durationText = itinerary.totalDays ? ` (${itinerary.totalDays} ngày)` : '';
    const description =
      itinerary.description ||
      `Khám phá lịch trình du lịch${destinationText}${durationText} thông minh cùng TripGenie. Tự động tối ưu hoá lộ trình và thời gian di chuyển.`;

    const firstPlaceImage = itinerary.days
      ?.flatMap((d) => d.activities || [])
      ?.find((a) => Boolean(a.imageUrl))?.imageUrl;

    const imageUrl =
      itinerary.coverPhoto ||
      firstPlaceImage ||
      getDestinationCover(itinerary.destination);

    return {
      title: itinerary.title,
      description,
      openGraph: {
        title: `${itinerary.title} | TripGenie`,
        description,
        type: 'article',
        url: `/itineraries/${id}`,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: itinerary.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${itinerary.title} | TripGenie`,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return {
      title: 'Lịch trình du lịch',
      description: 'Lên kế hoạch du lịch thông minh, tối ưu lộ trình và ngân sách cùng TripGenie.',
    };
  }
}

export default async function ItineraryDetailPage({ params }: Props) {
  const { id } = await params;
  return <ItineraryView id={id} />;
}

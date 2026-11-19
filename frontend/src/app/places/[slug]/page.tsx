import type { Metadata } from 'next';
import { placeService } from '@/services/place.service';
import PlaceDetailClient from './PlaceDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const place = await placeService.getPlaceBySlug(slug);
    if (!place) {
      return {
        title: 'Chi tiết địa điểm',
      };
    }

    const placeTitle = `${place.name} - ${place.city}`;
    const description =
      place.tagline ||
      (place.description ? place.description.slice(0, 160) : '') ||
      `Khám phá ${place.name} tại ${place.city} với lịch trình gợi ý, thông tin giá vé và mẹo du lịch hữu ích trên TripGenie.`;

    const imageUrl =
      place.coverImage ||
      place.images?.[0] ||
      '/images/curated/da-nang.jpg';

    return {
      title: placeTitle,
      description,
      openGraph: {
        title: `${placeTitle} | TripGenie`,
        description,
        type: 'article',
        url: `/places/${slug}`,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: place.name,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${placeTitle} | TripGenie`,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return {
      title: 'Địa điểm du lịch',
      description: 'Khám phá các điểm đến du lịch tuyệt vời tại Việt Nam cùng TripGenie.',
    };
  }
}

export default async function PlaceDetailPage({ params }: Props) {
  return <PlaceDetailClient params={params} />;
}

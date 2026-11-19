import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bộ sưu tập địa điểm du lịch',
  description: 'Khám phá và lưu lại những địa điểm du lịch yêu thích của bạn và cộng đồng trên TripGenie.',
  openGraph: {
    title: 'Bộ sưu tập địa điểm du lịch | TripGenie',
    description: 'Khám phá và lưu lại những địa điểm du lịch yêu thích của bạn và cộng đồng trên TripGenie.',
    type: 'website',
    url: '/collections',
    images: [
      {
        url: '/images/curated/da-nang.jpg',
        width: 1200,
        height: 630,
        alt: 'Bộ sưu tập du lịch TripGenie',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bộ sưu tập địa điểm du lịch | TripGenie',
    description: 'Khám phá và lưu lại những địa điểm du lịch yêu thích của bạn và cộng đồng trên TripGenie.',
    images: ['/images/curated/da-nang.jpg'],
  },
};

export default function CollectionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

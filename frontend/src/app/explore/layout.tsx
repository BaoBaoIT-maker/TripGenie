import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Khám phá địa điểm du lịch',
  description: 'Khám phá hàng ngàn điểm đến, danh lam thắng cảnh, ẩm thực và văn hoá đặc sắc trên khắp Việt Nam với bản đồ tương tác.',
  openGraph: {
    title: 'Khám phá địa điểm du lịch | TripGenie',
    description: 'Khám phá hàng ngàn điểm đến, danh lam thắng cảnh, ẩm thực và văn hoá đặc sắc trên khắp Việt Nam với bản đồ tương tác.',
    type: 'website',
    url: '/explore',
    images: [
      {
        url: '/images/curated/da-nang.jpg',
        width: 1200,
        height: 630,
        alt: 'Khám phá điểm đến du lịch Việt Nam',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Khám phá địa điểm du lịch | TripGenie',
    description: 'Khám phá hàng ngàn điểm đến, danh lam thắng cảnh, ẩm thực và văn hoá đặc sắc trên khắp Việt Nam với bản đồ tương tác.',
    images: ['/images/curated/da-nang.jpg'],
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

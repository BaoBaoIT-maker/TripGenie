import type { Metadata } from "next";
import { Inter, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Providers } from "./providers";
import { SiteChrome } from "@/components/common/SiteChrome";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tripgenie-vn.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "TripGenie — Nền tảng Du lịch Thông minh Việt Nam",
    template: "%s | TripGenie",
  },
  description:
    "Hệ thống khám phá địa điểm du lịch và tự động tối ưu hóa lộ trình trải nghiệm cá nhân hóa cùng AI.",
  keywords: [
    "TripGenie",
    "du lịch Việt Nam",
    "lập kế hoạch du lịch",
    "AI du lịch",
    "tạo lịch trình tự động",
    "Đà Lạt",
    "Đà Nẵng",
    "Phú Quốc",
    "Hội An",
    "Sa Pa",
  ],
  authors: [{ name: "TripGenie Team" }],
  creator: "TripGenie",
  publisher: "TripGenie",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: { url: "/images/logo_transparent.png", type: "image/png" },
    shortcut: "/images/logo_transparent.png",
    apple: "/images/logo_transparent.png",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: APP_URL,
    siteName: "TripGenie Vietnam",
    title: "TripGenie — Nền tảng Du lịch Thông minh Việt Nam",
    description:
      "Tự động sắp xếp lịch trình chi tiết từng giờ, tính toán chi phí minh bạch và đồng bộ thời gian thực cùng hội bạn thân.",
    images: [
      {
        url: "/images/curated/da-nang.jpg",
        width: 1200,
        height: 630,
        alt: "TripGenie Vietnam - Nền tảng Du lịch Thông minh",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TripGenie — Nền tảng Du lịch Thông minh Việt Nam",
    description:
      "Tự động sắp xếp lịch trình chi tiết từng giờ, tính toán chi phí minh bạch và đồng bộ thời gian thực cùng hội bạn thân.",
    images: ["/images/curated/da-nang.jpg"],
    creator: "@tripgenie_vn",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      data-scroll-behavior="smooth"
      className={`scroll-smooth ${inter.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <Providers>
          <SiteChrome>{children}</SiteChrome>
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}

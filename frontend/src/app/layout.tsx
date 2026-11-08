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

export const metadata: Metadata = {
  title: "TripGenie - Khám phá và lập kế hoạch du lịch cá nhân hóa",
  description: "Hệ thống khám phá địa điểm du lịch và hỗ trợ lập kế hoạch trải nghiệm cá nhân hóa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
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

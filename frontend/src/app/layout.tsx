import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Providers } from "./providers";
import { SiteChrome } from "@/components/common/SiteChrome";
import { Toaster } from "@/components/ui/sonner";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_METADATA,
  parseLocale,
  type Locale,
} from "@/i18n/config";
import { getMessages } from "@/i18n/core";

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

async function resolveServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const { meta } = getMessages(locale);

  return {
    metadataBase: new URL(APP_URL),
    title: {
      default: meta.siteTitle,
      template: "%s | TripGenie",
    },
    description: meta.siteDescription,
    keywords: [
      "TripGenie",
      "du lịch Việt Nam",
      "Vietnam travel",
      "lập kế hoạch du lịch",
      "AI travel planner",
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
      locale: LOCALE_METADATA[locale].ogLocale,
      url: APP_URL,
      siteName: "TripGenie Vietnam",
      title: meta.siteTitle,
      description: meta.ogDescription,
      images: [
        {
          url: "/images/curated/da-nang.jpg",
          width: 1200,
          height: 630,
          alt: meta.siteTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.siteTitle,
      description: meta.ogDescription,
      images: ["/images/curated/da-nang.jpg"],
      creator: "@tripgenie_vn",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = await resolveServerLocale();

  return (
    <html
      lang={initialLocale}
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
        <Providers initialLocale={initialLocale}>
          <SiteChrome>{children}</SiteChrome>
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}

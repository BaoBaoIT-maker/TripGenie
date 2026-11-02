'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { BottomNav } from '@/components/common/BottomNav';
import { AdvisorWidget } from '@/features/advisor/components/AdvisorWidget';

const AUTH_EXACT_ROUTES = new Set([
  '/login',
  '/register',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
]);
const AUTH_PREFIX = '/auth/';
const ITINERARY_DETAIL_PATTERN = /^\/itineraries\/[^/]+/;

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';

  const isAuthPage =
    AUTH_EXACT_ROUTES.has(pathname) || pathname.startsWith(AUTH_PREFIX);
  const isItineraryCopilotPage = ITINERARY_DETAIL_PATTERN.test(pathname);

  if (isAuthPage) {
    return (
      <main className="flex-1 w-full flex flex-col min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <>
      <div className="print:hidden">
        <Navbar />
      </div>
      <main className="flex-1 w-full">{children}</main>
      <div className="print:hidden">
        <Footer />
        {!isItineraryCopilotPage && <AdvisorWidget />}
        <BottomNav />
      </div>
    </>
  );
}

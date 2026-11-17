'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { AdvisorWidget } from '@/features/advisor/components/AdvisorWidget';
import { useAuth } from '@/features/auth/hooks/use-auth';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(
  () => import('@/features/auth/components/AuthModal').then((mod) => mod.AuthModal),
  { ssr: false }
);

const AUTH_EXACT_ROUTES = new Set([
  '/login',
  '/register',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
]);
const AUTH_PREFIX = '/auth/';
const ADMIN_PREFIX = '/admin';
const ITINERARY_DETAIL_PATTERN = /^\/itineraries\/[^/]+/;

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const isAuthPage =
    AUTH_EXACT_ROUTES.has(pathname) || pathname.startsWith(AUTH_PREFIX);
  const isAdminPage =
    pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  const isItineraryCopilotPage = ITINERARY_DETAIL_PATTERN.test(pathname);
  const isLandingPage = pathname === '/';
  const isFullViewportDesktopPage =
    pathname === '/explore' || pathname === '/community';

  React.useEffect(() => {
    if (!isLoading && user?.role === 'ADMIN' && !isAdminPage) {
      router.replace('/admin/dashboard');
    }
  }, [isLoading, user, isAdminPage, router]);

  if (isAuthPage || isAdminPage) {
    return (
      <main className="flex-1 w-full flex flex-col min-h-screen">
        {children}
      </main>
    );
  }

  if (isLandingPage) {
    return (
      <>
        <main className="flex-1 w-full">{children}</main>
        <div className="print:hidden">
          <AdvisorWidget />
        </div>
        <AuthModal />
      </>
    );
  }

  return (
    <>
      <div className="print:hidden">
        <Navbar />
      </div>
      <main className="flex-1 w-full">{children}</main>
      <div className="print:hidden">
        {isFullViewportDesktopPage ? (
          <div className="lg:hidden">
            <Footer />
          </div>
        ) : (
          <Footer />
        )}
        {!isItineraryCopilotPage && <AdvisorWidget />}
      </div>
      <AuthModal />
    </>
  );
}

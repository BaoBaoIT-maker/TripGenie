'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { BottomNav } from '@/components/common/BottomNav';

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/verify-otp' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname?.startsWith('/auth/');

  if (isAuthPage) {
    return (
      <main className="flex-1 w-full flex flex-col min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 w-full">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}

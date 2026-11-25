"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { UserAccountMenu } from "@/components/common/UserAccountMenu";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { MobileNavSheet } from "@/components/common/MobileNavSheet";
import { useAuthModalStore } from "@/features/auth/stores/auth-modal.store";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";

const NAV_LINKS: ReadonlyArray<{ href: string; labelKey: TranslationKey }> = [
  { href: "/explore", labelKey: "nav.explore" },
  { href: "/planner", labelKey: "nav.planner" },
  { href: "/community", labelKey: "nav.community" },
];

export function LandingNavbar() {
  const { user, isLoading } = useAuth();
  const { t } = useI18n();
  const openAuthModal = useAuthModalStore((state) => state.openAuthModal);

  return (
    <nav className="relative z-40 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center">
      {/* Brand Logo - Tràn viền trong suốt */}
      <div className="flex items-center justify-start">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/images/logo_transparent.png"
            alt="TripGenie Logo"
            width={48}
            height={48}
            style={{ width: "auto", height: "auto" }}
            className="h-11 sm:h-12 w-auto object-contain drop-shadow-md transition-transform group-hover:scale-105"
            priority
          />
          <div className="hidden sm:block">
            <span className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
              TripGenie
            </span>
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-slate-200 -mt-0.5">
              {t("common.brandTagline")}
            </span>
          </div>
        </Link>
      </div>

      {/* Nav links: Khám phá, Lịch trình, Cộng đồng - Cố định chính giữa tuyệt đối */}
      <div className="hidden md:flex items-center justify-center gap-8 text-sm font-bold text-white/95">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hover:text-[#38BDF8] transition-colors drop-shadow-xs"
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </div>

      {/* Action area: User controls when logged in, Auth buttons when logged out */}
      <div className="flex items-center justify-end gap-2 sm:gap-3">
        <LanguageSwitcher variant="transparent" className="hidden md:inline-flex" />

        {isLoading ? (
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <div className="hidden sm:block size-10 rounded-xl bg-white/10 animate-pulse" />
            <div className="size-9 sm:size-9.5 rounded-full bg-white/20 animate-pulse border border-white/20 shadow-xs" />
            <MobileNavSheet triggerVariant="transparent" />
          </div>
        ) : user ? (
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Nút Bộ sưu tập - Hiện trên tablet+ */}
            <Link href="/collections" className="hidden sm:inline-flex">
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-xl text-white/90 hover:text-white hover:bg-white/15 transition-all cursor-pointer shadow-xs drop-shadow-sm"
                title={t("nav.collections")}
              >
                <Bookmark className="size-5" />
              </Button>
            </Link>

            {/* Chuông thông báo */}
            <div className="[&>div>button]:text-white/90 [&>div>button:hover]:text-white [&>div>button:hover]:bg-white/15 [&>div>button]:drop-shadow-sm">
              <NotificationBell />
            </div>

            {/* Avatar người dùng dạng Dropdown Menu */}
            <UserAccountMenu variant="transparent" />

            {/* Mobile Navigation Drawer Trigger */}
            <MobileNavSheet triggerVariant="transparent" />
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-white hover:text-[#38BDF8] transition-colors cursor-pointer drop-shadow-xs"
            >
              {t("nav.signIn")}
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("register")}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#0194F3] hover:bg-[#0084DE] text-white transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98] cursor-pointer"
            >
              {t("nav.getStarted")}
            </button>

            {/* Mobile Navigation Drawer Trigger */}
            <MobileNavSheet triggerVariant="transparent" />
          </div>
        )}
      </div>
    </nav>
  );
}

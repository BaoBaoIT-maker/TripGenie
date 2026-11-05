"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DEFAULT_AVATAR } from "@/config/avatars";

const NAV_LINKS = [
  { href: "/explore", label: "Khám phá" },
  { href: "/planner", label: "Lịch trình" },
  { href: "/community", label: "Cộng đồng" },
];

function getUserInitials(fullName?: string | null): string {
  if (!fullName) return "TG";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function LandingNavbar() {
  const { user } = useAuth();
  const userInitials = getUserInitials(user?.fullName);

  return (
    <nav className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center">
      {/* Brand Logo - Tràn viền trong suốt */}
      <div className="flex items-center justify-start">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/images/logo_transparent.png"
            alt="TripGenie Logo"
            width={48}
            height={48}
            className="h-11 sm:h-12 w-auto object-contain drop-shadow-md transition-transform group-hover:scale-105"
            priority
          />
          <div className="hidden sm:block">
            <span className="text-xl font-black tracking-tight text-white drop-shadow-sm">
              TripGenie
            </span>
            <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-200 -mt-0.5">
              Nền Tảng Du Lịch Thông Minh
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
            {link.label}
          </Link>
        ))}
      </div>

      {/* Action area: User controls when logged in, Auth buttons when logged out */}
      <div className="flex items-center justify-end gap-3">
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Nút Bộ sưu tập */}
            <Link href="/collections">
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-xl text-white/90 hover:text-white hover:bg-white/15 transition-all cursor-pointer shadow-xs drop-shadow-sm"
                title="Bộ sưu tập"
              >
                <Bookmark className="size-5" />
              </Button>
            </Link>

            {/* Chuông thông báo */}
            <div className="[&>div>button]:text-white/90 [&>div>button:hover]:text-white [&>div>button:hover]:bg-white/15 [&>div>button]:drop-shadow-sm">
              <NotificationBell />
            </div>

            {/* Avatar người dùng */}
            <Link
              href="/profile"
              title={`Hồ sơ: ${user.fullName || "Người dùng"}`}
              className="outline-none group ml-1"
            >
              <Avatar className="size-9.5 border-2 border-white/60 transition-all group-hover:border-white group-hover:scale-105 cursor-pointer shadow-md">
                <AvatarImage
                  src={user.avatarUrl || DEFAULT_AVATAR}
                  alt={user.fullName || "Avatar"}
                />
                <AvatarFallback className="text-xs font-bold bg-white/25 text-white backdrop-blur-md">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-white hover:text-[#38BDF8] transition-colors cursor-pointer drop-shadow-xs"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0194F3] hover:bg-[#0073D1] text-white transition-all shadow-lg shadow-blue-500/30 cursor-pointer"
            >
              Bắt đầu miễn phí
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

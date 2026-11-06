"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { cn } from "@/lib/utils";
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

export function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const userInitials = getUserInitials(user?.fullName);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all shadow-2xs">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center">
        {/* Cột 1: Brand Logo - Đồng bộ 100% nhận diện với Trang chủ */}
        <div className="flex items-center justify-start">
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/images/logo_transparent.png"
              alt="TripGenie Logo"
              width={48}
              height={48}
              className="h-10 sm:h-11 w-auto object-contain drop-shadow-xs transition-transform group-hover:scale-105"
              priority
            />
            <div className="hidden sm:block">
              <span className="text-xl font-black tracking-tight text-slate-900 drop-shadow-xs">
                TripGenie
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 -mt-0.5">
                Nền Tảng Du Lịch Thông Minh
              </span>
            </div>
          </Link>
        </div>

        {/* Cột 2: Cụm link menu KHÓA CHẶT CHÍNH GIỮA 50% */}
        <nav className="hidden md:flex items-center justify-center gap-1.5 lg:gap-2">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-sm transition-all",
                  isActive
                    ? "bg-sky-50 text-[#0194F3] font-bold shadow-2xs"
                    : "text-slate-600 hover:text-[#0194F3] font-semibold hover:bg-slate-50"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Cột 3: User controls / Auth actions căn sát lề phải */}
        <div className="flex items-center justify-end gap-2.5 sm:gap-3">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Nút Bộ sưu tập */}
              <Link href="/collections">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
                  title="Địa điểm đã lưu"
                >
                  <Bookmark className="size-5" />
                </Button>
              </Link>

              {/* Chuông thông báo cộng đồng */}
              <NotificationBell />

              {/* Avatar người dùng dẫn đến Hồ sơ cá nhân */}
              <Link
                href="/profile"
                title={`Hồ sơ: ${user?.fullName || "Người dùng"}`}
                className="outline-none group ml-1"
              >
                <Avatar className="size-9.5 border-2 border-slate-200 transition-all group-hover:border-[#0194F3] group-hover:scale-105 cursor-pointer shadow-xs">
                  <AvatarImage
                    src={user?.avatarUrl || DEFAULT_AVATAR}
                    alt={user?.fullName || "Avatar"}
                  />
                  <AvatarFallback className="text-xs font-bold bg-slate-100 text-slate-800">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-slate-700 hover:text-[#0194F3] transition-colors cursor-pointer"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0194F3] hover:bg-[#0073D1] text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Bắt đầu miễn phí
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

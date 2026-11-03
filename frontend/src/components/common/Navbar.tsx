"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  MapPin,
  CalendarDays,
  Bookmark,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/config/avatars";

const NAV_LINKS = [
  { href: "/explore", label: "Khám phá", icon: Compass },
  { href: "/planner", label: "Lịch trình", icon: CalendarDays },
  { href: "/community", label: "Cộng đồng", icon: Users },
];

export function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const userInitials = React.useMemo(() => {
    if (!user?.fullName) return "TG";
    const parts = user.fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user?.fullName]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <MapPin className="size-5" />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight text-foreground">
              TripGenie
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <Icon className="size-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: User / CTA Area */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-2.5">
              <Link href="/collections">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Địa điểm đã lưu"
                >
                  <Bookmark className="size-4.5" />
                </Button>
              </Link>

              {/* In-app Community Notifications Bell */}
              <NotificationBell />

              {/* Direct Link to Profile */}
              <Link
                href="/profile"
                title={`Hồ sơ: ${user?.fullName || "Người dùng"}`}
                className="outline-none group"
              >
                <Avatar className="size-9 border-2 border-primary/20 transition-all group-hover:border-primary group-hover:scale-105 cursor-pointer shadow-xs">
                  <AvatarImage
                    src={user?.avatarUrl || DEFAULT_AVATAR}
                    alt={user?.fullName || "Avatar"}
                  />
                  <AvatarFallback className="text-xs font-semibold bg-secondary text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="rounded-xl text-xs font-semibold">
                  Đăng nhập
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="rounded-xl text-xs font-semibold shadow-xs">
                  Bắt đầu ngay
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

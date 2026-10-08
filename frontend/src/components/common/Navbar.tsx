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
  User,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/explore", label: "Khám phá", icon: Compass },
  { href: "/planner", label: "Lịch trình", icon: CalendarDays },
  { href: "/community", label: "Cộng đồng", icon: Users },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();

  const userInitials = React.useMemo(() => {
    if (!user?.fullName) return "TP";
    const parts = user.fullName.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user?.fullName]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Left: Brand Logo & Desktop Nav Links */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <MapPin className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-tight tracking-tight font-heading">
                TripGenie
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
                Du lịch cá nhân hóa
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: Desktop / Tablet */}
        <div className="hidden md:flex items-center gap-2.5 lg:gap-3">
          {!isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="rounded-xl text-xs font-semibold px-3 cursor-pointer">
                  Đăng nhập
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="rounded-xl text-xs font-semibold px-3.5 bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 cursor-pointer">
                  Đăng ký
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Bookmark / Saved Items */}
              <Link href="/collections">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full size-9 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer",
                    pathname.startsWith("/collections") && "bg-secondary text-primary"
                  )}
                  aria-label="Địa điểm đã lưu"
                >
                  <Bookmark className="size-4" />
                </Button>
              </Link>

              {/* User Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none cursor-pointer">
                  <Avatar className="size-8.5 border border-border/80 transition-transform hover:scale-105">
                    <AvatarImage
                      src={user?.avatarUrl || "/avatar.jpg"}
                      alt={user?.fullName || "Avatar"}
                    />
                    <AvatarFallback className="text-xs font-semibold bg-secondary text-primary">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl shadow-lg border border-border/80">
                  <DropdownMenuLabel className="px-2.5 py-2">
                    <div className="font-semibold text-xs text-foreground truncate">{user?.fullName || "Người dùng"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {user?.username ? `@${user.username}` : user?.email || "Thành viên TripGenie"}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="rounded-xl cursor-pointer">
                    <Link href="/profile" className="flex items-center gap-2 w-full text-xs font-medium">
                      <User className="size-3.5" />
                      <span>Hồ sơ cá nhân</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl cursor-pointer">
                    <Link href="/planner" className="flex items-center gap-2 w-full text-xs font-medium">
                      <CalendarDays className="size-3.5" />
                      <span>Lịch trình của tôi</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="rounded-xl text-destructive focus:text-destructive cursor-pointer flex items-center gap-2 text-xs font-medium"
                  >
                    <LogOut className="size-3.5" />
                    <span>Đăng xuất</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {/* Mobile Top Bar Right: Profile / Avatar only */}
        <div className="flex md:hidden items-center gap-2">
          {!isAuthenticated ? (
            <Link href="/login">
              <Button size="xs" variant="outline" className="rounded-lg text-xs font-medium px-2.5">
                Đăng nhập
              </Button>
            </Link>
          ) : (
            <Link href="/profile">
              <Avatar className="size-8 border border-border">
                <AvatarImage
                  src={user?.avatarUrl || "/avatar.jpg"}
                  alt={user?.fullName || "Avatar"}
                />
                <AvatarFallback className="text-xs font-semibold bg-secondary text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

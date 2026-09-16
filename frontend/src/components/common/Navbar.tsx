"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Map,
  MapPin,
  CalendarDays,
  Bookmark,
  Users,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/explore", label: "Khám phá", icon: Compass },
  { href: "/map", label: "Bản đồ", icon: Map },
  { href: "/planner", label: "Lịch trình", icon: CalendarDays },
  { href: "/community", label: "Cộng đồng", icon: Users },
];

export function Navbar() {
  const pathname = usePathname();

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
                TripTailor
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

          {/* Bookmark / Saved Items */}
          <Link href="/collections">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full size-9 text-muted-foreground hover:text-foreground hover:bg-muted",
                pathname.startsWith("/collections") && "bg-secondary text-primary"
              )}
              aria-label="Địa điểm đã lưu"
            >
              <Bookmark className="size-4" />
            </Button>
          </Link>

          {/* User Profile Avatar */}
          <Link href="/profile">
            <Avatar className="size-8.5 border border-border/80 cursor-pointer transition-transform hover:scale-105">
              <AvatarImage
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Avatar"
              />
              <AvatarFallback className="text-xs font-semibold bg-secondary text-primary">
                TP
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>

        {/* Mobile Top Bar Right: Profile / Avatar only */}
        <div className="flex md:hidden items-center gap-2">
          <Link href="/profile">
            <Avatar className="size-8 border border-border">
              <AvatarFallback className="text-xs font-semibold bg-secondary text-primary">
                <User className="size-4" />
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}

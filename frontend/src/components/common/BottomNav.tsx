"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Compass, CalendarDays, Map, User } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/explore", label: "Khám phá", icon: Compass },
  { href: "/planner", label: "Lịch trình", icon: CalendarDays },
  { href: "/explore?view=split", label: "Bản đồ", icon: Map },
  { href: "/profile", label: "Cá nhân", icon: User },
];

function BottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");

  return (
    <nav className="flex h-15 items-center justify-around px-2">
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isSplitMapItem = item.href.includes("view=split");
        const isExploreItem = item.href === "/explore";

        let isActive = false;
        if (item.href === "/") {
          isActive = pathname === "/";
        } else if (isSplitMapItem) {
          isActive = pathname === "/explore" && currentView === "split";
        } else if (isExploreItem) {
          isActive = pathname === "/explore" && currentView !== "split";
        } else {
          isActive = pathname.startsWith(item.href);
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-lg transition-colors min-w-[56px]",
              isActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className={cn("size-5 transition-transform", isActive && "scale-110")} />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" />
              )}
            </div>
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-lg">
      <Suspense fallback={<nav className="flex h-15 items-center justify-around px-2" />}>
        <BottomNavInner />
      </Suspense>
    </div>
  );
}

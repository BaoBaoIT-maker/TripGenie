"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu,
  Compass,
  CalendarDays,
  Users,
  Bookmark,
  LogIn,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { DEFAULT_AVATAR } from "@/config/avatars";
import { cn } from "@/lib/utils";

interface MobileNavSheetProps {
  triggerVariant?: "light" | "transparent";
}

const NAV_ITEMS = [
  { href: "/explore", label: "Khám phá", icon: Compass },
  { href: "/planner", label: "Lịch trình", icon: CalendarDays },
  { href: "/community", label: "Cộng đồng", icon: Users },
  { href: "/collections", label: "Bộ sưu tập đã lưu", icon: Bookmark },
];

function getUserInitials(fullName?: string | null): string {
  if (!fullName) return "TG";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MobileNavSheet({ triggerVariant = "light" }: MobileNavSheetProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const userInitials = getUserInitials(user?.fullName);

  const handleLinkClick = () => {
    setOpen(false);
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "md:hidden size-10 rounded-xl transition-all cursor-pointer",
              triggerVariant === "transparent"
                ? "text-white/95 hover:text-white hover:bg-white/15 drop-shadow-sm"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            )}
            title="Menu điều hướng"
            aria-label="Mở menu điều hướng di động"
          >
            <Menu className="size-5.5" />
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-[300px] sm:w-[340px] p-0 flex flex-col justify-between bg-white text-slate-900 border-l border-slate-200"
      >
        {/* Header Drawer */}
        <div>
          <SheetHeader className="p-5 border-b border-slate-100 text-left">
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo_transparent.png"
                alt="TripGenie Logo"
                width={40}
                height={40}
                className="size-9 object-contain drop-shadow-xs"
              />
              <div>
                <SheetTitle className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                  TripGenie
                </SheetTitle>
                <SheetDescription className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  Nền Tảng Du Lịch Thông Minh
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Main Navigation List */}
          <nav className="p-4 space-y-1.5" aria-label="Menu chính trên di động">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all",
                    isActive
                      ? "bg-sky-50 text-[#0194F3] shadow-2xs font-bold"
                      : "text-slate-700 hover:bg-slate-50 hover:text-[#0194F3]"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-5 transition-colors",
                      isActive ? "text-[#0194F3]" : "text-slate-400"
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Drawer: User Status or Guest Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70">
          {user ? (
            <div className="space-y-3">
              <Link
                href="/profile"
                onClick={handleLinkClick}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-all group"
              >
                <Avatar className="size-10 border border-slate-200 group-hover:border-[#0194F3] transition-colors shadow-2xs">
                  <AvatarImage
                    src={user.avatarUrl || DEFAULT_AVATAR}
                    alt={user.fullName || "User Avatar"}
                  />
                  <AvatarFallback className="text-xs font-bold bg-slate-200 text-slate-800">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-900 truncate group-hover:text-[#0194F3] transition-colors">
                    {user.fullName || "Người dùng"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </Link>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/profile"
                  onClick={handleLinkClick}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <UserIcon className="size-3.5" />
                  <span>Hồ sơ</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-sky-50 hover:text-[#0194F3] hover:border-blue-200 transition-colors cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Link
                href="/login"
                onClick={handleLinkClick}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                <LogIn className="size-4" />
                <span>Đăng nhập</span>
              </Link>
              <Link
                href="/register"
                onClick={handleLinkClick}
                className="flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-bold bg-[#0194F3] hover:bg-[#0073D1] text-white shadow-md shadow-blue-500/20 transition-colors"
              >
                <span>Bắt đầu miễn phí</span>
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

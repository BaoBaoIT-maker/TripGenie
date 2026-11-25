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
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useAuthModalStore } from "@/features/auth/stores/auth-modal.store";
import { DEFAULT_AVATAR } from "@/config/avatars";
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/lib/utils";

interface MobileNavSheetProps {
  triggerVariant?: "light" | "transparent";
}

const NAV_ITEMS: ReadonlyArray<{
  href: string;
  labelKey: TranslationKey;
  icon: typeof Compass;
}> = [
  { href: "/explore", labelKey: "nav.explore", icon: Compass },
  { href: "/planner", labelKey: "nav.planner", icon: CalendarDays },
  { href: "/community", labelKey: "nav.community", icon: Users },
  { href: "/collections", labelKey: "nav.savedCollections", icon: Bookmark },
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
  const { user, isLoading, logout } = useAuth();
  const { t } = useI18n();
  const openAuthModal = useAuthModalStore((state) => state.openAuthModal);
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
            title={t("nav.mobileMenuTooltip")}
            aria-label={t("nav.mobileMenuOpenAria")}
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
                  {t("common.brandTagline")}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Main Navigation List */}
          <nav className="p-4 space-y-1.5" aria-label={t("nav.mobileMenuAria")}>
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
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>

          {/* Language Switcher Dropdown inside Mobile Slide Drawer */}
          <div className="px-4 pt-2 pb-4 space-y-1.5">
            <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("common.languageLabel")}
            </p>
            <LanguageSwitcher variant="mobile" />
          </div>
        </div>

        {/* Footer Drawer: User Status or Guest Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70">
          {isLoading ? (
            <div className="flex items-center gap-3 p-2">
              <div className="size-10 rounded-full bg-slate-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-40 bg-slate-200/70 rounded animate-pulse" />
              </div>
            </div>
          ) : user ? (
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
                    {user.fullName || t("common.userFallback")}
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
                  <span>{t("nav.profileShort")}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-sky-50 hover:text-[#0194F3] hover:border-blue-200 transition-colors cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                  <span>{t("nav.signOut")}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openAuthModal("login");
                }}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <LogIn className="size-4" />
                <span>{t("nav.signIn")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openAuthModal("register");
                }}
                className="flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-bold bg-[#0194F3] hover:bg-[#0073D1] text-white shadow-md shadow-blue-500/20 transition-colors cursor-pointer"
              >
                <span>{t("nav.getStarted")}</span>
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

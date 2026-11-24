"use client";

import * as React from "react";
import Link from "next/link";
import { User as UserIcon, LogOut, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { DEFAULT_AVATAR } from "@/config/avatars";
import { useI18n } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

function getUserInitials(fullName?: string | null): string {
  if (!fullName?.trim()) return "TG";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UserAccountMenuProps {
  variant?: "default" | "transparent";
  className?: string;
}

export function UserAccountMenu({
  variant = "default",
  className,
}: UserAccountMenuProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  if (!user) return null;

  const userInitials = getUserInitials(user.fullName);
  const isTransparent = variant === "transparent";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "outline-none group ml-0.5 sm:ml-1 rounded-full cursor-pointer transition-all",
          isTransparent
            ? "focus-visible:ring-2 focus-visible:ring-white/50"
            : "focus-visible:ring-2 focus-visible:ring-primary/40",
          className
        )}
        aria-label={t("nav.accountMenuAria")}
      >
        <Avatar
          className={cn(
            "size-9 sm:size-9.5 border-2 transition-all group-hover:scale-105 shadow-xs",
            isTransparent
              ? "border-white/60 group-hover:border-white shadow-md"
              : "border-slate-200 group-hover:border-primary"
          )}
        >
          <AvatarImage
            src={user.avatarUrl || DEFAULT_AVATAR}
            alt={user.fullName || "Avatar"}
          />
          <AvatarFallback
            className={cn(
              "text-xs font-bold",
              isTransparent
                ? "bg-white/25 text-white backdrop-blur-md"
                : "bg-muted text-foreground"
            )}
          >
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-48 p-1 shadow-lg border border-border/90 rounded-xl bg-card"
      >
        {user.role === "ADMIN" && (
          <DropdownMenuItem
            render={<Link href="/admin/dashboard" />}
            className="group cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-[#0194F3] hover:bg-sky-50 focus:bg-sky-50 data-[highlighted]:bg-sky-50 transition-colors flex items-center gap-2.5"
          >
            <ShieldCheck className="size-4 text-[#0194F3] transition-colors" />
            <span>{t("nav.adminPortal")}</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          render={<Link href="/profile" />}
          className="group cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground transition-colors flex items-center gap-2.5"
        >
          <UserIcon className="size-4 text-muted-foreground group-hover:text-accent-foreground group-focus:text-accent-foreground group-data-[highlighted]:text-accent-foreground transition-colors" />
          <span>{t("nav.profile")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => logout()}
          className="group cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground transition-colors flex items-center gap-2.5"
        >
          <LogOut className="size-4 text-muted-foreground group-hover:text-accent-foreground group-focus:text-accent-foreground group-data-[highlighted]:text-accent-foreground transition-colors" />
          <span>{t("nav.signOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

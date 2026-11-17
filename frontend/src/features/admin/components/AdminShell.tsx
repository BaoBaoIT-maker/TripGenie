"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { DEFAULT_AVATAR } from "@/config/avatars";
import { ADMIN_SIDEBAR_NAV } from "../admin.constants";
import { useAdminDashboardStats } from "../hooks/use-admin";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthorizedAdmin =
    mounted && !isLoading && user?.role === "ADMIN";

  const { data: stats } = useAdminDashboardStats();

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role !== "ADMIN") {
      router.replace("/");
    }
  }, [mounted, isLoading, user, router]);

  if (!isAuthorizedAdmin) {
    return (
      <div className="h-screen w-screen bg-[#F4F7FB] flex items-center justify-center">
        <div className="flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-xs font-bold text-[#10243A]">
          <Loader2 className="size-4 animate-spin text-[#0194F3]" />
          <span>Đang xác thực quyền Quản trị viên...</span>
        </div>
      </div>
    );
  }

  const moderationQueueCount =
    (stats?.moderation.pendingPosts ?? 0) +
    (stats?.moderation.flaggedPosts ?? 0) +
    (stats?.moderation.highPriorityReportAlerts ?? 0);

  const resolveBadgeValue = (
    badgeKey?: "moderation" | "users" | "places" | "groups" | "audit"
  ): number | null => {
    if (!stats || !badgeKey) return null;
    switch (badgeKey) {
      case "moderation":
        return moderationQueueCount;
      case "users":
        return stats.users.total;
      case "places":
        return stats.places.total;
      case "groups":
        return stats.community.activeGroups;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F4F7FB] text-[#10243A] p-3 sm:p-4 gap-4 font-sans">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white rounded-[26px] border border-slate-200/80 shadow-[0_8px_30px_rgba(16,36,58,0.04)] flex flex-col justify-between p-4 select-none">
        <div className="space-y-6">
          {/* Real TripGenie Logo matching Navbar.tsx */}
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 px-2 pt-1 group"
          >
            <Image
              src="/images/logo_transparent.png"
              alt="TripGenie Logo"
              width={44}
              height={44}
              style={{ width: "auto", height: "auto" }}
              className="h-10 sm:h-11 w-auto object-contain drop-shadow-xs transition-transform group-hover:scale-105"
              priority
            />
            <div className="min-w-0">
              <span className="text-xl font-black tracking-tight text-slate-900 block leading-none">
                TripGenie
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1">
                Nền Tảng Du Lịch Thông Minh
              </span>
            </div>
          </Link>

          {/* Navigation Groups */}
          <nav className="space-y-4" aria-label="Điều hướng Quản trị">
            {ADMIN_SIDEBAR_NAV.map((group) => (
              <div key={group.groupLabel} className="space-y-1">
                <div className="px-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {group.groupLabel}
                </div>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const badgeVal = resolveBadgeValue(item.badgeKey);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#0194F3] text-white font-bold shadow-[0_4px_12px_rgba(1,148,243,0.25)]"
                          : "font-semibold text-slate-600 hover:bg-slate-100/80 hover:text-[#10243A]"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <i
                          className={`${item.iconClass} text-sm w-4 text-center`}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </span>

                      {badgeVal !== null && (
                        <span
                          className={
                            item.badgeKey === "moderation"
                              ? `px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isActive
                                    ? "bg-white text-[#0194F3]"
                                    : badgeVal > 0
                                      ? "bg-rose-500 text-white"
                                      : "bg-slate-100 text-slate-500"
                                }`
                              : `text-[11px] font-bold ${
                                  isActive ? "text-sky-100" : "text-slate-400"
                                }`
                          }
                        >
                          {badgeVal.toLocaleString("vi-VN")}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Admin Profile + Logout ONLY */}
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center gap-3 px-2">
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatarUrl || DEFAULT_AVATAR}
                alt={user.fullName || "Admin"}
                className="size-9 rounded-full object-cover ring-2 ring-[#E8F4FD]"
              />
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#10243A] truncate">
                {user.fullName || "Quản trị viên"}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {user.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-rose-50/80 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area (No Topbar Header) */}
      <main className="flex-1 min-w-0 overflow-y-auto pr-1 space-y-4">
        {children}
      </main>
    </div>
  );
}

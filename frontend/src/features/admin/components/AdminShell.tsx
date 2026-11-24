"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AuthTransitionScreen } from "@/features/auth/components/AuthTransitionScreen";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { DEFAULT_AVATAR } from "@/config/avatars";
import { ADMIN_SIDEBAR_NAV } from "../admin.constants";
import { useAdminDashboardStats } from "../hooks/use-admin";
import { useAdminLiveEvents } from "../hooks/use-admin-live-events";

const emptySubscribe = () => () => {};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { user, isLoading, isLoggingOut, logout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const isAuthorizedAdmin =
    mounted && !isLoading && !isSigningOut && !isLoggingOut && user?.role === "ADMIN";
  const { data: stats } = useAdminDashboardStats({ enabled: isAuthorizedAdmin });
  useAdminLiveEvents(isAuthorizedAdmin);

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (isSigningOut || isLoggingOut) {
      router.replace("/");
      return;
    }
    if (!user) {
      router.replace("/?auth=login");
    } else if (user.role !== "ADMIN") {
      router.replace("/");
    }
  }, [mounted, isLoading, isSigningOut, isLoggingOut, user, router]);

  if (!isAuthorizedAdmin) {
    return (
      <AuthTransitionScreen
        title={
          isSigningOut || isLoggingOut ? "Đang đăng xuất..." : "Đang xác minh..."
        }
      />
    );
  }

  const moderationQueueCount =
    (stats?.moderation.pendingPosts ?? 0) +
    (stats?.moderation.flaggedPosts ?? 0) +
    (stats?.moderation.pendingReports ?? 0);

  const pendingPhotosCount = stats?.places.pendingPhotos ?? 0;

  const renderBadge = (
    badgeKey?: "moderation" | "users" | "places" | "groups" | "audit",
    isActive?: boolean
  ) => {
    if (!stats || !badgeKey) return null;

    if (badgeKey === "moderation") {
      return (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
            isActive
              ? "bg-white text-[#0194F3]"
              : moderationQueueCount > 0
                ? "bg-rose-500 text-white"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {moderationQueueCount.toLocaleString("vi-VN")}
        </span>
      );
    }

    if (badgeKey === "places" && pendingPhotosCount > 0) {
      return (
        <span
          title={`${pendingPhotosCount} ảnh đóng góp đang chờ duyệt`}
          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
            isActive
              ? "bg-white text-[#0194F3]"
              : "bg-amber-100 text-amber-800 border border-amber-200/80"
          }`}
        >
          +{pendingPhotosCount} ảnh
        </span>
      );
    }

    const numericMap: Record<string, number | null> = {
      users: stats.users.total,
      places: stats.places.total,
      groups: stats.community.activeGroups,
    };
    const value = numericMap[badgeKey];
    if (value == null) return null;

    return (
      <span
        className={`text-[11px] font-semibold tabular-nums ${
          isActive ? "text-sky-100" : "text-slate-400"
        }`}
      >
        {value.toLocaleString("vi-VN")}
      </span>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F9FF] text-[#10243A] p-3 sm:p-4 gap-4 font-sans">
      {/* Sidebar — Clean Light Surface matching DESIGN.md */}
      <aside className="w-64 shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between p-4 select-none">
        <div className="space-y-5">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 px-2 pt-1 group"
          >
            <Image
              src="/images/logo_transparent.png"
              alt="TripGenie Logo"
              width={40}
              height={40}
              style={{ width: "auto", height: "auto" }}
              className="h-9 sm:h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
              priority
            />
            <div className="min-w-0">
              <span className="text-lg font-black tracking-tight text-[#10243A] block leading-none">
                TripGenie
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1">
                Cổng Quản Trị
              </span>
            </div>
          </Link>

          <nav className="space-y-4" aria-label="Điều hướng Quản trị">
            {ADMIN_SIDEBAR_NAV.map((group) => (
              <div key={group.groupLabel} className="space-y-1">
                <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {group.groupLabel}
                </div>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                        isActive
                          ? "bg-[#0194F3] text-white font-bold shadow-[0_2px_8px_rgba(1,148,243,0.28)]"
                          : "font-semibold text-slate-600 hover:bg-[#F0F7FF] hover:text-[#0194F3]"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <i
                          className={`${item.iconClass} text-sm w-4 text-center shrink-0`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </span>

                      {renderBadge(item.badgeKey, isActive)}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Admin Profile + Logout */}
        <div className="pt-3.5 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center gap-2.5 px-1.5">
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatarUrl || DEFAULT_AVATAR}
                alt={user.fullName || "Admin"}
                className="size-9 rounded-full object-cover ring-2 ring-[#E8F4FD]"
              />
              <span
                className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                aria-label="Đang trực tuyến"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#10243A] truncate">
                {user.fullName || "Quản trị viên"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {user.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSigningOut(true);
              void logout();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-rose-200/80 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto pr-1 space-y-4">
        {children}
      </main>
    </div>
  );
}

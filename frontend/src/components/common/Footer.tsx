"use client";

import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/i18n/LocaleProvider";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-slate-50 border-t border-slate-200/80 py-12 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/images/logo_transparent.png"
                alt="TripGenie Logo"
                width={48}
                height={48}
                style={{ width: "auto", height: "auto" }}
                className="h-11 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <div>
                <span className="text-xl font-black tracking-tight text-slate-900">
                  TripGenie
                </span>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 -mt-0.5">
                  {t("common.brandTagline")}
                </p>
              </div>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm font-bold text-slate-600">
            <Link href="/explore" className="hover:text-[#0194F3] transition-colors">
              {t("nav.explore")}
            </Link>
            <Link href="/planner" className="hover:text-[#0194F3] transition-colors">
              {t("nav.planner")}
            </Link>
            <Link href="/community" className="hover:text-[#0194F3] transition-colors">
              {t("nav.community")}
            </Link>
            <Link href="/collections" className="hover:text-[#0194F3] transition-colors">
              {t("nav.collections")}
            </Link>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>{t("footer.copyright")}</p>
          <div className="flex items-center gap-6 font-medium">
            <span className="text-slate-400 font-medium">
              {t("footer.versionBadge")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingNavbar } from "./LandingNavbar";
import { HeroVideoPlayer } from "./HeroVideoPlayer";
import { HeroSearchBar } from "./HeroSearchBar";
import { LANDING_CONFIG } from "../config/landing.config";
import { useI18n } from "@/i18n/LocaleProvider";

export function HeroSection() {
  const { t } = useI18n();
  const [customLocationTitle, setCustomLocationTitle] = useState<string | null>(
    null
  );
  const currentLocationTitle =
    customLocationTitle ?? t("landing.hero.defaultLocationTitle");

  return (
    <header className="relative min-h-[84vh] sm:min-h-[90vh] flex flex-col justify-between overflow-hidden bg-slate-950 text-white">
      {/* Video Nền Sắc Nét */}
      <HeroVideoPlayer />

      {/* Floating Header Navbar */}
      <LandingNavbar />

      {/* Cụm Trung tâm: Badge + Headline + Search Bar nâng cao liền khối */}
      <div className="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 my-auto py-2 text-center space-y-5 sm:space-y-7 -translate-y-3 sm:-translate-y-5">
        {/* Inspiration Block: Badge + Headline nâng cao độc lập */}
        <div className="space-y-2.5 sm:space-y-3.5 -translate-y-3 sm:-translate-y-5">
          {/* Badge Subtitle: Kính mờ thanh lịch nằm ngay TRÊN Headline */}
          <div>
            <div className="inline-flex items-center px-3.5 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white/15 hover:bg-white/20 backdrop-blur-md border border-white/25 text-white/95 text-xs sm:text-sm font-medium tracking-wide shadow-xs transition-colors">
              {t("landing.hero.badgeText")}
            </div>
          </div>

          {/* Headline: Ngắt 2 nhịp tự nhiên, không dấu phẩy, cân đối */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.18] hero-text-shadow max-w-3xl mx-auto">
            {t("landing.hero.headlineLine1")}
            <span className="block text-white mt-1 sm:mt-1.5">
              {t("landing.hero.headlineLine2")}
            </span>
          </h1>
        </div>

        {/* Action Block: Search Bar & Gợi ý trượt ngang gần ngay dưới Headline */}
        <div className="max-w-3xl mx-auto w-full space-y-2.5 sm:space-y-3">
          {/* Google-inspired Translucent Search Bar */}
          <HeroSearchBar onDestinationChange={setCustomLocationTitle} />

          {/* Quick Destination Chips (Trượt ngang mượt mà trên mobile, ẩn chữ "Gợi ý" để chip không bị chật) */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap sm:justify-center no-scrollbar py-0.5 px-0.5 touch-pan-x">
            <span className="text-white/60 font-medium text-xs shrink-0 hidden sm:inline">
              {t("landing.hero.suggestionsLabel")}
            </span>
            {LANDING_CONFIG.hero.quickSuggestions.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="shrink-0 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-sm border border-white/20 text-white/90 hover:text-white text-xs font-medium transition-all"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Location Pill Footer */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-5 flex items-center justify-between text-xs text-slate-800">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-sm">
          <svg
            className="size-3.5 text-[#0194F3]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <strong id="heroLocTitle" className="text-slate-900">
            {currentLocationTitle}
          </strong>
          <span className="text-[#0194F3] font-bold">
            {t("landing.hero.weatherBadge")}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-slate-300 font-medium">
          <span>{t("landing.hero.scrollDown")}</span>
          <svg
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState } from "react";
import { LandingNavbar } from "./LandingNavbar";
import { HeroVideoPlayer } from "./HeroVideoPlayer";
import { HeroSearchBar } from "./HeroSearchBar";
import { LANDING_CONFIG } from "../config/landing.config";

export function HeroSection() {
  const [currentLocationTitle, setCurrentLocationTitle] = useState<string>(
    LANDING_CONFIG.hero.defaultLocationTitle
  );

  return (
    <header className="relative min-h-[92vh] flex flex-col justify-between overflow-hidden bg-slate-950 text-white">
      {/* Video Nền Sắc Nét */}
      <HeroVideoPlayer />

      {/* Floating Header Navbar */}
      <LandingNavbar />

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-14 text-center space-y-6 my-auto">
        {/* Tag badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold tracking-wide shadow-sm">
          {LANDING_CONFIG.hero.badgeText}
        </div>

        {/* Headline: Đậm nét, dứt khoát, không gạch chân rác */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.12] hero-text-shadow">
          {LANDING_CONFIG.hero.headlineLine1}
          <br />
          <span className="block text-white mt-1">
            {LANDING_CONFIG.hero.headlineLine2}
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-white/95 leading-relaxed font-medium hero-subtext-shadow">
          {LANDING_CONFIG.hero.subtitle}
        </p>

        {/* Google-inspired Translucent Search Bar with AI Mode & Hot Suggestions */}
        <HeroSearchBar onDestinationChange={setCurrentLocationTitle} />
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
          <span className="text-[#0194F3] font-bold">28°C Nắng đẹp</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-slate-600 font-semibold">
          <span>Cuộn xuống xem tiếp</span>
          <svg
            className="size-3.5 animate-bounce"
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

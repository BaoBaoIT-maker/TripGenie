"use client";

import Link from "next/link";
import { CURATED_STORIES } from "../config/curated-stories.config";
import { useI18n } from "@/i18n/LocaleProvider";

export function EditorialMosaicSection() {
  const { t, messages } = useI18n();
  const storiesCopy = messages.landing.editorial.stories as Record<
    string,
    { subtitle: string; title: string; description: string }
  >;

  return (
    <section
      id="food-guide"
      className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0194F3]">
            {t("landing.editorial.eyebrow")}
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
            {t("landing.editorial.title")}
          </h2>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed font-normal">
            {t("landing.editorial.description")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {t("landing.editorial.countBadge")}
          </span>
        </div>
      </div>

      {/* ASYMMETRIC MOSAIC GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {CURATED_STORIES.map((story, index) => {
          const copy = storiesCopy[story.id] ?? story;
          const isLarge = index === 0;
          const isMedium = index === 1;
          const titleSizeClass = isLarge
            ? "text-xl sm:text-2xl"
            : isMedium
            ? "text-lg sm:text-xl"
            : "text-base sm:text-lg";

          return (
            <Link
              key={story.id}
              href={story.targetUrl}
              className={`group relative ${story.gridSpan.lgCol} ${story.gridSpan.height} rounded-2xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-500 cursor-pointer block border border-slate-200/40`}
            >
              {/* Authentic Vietnam Photography */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={story.imageUrl}
                alt={copy.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                loading="lazy"
              />

              {/* Scrim Gradient mờ nhẹ nâng chữ ở đáy, không che mất chi tiết ảnh */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 via-45% to-transparent pointer-events-none" />

              {/* Content Overlay */}
              <div className="absolute bottom-5 left-5 right-5 text-white space-y-1.5 pointer-events-none">
                <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wider block">
                  {copy.subtitle}
                </span>
                <h3
                  className={`${titleSizeClass} font-bold text-white leading-tight drop-shadow-xs group-hover:text-sky-200 transition-colors`}
                >
                  {copy.title}
                </h3>
                <p className="text-xs text-slate-200/90 line-clamp-2 leading-relaxed font-normal">
                  {copy.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

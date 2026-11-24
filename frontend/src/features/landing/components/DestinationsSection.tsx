"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SEASONAL_DESTINATIONS } from "../config/seasonal-destinations.config";
import { useI18n } from "@/i18n/LocaleProvider";

const CENTER_INDEX = Math.floor(SEASONAL_DESTINATIONS.length / 2);

export function DestinationsSection() {
  const { t, messages } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const seasonalCopy = messages.landing.destinations.items as Record<
    string,
    { title: string; weatherCondition: string; subtitle: string }
  >;
  // Mặc định chọn thẻ chính giữa (Mã Pí Lèng) làm tâm điểm
  const [activeIndex, setActiveIndex] = useState(CENTER_INDEX);

  // Cuộn thẻ vào tâm màn hình một cách chính xác mà không gây giật cuộn dọc của trang
  const scrollToCard = useCallback((index: number, smooth = true) => {
    const track = trackRef.current;
    if (!track) return;

    const cards = track.children;
    const card = cards[index] as HTMLElement | undefined;
    if (!card) return;

    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const targetScrollLeft = cardCenter - track.clientWidth / 2;

    track.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  // Aim vào card ở giữa trên di động khi load trang hoặc khi resize màn hình
  useEffect(() => {
    const aimCenter = (smooth = false) => {
      if (window.innerWidth < 768) {
        scrollToCard(CENTER_INDEX, smooth);
      }
    };

    const rafId = requestAnimationFrame(() => {
      aimCenter(false);
    });

    // Thêm một timeout nhỏ phụ trợ phòng trường hợp web fonts / ảnh làm thay đổi layout
    const timerId = setTimeout(() => {
      aimCenter(false);
    }, 150);

    const handleResize = () => {
      aimCenter(false);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener("resize", handleResize);
    };
  }, [scrollToCard]);

  // Cập nhật trạng thái cuộn trên di động (Mobile snap)
  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    // Chỉ tính index tự động theo scroll trên màn hình nhỏ (khi không có hover của chuột)
    if (window.innerWidth < 768) {
      const { scrollLeft, clientWidth } = track;
      const trackCenter = scrollLeft + clientWidth / 2;
      const cards = Array.from(track.children) as HTMLElement[];

      let closestIndex = 0;
      let minDistance = Infinity;

      cards.forEach((card, idx) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(trackCenter - cardCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = idx;
        }
      });

      setActiveIndex(closestIndex);
    }
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    track.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      track.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState]);

  const handleNavigate = (delta: number) => {
    const next =
      (activeIndex + delta + SEASONAL_DESTINATIONS.length) %
      SEASONAL_DESTINATIONS.length;
    setActiveIndex(next);
    scrollToCard(next);
  };

  return (
    <section
      id="destinations"
      className="relative py-12 sm:py-16 bg-gradient-to-b from-[#F5F9FF] via-[#F0F7FF] to-[#F8FAFC] border-b border-slate-200/60 overflow-hidden"
    >
      {/* Subtle Topographic Mesh Watermark */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#0194F3_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        {/* Section Header */}
        <div className="text-center space-y-2 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
            {t("landing.destinations.heading")}
          </h2>
          <div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-[#0194F3] transition-colors group"
            >
              <span>{t("landing.destinations.viewAllMap")}</span>
              <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Center Stage Overlapping Card Deck Track (Xếp chồng cả mobile & desktop, kích thước thanh lịch) */}
        <div className="relative py-2 max-w-5xl mx-auto">
          {/* Prev & Next Floating Buttons for Smooth Cycling */}
          <button
            type="button"
            onClick={() => handleNavigate(-1)}
            aria-label={t("landing.destinations.prevAria")}
            className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-40 size-8 sm:size-10 rounded-full bg-white/95 hover:bg-white text-slate-700 shadow-md border border-slate-200/80 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <i className="fa-solid fa-chevron-left text-xs sm:text-sm" />
          </button>

          <button
            type="button"
            onClick={() => handleNavigate(1)}
            aria-label={t("landing.destinations.nextAria")}
            className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-40 size-8 sm:size-10 rounded-full bg-white/95 hover:bg-white text-slate-700 shadow-md border border-slate-200/80 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <i className="fa-solid fa-chevron-right text-xs sm:text-sm" />
          </button>

          <div
            ref={trackRef}
            id="seasonalCardsTrack"
            onMouseLeave={() => setActiveIndex(CENTER_INDEX)}
            className="flex items-center justify-start sm:justify-center overflow-x-auto sm:overflow-visible scroll-smooth snap-x snap-mandatory touch-pan-x no-scrollbar py-6 px-[calc(50vw-95px)] sm:px-12 select-none"
          >
            {SEASONAL_DESTINATIONS.map((item, index) => {
              const copy = seasonalCopy[item.id] ?? item;
              const distance = Math.abs(index - activeIndex);
              const isActive = index === activeIndex;

              // z-index: Thẻ active luôn cao nhất (30), các thẻ xa dần lùi về sau
              const zIndex = 30 - distance * 5;

              // Scale & TranslateY mượt mà theo khoảng cách tâm điểm
              const scale =
                distance === 0
                  ? "scale-105"
                  : distance === 1
                  ? "scale-92"
                  : "scale-85";

              const translateY =
                distance === 0
                  ? "-translate-y-2.5 sm:-translate-y-3"
                  : "translate-y-0";

              const opacity =
                distance === 0
                  ? "opacity-100"
                  : distance === 1
                  ? "opacity-90"
                  : "opacity-80";

              return (
                <Link
                  key={item.id}
                  href={item.targetUrl}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => {
                    setActiveIndex(index);
                    scrollToCard(index);
                  }}
                  style={{ zIndex }}
                  className={`group shrink-0 relative rounded-2xl overflow-hidden snap-center transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] select-none block cursor-pointer border border-white/50 ${scale} ${translateY} ${opacity} ${
                    isActive
                      ? "shadow-2xl ring-2 ring-white/70 md:ring-[#0194F3]/30"
                      : "shadow-md hover:shadow-xl"
                  } w-[190px] sm:w-[240px] md:w-[290px] lg:w-[320px] h-[300px] sm:h-[360px] md:h-[400px] lg:h-[430px] -ml-16 sm:-ml-20 md:-ml-24 lg:-ml-26 first:ml-0`}
                >
                  {/* Authentic Vietnam Photography */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={copy.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    loading="lazy"
                  />

                  {/* Scrim Gradient mờ nhẹ nâng chữ ở đáy */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 via-45% to-transparent pointer-events-none" />

                  {/* Bottom Editorial Content Area */}
                  <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 md:p-6 space-y-1 sm:space-y-1.5 text-white pointer-events-none">
                    {/* Destination Title */}
                    <h3 className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight leading-snug drop-shadow-sm group-hover:text-sky-200 transition-colors">
                      {copy.title}
                    </h3>

                    {/* Expandable Details Panel: Bung ra khi thẻ ACTIVE */}
                    <div
                      className={`space-y-1.5 overflow-hidden transition-all duration-300 ease-out ${
                        isActive
                          ? "opacity-100 max-h-32 translate-y-0"
                          : "opacity-0 max-h-0 -translate-y-2"
                      }`}
                    >
                      {/* Weather Line */}
                      <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold drop-shadow-sm text-white/95">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.weatherIconUrl}
                          alt={copy.weatherCondition}
                          className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 drop-shadow-sm"
                          loading="lazy"
                        />
                        <span>{item.weatherTemp}</span>
                        <span className="text-white/40">•</span>
                        <span className="text-white/90 font-normal">
                          {copy.weatherCondition}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs sm:text-sm text-slate-200/90 font-normal leading-relaxed line-clamp-2">
                        {copy.subtitle}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Interactive Indicator Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {SEASONAL_DESTINATIONS.map((dest, idx) => {
            const copy = seasonalCopy[dest.id] ?? dest;
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => {
                  setActiveIndex(idx);
                  scrollToCard(idx);
                }}
                aria-label={t("landing.destinations.viewCardAria", {
                  title: copy.title,
                })}
                className="min-h-[44px] min-w-[20px] flex items-center justify-center cursor-pointer"
              >
                <span
                  className={`h-1.5 rounded-full transition-all duration-300 block ${
                    activeIndex === idx
                      ? "w-6 bg-[#0194F3]"
                      : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SEASONAL_DESTINATIONS } from "../config/seasonal-destinations.config";

export function DestinationsSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  // Mặc định chọn thẻ số 2 (chính giữa trong 5 thẻ: Mã Pí Lèng) làm tâm điểm
  const [activeIndex, setActiveIndex] = useState(2);

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

  // Cuộn thẻ vào tâm màn hình khi chạm vào trên di động
  const scrollToCard = (index: number) => {
    const track = trackRef.current;
    if (!track) return;

    const cards = track.children;
    if (cards[index]) {
      (cards[index] as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  return (
    <section
      id="destinations"
      className="relative py-12 sm:py-16 bg-gradient-to-b from-[#F5F9FF] via-[#F0F7FF] to-[#F8FAFC] border-b border-slate-200/60 overflow-hidden"
    >
      {/* Subtle Topographic Mesh Watermark */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#0194F3_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        {/* Section Header — Google Arts & Culture Editorial Style */}
        <div className="text-center space-y-2 max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Những điểm đến đáng trải nghiệm
          </h2>
          <div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 hover:text-[#0194F3] transition-colors group"
            >
              <span>Xem bản đồ 34 tỉnh thành</span>
              <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Center Stage Overlapping Card Deck Track */}
        <div className="relative py-4">
          <div
            ref={trackRef}
            id="seasonalCardsTrack"
            onMouseLeave={() => setActiveIndex(2)}
            className="flex items-center md:justify-center overflow-x-auto md:overflow-visible scroll-smooth snap-x snap-mandatory touch-pan-x no-scrollbar py-8 px-6 sm:px-12 md:px-0"
          >
            {SEASONAL_DESTINATIONS.map((item, index) => {
              const distance = Math.abs(index - activeIndex);
              const isActive = index === activeIndex;

              // z-index: Thẻ active/hover luôn cao nhất (30), các thẻ xa dần lùi về sau
              const zIndex = 30 - distance * 5;

              // Scale & TranslateY mượt mà theo chuẩn Google Arts & Culture
              const scale =
                distance === 0
                  ? "scale-100 md:scale-105"
                  : distance === 1
                  ? "scale-95 md:scale-92 lg:scale-94"
                  : "scale-90 md:scale-86 lg:scale-88";

              const translateY =
                distance === 0
                  ? "-translate-y-2 md:-translate-y-4"
                  : "translate-y-0";

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
                  className={`group shrink-0 relative rounded-2xl overflow-hidden snap-center transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] select-none block cursor-pointer border border-white/40 ${scale} ${translateY} ${
                    isActive
                      ? "shadow-2xl ring-2 ring-white/60 md:ring-[#0194F3]/30"
                      : "shadow-xl hover:shadow-2xl"
                  } w-[82vw] max-w-[340px] sm:w-[380px] md:w-[460px] lg:w-[480px] h-[480px] sm:h-[500px] md:h-[520px] md:-ml-32 lg:-ml-36 md:first:ml-0`}
                >
                  {/* Authentic Vietnam Photography (100% Sắc Nét, Không Bị Mờ, Không Badge Phía Trên) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    loading="lazy"
                  />

                  {/* Scrim Gradient mờ nhẹ nâng chữ ở đáy */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 via-40% to-transparent pointer-events-none" />

                  {/* Bottom Editorial Content Area */}
                  <div className="absolute bottom-0 inset-x-0 p-6 sm:p-7 space-y-2 text-white pointer-events-none">
                    {/* Destination Title (Luôn hiển thị thanh lịch, rõ ràng) */}
                    <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight leading-snug drop-shadow-sm group-hover:text-sky-200 transition-colors">
                      {item.title}
                    </h3>

                    {/* Expandable Details Panel: CHỈ BUNG RA KHI THẺ HOVER / ACTIVE (Phương án 1) */}
                    <div
                      className={`space-y-2 overflow-hidden transition-all duration-300 ease-out ${
                        isActive
                          ? "opacity-100 max-h-32 translate-y-0"
                          : "opacity-0 max-h-0 -translate-y-2"
                      }`}
                    >
                      {/* Weather Line (MSN Weather SVG Icon + Chuẩn Font Trắng Cao Cấp) */}
                      <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium drop-shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.weatherIconUrl}
                          alt={item.weatherCondition}
                          className="w-5 h-5 shrink-0 drop-shadow-sm"
                          loading="lazy"
                        />
                        <span className="font-semibold text-white">
                          {item.weatherTemp}
                        </span>
                        <span className="text-white/40">•</span>
                        <span className="text-white/90 font-normal">
                          {item.weatherCondition}
                        </span>
                      </div>

                      {/* Full Unclipped Description (Không bị ... cụt chữ) */}
                      <p className="text-xs sm:text-sm text-slate-200/90 font-normal leading-relaxed">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Mobile & Tablet Interactive Indicator Dots */}
        <div className="flex items-center justify-center gap-2 pt-2 md:hidden">
          {SEASONAL_DESTINATIONS.map((dest, idx) => (
            <button
              key={dest.id}
              type="button"
              onClick={() => {
                setActiveIndex(idx);
                scrollToCard(idx);
              }}
              aria-label={`Xem thẻ mùa ${dest.title}`}
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
          ))}
        </div>
      </div>
    </section>
  );
}

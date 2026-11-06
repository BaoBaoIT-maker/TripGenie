"use client";

import { useRef } from "react";
import Link from "next/link";

export function DestinationsSection() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollTrack = (direction: number) => {
    if (!trackRef.current) return;
    trackRef.current.scrollBy({ left: direction * 360, behavior: "smooth" });
  };

  return (
    <section
      id="destinations"
      className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200/80 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0194F3]">
              Khám Phá Mùa Đẹp Nhất
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Những vùng đất đáng đi nhất năm nay
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Tuyển chọn các điểm đến có thời tiết lý tưởng, ẩm thực đặc sắc và đã có sẵn lộ trình mẫu chuẩn gu.
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <Link
              href="/explore"
              className="text-xs font-bold text-slate-800 hover:text-[#0194F3] underline underline-offset-4 mr-2"
            >
              Xem tất cả 28 tỉnh thành →
            </Link>
            <button
              type="button"
              onClick={() => scrollTrack(-1)}
              aria-label="Lùi lại"
              className="size-11 rounded-full border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              <svg
                className="size-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollTrack(1)}
              aria-label="Tiếp theo"
              className="size-11 rounded-full border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              <svg
                className="size-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Horizontal Cards Track */}
        <div
          ref={trackRef}
          id="cardsTrack"
          className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar pb-4 pt-1"
        >
          {/* Card 1: Đà Nẵng */}
          <article className="group shrink-0 w-[300px] sm:w-[340px] bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden snap-start flex flex-col justify-between">
            <div className="relative h-64 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&auto=format&fit=crop&q=80"
                alt="Đà Nẵng"
                className="w-full h-full object-cover card-img"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/95 text-[11px] font-bold text-slate-900 shadow-xs">
                Biển &amp; Di sản
              </span>
              <span className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-[#0194F3] text-white text-xs font-bold">
                3N2Đ Mẫu
              </span>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-xs font-medium text-blue-200">Miền Trung Việt Nam</span>
                <h3 className="text-2xl font-bold">Đà Nẵng — Hội An</h3>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                Bán đảo Sơn Trà hoang sơ, biển Mỹ Khê trong xanh và phố cổ Hội An rực rỡ đèn lồng lung linh.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Chi phí ước tính:</span>
                <strong className="font-bold text-slate-900">~2.800.000 đ</strong>
              </div>
            </div>
          </article>

          {/* Card 2: Phú Quốc */}
          <article className="group shrink-0 w-[300px] sm:w-[340px] bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden snap-start flex flex-col justify-between">
            <div className="relative h-64 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80"
                alt="Phú Quốc"
                className="w-full h-full object-cover card-img"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/95 text-[11px] font-bold text-slate-900 shadow-xs">
                Đảo ngọc nhiệt đới
              </span>
              <span className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-[#0194F3] text-white text-xs font-bold">
                4N3Đ Mẫu
              </span>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-xs font-medium text-blue-200">Kiên Giang</span>
                <h3 className="text-2xl font-bold">Đảo Ngọc Phú Quốc</h3>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                Hoàng hôn Bãi Sao màu mật ong, lặn ngắm san hô Hòn Móng Tay và thưởng thức gỏi cá trích tại làng chài.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Chi phí ước tính:</span>
                <strong className="font-bold text-slate-900">~3.900.000 đ</strong>
              </div>
            </div>
          </article>

          {/* Card 3: Sa Pa */}
          <article className="group shrink-0 w-[300px] sm:w-[340px] bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden snap-start flex flex-col justify-between">
            <div className="relative h-64 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80"
                alt="Sa Pa"
                className="w-full h-full object-cover card-img"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/95 text-[11px] font-bold text-slate-900 shadow-xs">
                Chữa lành &amp; Mây núi
              </span>
              <span className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-[#0194F3] text-white text-xs font-bold">
                3N2Đ Mẫu
              </span>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-xs font-medium text-blue-200">Lào Cai</span>
                <h3 className="text-2xl font-bold">Sa Pa Mây Ngàn</h3>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                Săn biển mây đèo Ô Quy Hồ, dạo bản Tả Van giữa thung lũng ruộng bậc thang và thưởng thức thắng cố nóng hổi.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Chi phí ước tính:</span>
                <strong className="font-bold text-slate-900">~2.400.000 đ</strong>
              </div>
            </div>
          </article>

          {/* Card 4: Hà Nội */}
          <article className="group shrink-0 w-[300px] sm:w-[340px] bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden snap-start flex flex-col justify-between">
            <div className="relative h-64 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=800&auto=format&fit=crop&q=80"
                alt="Hà Nội"
                className="w-full h-full object-cover card-img"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/95 text-[11px] font-bold text-slate-900 shadow-xs">
                Ngàn năm văn hiến
              </span>
              <span className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-[#0194F3] text-white text-xs font-bold">
                2N1Đ Mẫu
              </span>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-xs font-medium text-blue-200">Thủ đô</span>
                <h3 className="text-2xl font-bold">Hà Nội 36 Phố Phường</h3>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                Cafe trứng Giảng ấm nồng, dạo mát quanh Hồ Gươm mùa lá vàng và thưởng thức bún chả que tre nướng than hoa.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Chi phí ước tính:</span>
                <strong className="font-bold text-slate-900">~1.500.000 đ</strong>
              </div>
            </div>
          </article>

          {/* Card 5: Ninh Bình */}
          <article className="group shrink-0 w-[300px] sm:w-[340px] bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden snap-start flex flex-col justify-between">
            <div className="relative h-64 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1528127269322-539801943592?w=800&auto=format&fit=crop&q=80"
                alt="Ninh Bình"
                className="w-full h-full object-cover card-img"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/95 text-[11px] font-bold text-slate-900 shadow-xs">
                Non nước Tràng An
              </span>
              <span className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-[#0194F3] text-white text-xs font-bold">
                2N1Đ Mẫu
              </span>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-xs font-medium text-blue-200">Di sản thế giới</span>
                <h3 className="text-2xl font-bold">Tràng An — Tam Cốc</h3>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                Thuyền nan lướt qua thạch nhũ lung linh, đạp xe ven đồng lúa chín và leo đỉnh Hang Múa ngắm trọn non xanh.
              </p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Chi phí ước tính:</span>
                <strong className="font-bold text-slate-900">~1.650.000 đ</strong>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { CURATED_STORIES } from "../config/curated-stories.config";

export function EditorialMosaicSection() {
  return (
    <section
      id="food-guide"
      className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-widest text-[#0194F3]">
            CẨM NANG &amp; TRẢI NGHIỆM BẢN ĐỊA
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Ăn chuẩn quán gia truyền, ngắm trọn góc view đẹp
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            Được chọn lọc kỹ lưỡng bởi đội ngũ bản địa TripGenie. Tôn vinh nét đẹp văn hóa, ẩm thực chân thật và những góc chụp ảnh đắt giá nhất Việt Nam.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            5 Điểm đến tiêu biểu
          </span>
        </div>
      </div>

      {/* GOOGLE ARTS & CULTURE ASYMMETRIC MOSAIC GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
        {CURATED_STORIES.map((story, index) => {
          const isLarge = index === 0;
          const isMedium = index === 1;
          const titleSizeClass = isLarge
            ? "text-2xl sm:text-3xl"
            : isMedium
            ? "text-2xl"
            : "text-xl sm:text-2xl";
          const actionText = isLarge || isMedium ? "Khám phá chi tiết →" : "Xem →";

          return (
            <Link
              key={story.id}
              href={story.targetUrl}
              className={`group relative ${story.gridSpan.lgCol} ${story.gridSpan.height} rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 cursor-pointer block`}
            >
              {/* Background Image with Hover Zoom */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={story.imageUrl}
                alt={story.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                loading="lazy"
              />

              {/* Google Arts Bottom Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10"></div>

              {/* Category Pill Badge (Google Arts & Culture style) */}
              <div className="absolute top-5 left-5">
                <span className="px-3.5 py-1.5 rounded-lg bg-[#0194F3] text-white text-xs font-bold tracking-wide shadow-sm">
                  {story.categoryBadge}
                </span>
              </div>

              {/* Content Overlay */}
              <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
                <span className="text-xs font-semibold text-sky-200 uppercase tracking-wider block">
                  {story.subtitle}
                </span>
                <h3
                  className={`${titleSizeClass} font-extrabold text-white leading-tight drop-shadow-sm group-hover:text-sky-200 transition-colors`}
                >
                  {story.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 leading-relaxed">
                  {story.description}
                </p>
                <div className="pt-2 flex items-center justify-between text-xs text-slate-300 border-t border-white/20">
                  <span>
                    Chi phí ước tính:{" "}
                    <strong className="text-white font-bold">
                      {story.estimatedCost}
                    </strong>{" "}
                    ({story.duration})
                  </span>
                  <span className="text-sky-300 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    {actionText}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

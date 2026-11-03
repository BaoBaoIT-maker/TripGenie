import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Coffee,
  Utensils,
  Palmtree,
  PartyPopper,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SectionHeader } from "@/components/common/SectionHeader";
import { HomeSearchForm } from "@/features/home/components/HomeSearchForm";
import { DestinationGrid } from "@/features/home/components/DestinationGrid";
import { HomePlaceTabs } from "@/features/home/components/HomePlaceTabs";
import { TourTemplates } from "@/features/home/components/TourTemplates";
import { HOME_CONFIG } from "@/features/home/config/home.config";
import { homeService } from "@/features/home/services/home.service";
import { buildExploreHref } from "@/features/map/lib/explore-query";

// Revalidate homepage at most every 120 seconds (ISR)
export const revalidate = 120;

const EXPERIENCE_ICONS = {
  Coffee,
  Utensils,
  Palmtree,
  PartyPopper,
};

export default async function HomePage() {
  // Fetch real travel areas on the server; catch locally to ensure page resilience
  const areas = await homeService.getDestinations().catch((err) => {
    console.warn("Could not load travel areas on homepage:", err);
    return [];
  });

  return (
    <div className="flex flex-col gap-12 sm:gap-16 pb-16">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: HERO & SEARCH BANNER
      ───────────────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden bg-slate-950 text-white min-h-[460px] md:min-h-[500px] flex items-center justify-center py-12 sm:py-16">
        {/* Background Travel Cover Image with Smooth Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src={HOME_CONFIG.hero.imageUrl}
            alt={HOME_CONFIG.hero.imageAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-black/40 to-black/60" />
        </div>

        {/* Hero Content Box */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="max-w-3xl mx-auto space-y-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-heading leading-tight drop-shadow-md">
              {HOME_CONFIG.hero.title}
            </h1>
            <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-2xl mx-auto drop-shadow-xs">
              {HOME_CONFIG.hero.description}
            </p>
          </div>

          {/* Prominent Search Form */}
          <HomeSearchForm areas={areas} />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: ĐIỂM ĐẾN ĐỂ KHÁM PHÁ (DESTINATIONS)
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
        <SectionHeader
          title={HOME_CONFIG.destinations.title}
          subtitle={HOME_CONFIG.destinations.description}
        />
        <DestinationGrid areas={areas} />
      </section>

      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
        <SectionHeader title="Tour gợi ý cho chuyến đi của bạn" subtitle="Xem hành trình tham khảo, chọn ngày và tạo lịch trình riêng theo sở thích." />
        <TourTemplates />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: KHÁM PHÁ THEO SỞ THÍCH (HOME PLACE TABS)
      ───────────────────────────────────────────────────────────── */}


      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: BẠN THÍCH TRẢI NGHIỆM NÀO? (EXPERIENCES)
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
        <SectionHeader
          title={HOME_CONFIG.experiences.title}
          subtitle={HOME_CONFIG.experiences.description}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[260px] lg:auto-rows-[240px] gap-4 sm:gap-5">
          {HOME_CONFIG.experiences.items.map((item) => {
            const Icon = EXPERIENCE_ICONS[item.iconName];
            const href = buildExploreHref({ category: item.category });

            return (
              <Link
                key={item.id}
                href={href}
                className={`group relative isolate flex flex-col justify-between overflow-hidden p-6 sm:p-7 rounded-3xl border ${item.cardColor} ${item.layout} hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow duration-300`}
              >
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 50vw"
                  className="-z-20 object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/35 to-black/15" />
                <div
                  className="size-11 shrink-0 rounded-2xl flex items-center justify-center border border-white/30 bg-black/20 text-white backdrop-blur-md"
                >
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div className="space-y-3 pt-5">
                  <div
                    className="max-w-sm"
                  >
                    <h3 className="text-xl sm:text-2xl font-heading font-bold text-white tracking-tight leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-sm text-white/90 leading-relaxed mt-2">
                      {item.description}
                    </p>
                  </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span>Khám phá ngay</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
                </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
        <SectionHeader
          title={HOME_CONFIG.places.title}
          subtitle={HOME_CONFIG.places.description}
        />
        <HomePlaceTabs />
      </section>

      <section aria-labelledby="planner-heading" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-2xl border border-border bg-secondary/40 md:grid-cols-2">
          <div className="relative min-h-64 md:min-h-96">
            <Image
              src={HOME_CONFIG.destinations.imagesBySlug["da-nang"]}
              alt="Phong cảnh Đà Nẵng"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col items-start justify-center px-6 py-8 sm:p-10 lg:p-12">
            <h2 id="planner-heading" className="max-w-md font-heading text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {HOME_CONFIG.plannerBanner.title}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              {HOME_CONFIG.plannerBanner.description}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href="/planner/new?mode=ai"
                className={buttonVariants({ size: "lg", className: "rounded-lg font-semibold" })}
              >
                {HOME_CONFIG.plannerBanner.ctaAi}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/planner/new?mode=manual"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {HOME_CONFIG.plannerBanner.ctaManual}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

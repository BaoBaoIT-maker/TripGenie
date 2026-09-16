import Link from "next/link";
import Image from "next/image";
import { Sparkles, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/common/SectionHeader";
import { PlaceGrid } from "@/components/place/PlaceGrid";
import { PlannerCard } from "@/components/planner/PlannerCard";
import { PostCard } from "@/components/community/PostCard";
import { EXPERIENCE_THEMES } from "@/mocks/data/categories";
import { MOCK_PLACES } from "@/mocks/data/places";
import { MOCK_PLANNERS } from "@/mocks/data/planners";
import { MOCK_COMMUNITY_POSTS } from "@/mocks/data/community";

export default function HomePage() {
  // Categorized Place subsets
  const featuredPlaces = MOCK_PLACES.filter((p) => p.featured);
  const couplePlaces = MOCK_PLACES.filter((p) => p.suitableFor.includes("couple"));
  const familyPlaces = MOCK_PLACES.filter((p) => p.suitableFor.includes("family"));
  const cafePlaces = MOCK_PLACES.filter((p) => p.category === "cafe");

  return (
    <div className="flex flex-col gap-16 sm:gap-20 pb-16">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: HERO BANNER (TRAVELOKA STYLE)
      ───────────────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden bg-slate-950 text-white min-h-[460px] sm:min-h-[500px] flex items-center justify-center">
        {/* Background Travel Cover Image with Smooth Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1528127269322-539801943592?w=1600&auto=format&fit=crop&q=85"
            alt="Vietnam Travel Discovery"
            fill
            priority
            className="object-cover object-center opacity-40 scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-radial-[at_center_top] from-transparent via-black/40 to-black/80" />
        </div>

        {/* Hero Content Box */}
        <div className="relative z-10 w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight font-heading leading-tight mx-auto drop-shadow-md">
              Du lịch & Trải nghiệm
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-200 max-w-xl mx-auto leading-relaxed drop-shadow-sm">
              Khám phá điểm đến yêu thích và lên kế hoạch chuyến đi hoàn hảo.
            </p>
          </div>

          {/* Quick Search Form */}
          <form
            action="/explore"
            method="GET"
            className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-2 p-2 bg-background/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 text-foreground"
          >
            <div className="relative flex-1 w-full">
              <input
                type="text"
                name="keyword"
                placeholder="Tìm quán cafe, nhà hàng, điểm check-in..."
                className="w-full h-11 px-4 text-xs sm:text-sm bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Button
              type="submit"
              className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all shrink-0"
            >
              <Compass className="size-4" />
              <span>Tìm kiếm</span>
            </Button>
          </form>

          {/* Quick Category Navigation Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/15"
            >
              <span>🧭 Khám phá</span>
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/15"
            >
              <span>🗺️ Bản đồ lân cận</span>
            </Link>
            <Link
              href="/planner"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors border border-white/15"
            >
              <span>📅 Lịch trình mẫu</span>
            </Link>
            <Link
              href="/planner/new?mode=ai"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="size-3" />
              <span>Tạo lịch với AI</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: CHỦ ĐỀ DU LỊCH
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1536px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <SectionHeader
          title="Chủ đề du lịch"
          viewAllHref="/explore"
          viewAllLabel="Xem tất cả"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {EXPERIENCE_THEMES.map((theme) => (
            <Link
              key={theme.id}
              href={`/explore?theme=${theme.id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted mb-3">
                <Image
                  src={theme.image}
                  alt={theme.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 16vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-2 left-2 right-2 text-[11px] font-semibold text-white line-clamp-1">
                  {theme.badgeText}
                </span>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                {theme.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: ĐỊA ĐIỂM NỔI BẬT
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1536px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <SectionHeader
          title="Địa điểm nổi bật"
          viewAllHref="/explore?sort=rating"
          viewAllLabel="Xem tất cả"
        />

        <PlaceGrid places={featuredPlaces.slice(0, 4)} columns={4} />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: HẸN HÒ LÃNG MẠN
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1536px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <SectionHeader
          title="Hẹn hò lãng mạn"
          viewAllHref="/explore?suitableFor=couple"
          viewAllLabel="Xem tất cả"
        />

        <PlaceGrid places={couplePlaces.slice(0, 3)} columns={3} />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: DÀNH CHO GIA ĐÌNH
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1536px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <SectionHeader
          title="Dành cho gia đình"
          viewAllHref="/explore?suitableFor=family"
          viewAllLabel="Xem tất cả"
        />

        <PlaceGrid places={familyPlaces.slice(0, 3)} columns={3} />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: LỊCH TRÌNH GỢI Ý
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1536px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <SectionHeader
          title="Lịch trình gợi ý"
          viewAllHref="/planner"
          viewAllLabel="Xem tất cả"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {MOCK_PLANNERS.map((planner) => (
            <PlannerCard key={planner.id} planner={planner} />
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: CAFE & SỐNG ẢO
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1536px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <SectionHeader
          title="Quán cafe view đẹp"
          viewAllHref="/explore?category=cafe"
          viewAllLabel="Xem tất cả"
        />

        <PlaceGrid places={cafePlaces.slice(0, 3)} columns={3} />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 8: CHIA SẺ TỪ CỘNG ĐỒNG
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1536px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <SectionHeader
          title="Chia sẻ từ cộng đồng"
          viewAllHref="/community"
          viewAllLabel="Xem tất cả"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_COMMUNITY_POSTS.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 9: BOTTOM CTA BANNER
      ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1536px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-secondary/80 via-background to-accent/15 p-6 sm:p-10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
              Tạo lịch trình du lịch trong 5 giây
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Tự động tối ưu thời gian, điểm đến và chi phí cho kỳ nghỉ sắp tới.
            </p>
          </div>

          <Link href="/planner/new?mode=ai">
            <Button size="lg" className="h-11 px-6 rounded-xl font-bold shadow-md gap-2 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
              <Sparkles className="size-4" />
              <span>Bắt đầu ngay</span>
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

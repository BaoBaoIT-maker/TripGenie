import type { Metadata } from "next";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { DestinationsSection } from "@/features/landing/components/DestinationsSection";
import { CoreFeaturesSection } from "@/features/landing/components/CoreFeaturesSection";
import { EditorialMosaicSection } from "@/features/landing/components/EditorialMosaicSection";
import { CompanionsSection } from "@/features/landing/components/CompanionsSection";
import { LandingFooter } from "@/features/landing/components/LandingFooter";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "TripGenie — Nền tảng Du lịch Thông minh Việt Nam",
  description:
    "Tự động sắp xếp lịch trình chi tiết từng giờ, tính toán chi phí minh bạch và đồng bộ thời gian thực cùng hội bạn thân mà không cần ghi chép thủ công.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#0194F3] selection:text-white antialiased">
      {/* Hero Section with Local Video Background, Floating Nav & Quick Planner */}
      <HeroSection />

      {/* Section 1: Khám Phá Mùa Đẹp Nhất (Horizontal Destination Cards Track) */}
      <DestinationsSection />

      {/* Section 2: Core Features (Canva-style 3 Separated Story Blocks) */}
      <CoreFeaturesSection />

      {/* Section 3: Editorial Showcase (Google Arts & Culture Asymmetric Mosaic Grid) */}
      <EditorialMosaicSection />

      {/* Section 4: Hội Bạn Đồng Hành (Collaborative Multi-user Planning Mockup) */}
      <CompanionsSection />

      {/* Modern Landing Footer */}
      <LandingFooter />
    </div>
  );
}

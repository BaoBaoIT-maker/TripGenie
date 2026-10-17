import type { SuitableAudience } from "@/types/place";

export interface HomeDestinationImage {
  slug: string;
  imageUrl: string;
}

export interface HomePreferenceTab {
  id: string;
  label: string;
  audience?: SuitableAudience;
}

export interface HomeExperienceCategory {
  id: string;
  title: string;
  description: string;
  category: string; // valid ID in SUPER_CATEGORIES
  iconName: "Coffee" | "Utensils" | "Palmtree" | "PartyPopper";
  imageUrl: string;
  layout: string;
  cardColor: string;
}

export const HOME_CONFIG = {
  hero: {
    imageUrl:
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=1600&auto=format&fit=crop&q=85",
    imageAlt: "Phong cảnh Việt Nam",
    title: "Khám phá điểm đến, lên lịch trình theo cách của bạn",
    description:
      "Tìm địa điểm yêu thích và sắp xếp chuyến đi theo thời gian, sở thích, ngân sách.",
    searchPlaceholder: "Tìm quán ăn, cafe, điểm tham quan...",
    searchLabel: "Bạn muốn khám phá gì?",
    areaLabel: "Điểm đến",
    defaultAreaLabel: "Tất cả điểm đến",
    ctaExplore: "Khám phá địa điểm",
    ctaAiPlanner: "Tạo lịch trình AI",
    ctaMap: "Khám phá trên bản đồ",
  },
  destinations: {
    limit: 8,
    title: "Điểm đến để khám phá",
    description: "Những tỉnh thành du lịch nổi tiếng với hàng ngàn điểm trải nghiệm đặc sắc",
    fallbackImage:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
    imagesBySlug: {
      "da-nang":
        "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&auto=format&fit=crop&q=80",
      "ha-noi":
        "https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=800&auto=format&fit=crop&q=80",
      "ho-chi-minh":
        "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&auto=format&fit=crop&q=80",
      "phu-quoc":
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80",
      "da-lat":
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
      "nha-trang":
        "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
      "quang-nam":
        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80",
      "thua-thien-hue":
        "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&auto=format&fit=crop&q=80",
    } as Record<string, string>,
  },
  plannerBanner: {
    title: "Chuyến đi tiếp theo, theo cách của bạn.",
    description:
      "Đã có nơi muốn đến? Chọn ngày đi, thêm những điểm bạn thích và sắp xếp thành một hành trình riêng. Bạn có thể tự lên lịch hoặc nhờ AI gợi ý để bắt đầu.",
    ctaAi: "Tạo lịch trình AI",
    ctaManual: "Lập lịch trình thủ công",
  },
  places: {
    limit: 4,
    title: "Khám phá theo sở thích",
    description: "Địa điểm được đánh giá cao phù hợp cho từng nhu cầu chuyến đi",
    tabs: [
      { id: "featured", label: "Nổi bật" },
      { id: "couple", label: "Cặp đôi", audience: "couple" },
      { id: "family", label: "Gia đình", audience: "family" },
      { id: "friends", label: "Bạn bè", audience: "friends" },
    ] as HomePreferenceTab[],
    emptyMessage: "Chưa có địa điểm phù hợp trong mục này.",
    errorMessage: "Không thể tải dữ liệu địa điểm lúc này.",
    retryText: "Thử lại",
    viewAllText: "Xem tất cả",
  },
  experiences: {
    title: "Bạn thích trải nghiệm nào?",
    description: "Khám phá các nhóm trải nghiệm du lịch phổ biến nhất",
    items: [
      {
        id: "ca-phe",
        title: "Cà phê & Trà",
        description: "Không gian thư giãn, làm việc và ngắm cảnh đẹp",
        category: "ca-phe",
        iconName: "Coffee",
        imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85",
        layout: "lg:col-span-2 lg:row-span-2",
        cardColor: "border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30",
      },
      {
        id: "am-thuc",
        title: "Ẩm thực & Quán ăn",
        description: "Khám phá đặc sản địa phương và ẩm thực phong phú",
        category: "am-thuc",
        iconName: "Utensils",
        imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1000&q=85",
        layout: "lg:col-start-3 lg:row-start-2",
        cardColor: "border-orange-200 bg-orange-50 dark:border-orange-800/60 dark:bg-orange-950/30",
      },
      {
        id: "tham-quan",
        title: "Thiên nhiên & Di tích",
        description: "Điểm tham quan danh lam thắng cảnh và di tích lịch sử",
        category: "tham-quan",
        iconName: "Palmtree",
        imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=85",
        layout: "lg:col-span-2 lg:col-start-3 lg:row-start-1",
        cardColor: "border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30",
      },
      {
        id: "giai-tri",
        title: "Vui chơi & Về đêm",
        description: "Hoạt động giải trí náo nhiệt, bar pub và biểu diễn",
        category: "giai-tri",
        iconName: "PartyPopper",
        imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1000&q=85",
        layout: "lg:col-start-4 lg:row-start-2",
        cardColor: "border-violet-200 bg-violet-50 dark:border-violet-800/60 dark:bg-violet-950/30",
      },
    ] as HomeExperienceCategory[],
  },
};

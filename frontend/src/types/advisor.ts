export interface AdvisorPlaceSummary {
  id: string;
  name: string;
  address: string;
  city: string;
  categoryName: string;
  ratingAvg: number;
  reviewCount: number;
  priceLevel: string | null;
  primaryImage: string | null;
  latitude: number;
  longitude: number;
}

export interface AdvisorCitation {
  documentTitle: string;
  breadcrumbs: string;
  confidence: 'HIGH' | 'LOW';
  similarityScore: number;
}

export interface AdvisorChatRequest {
  message: string;
  sessionId?: string;
}

export interface AdvisorChatResponse {
  sessionId: string;
  reply: string;
  places: AdvisorPlaceSummary[];
  citations: AdvisorCitation[];
}

export interface AdvisorSessionSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

export interface AdvisorMessageItem {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  places?: AdvisorPlaceSummary[];
  citations?: AdvisorCitation[];
  createdAt: string;
  isError?: boolean;
}

export interface AdvisorQuickPromptItem {
  id: string;
  label: string;
  prompt: string;
  category: 'guide' | 'place' | 'safety' | 'platform';
}

export const ADVISOR_UI_CONSTANTS = {
  STORAGE_SESSION_KEY: 'tripgenie_advisor_session_id',
  MAX_INPUT_LENGTH: 2000,
  MAX_TEXTAREA_HEIGHT_PX: 120,
  MOBILE_BREAKPOINT_PX: 768,
  HEADER_TITLE: 'TripGenie AI Advisor',
  HEADER_SUBTITLE: 'Cẩm nang bản địa & Gợi ý địa điểm thực tế',
  WELCOME_TITLE: 'Xin chào! Mình là Cố vấn Du lịch TripGenie',
  WELCOME_DESCRIPTION:
    'Mình được trang bị hệ thống cẩm nang thực chiến và cơ sở dữ liệu địa điểm xác thực tại Việt Nam. Bạn cần tra cứu giá vé, lưu ý an toàn hay tìm quán ngon?',
  FALLBACK_ERROR_MESSAGE:
    'Hệ thống AI Advisor đang bận. Bạn vui lòng thử lại sau giây lát.',
  PRICE_LEVEL_LABELS: {
    LOW: 'Bình dân',
    MEDIUM: 'Vừa phải',
    HIGH: 'Cao cấp',
    LUXURY: 'Sang trọng',
  } as Record<string, string>,
  INTERNAL_ROUTES: {
    '/planner': 'Lập lịch trình AI (/planner)',
    '/explore': 'Khám phá địa điểm (/explore)',
    '/community': 'Cộng đồng (/community)',
  } as Record<string, string>,
  QUICK_PROMPTS: [
    {
      id: 'danang-ticket',
      label: 'Giá vé Bà Nà Hills & lưu ý đi Sơn Trà',
      prompt:
        'Cho mình hỏi giá vé cáp treo Bà Nà Hills hiện tại và quy định xe máy lên bán đảo Sơn Trà Đà Nẵng?',
      category: 'guide',
    },
    {
      id: 'danang-seafood',
      label: 'Quán hải sản tươi ngon tại Đà Nẵng',
      prompt:
        'Gợi ý giúp mình các quán hải sản tươi ngon, đánh giá cao và giá hợp lý tại Đà Nẵng.',
      category: 'place',
    },
    {
      id: 'scam-prevention',
      label: 'Kinh nghiệm phòng tránh chặt chém khi du lịch',
      prompt:
        'Những bẫy lừa đảo phổ biến khi đi du lịch Việt Nam và mẹo phòng tránh thực tế là gì?',
      category: 'safety',
    },
    {
      id: 'platform-guide',
      label: 'Cách mời bạn bè cùng lên lịch trình nhóm',
      prompt:
        'Làm thế nào để mời bạn bè vào nhóm chuyến đi, phân quyền chỉnh sửa và biểu quyết địa điểm trên TripGenie?',
      category: 'platform',
    },
  ] satisfies AdvisorQuickPromptItem[],
} as const;

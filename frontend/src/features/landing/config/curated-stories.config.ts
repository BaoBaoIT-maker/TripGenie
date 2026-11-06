export interface CuratedStory {
  id: string;
  destination: string;
  region: string;
  categoryBadge: string;
  title: string;
  subtitle: string;
  description: string;
  estimatedCost: string;
  duration: string;
  imageUrl: string;
  gridSpan: {
    lgCol: string;
    height: string;
  };
  targetUrl: string;
}

export const CURATED_STORIES: CuratedStory[] = [
  {
    id: "da-nang",
    destination: "Đà Nẵng",
    region: "Miền Trung",
    categoryBadge: "Cẩm nang ẩm thực",
    title: "Bản đồ Ẩm thực Đà Nẵng: Mì Quảng, Hải sản Bé Mặn & Chè Sầu Liên",
    subtitle: "Đặc sản Miền Trung • Tuyển chọn 7 quán gia truyền",
    description:
      "Thưởng thức tô mì tôm thịt cắn ớt xanh thơm nức tại số 95 Nguyễn Tri Phương, hải sản tươi sống đánh bắt trong ngày tại bờ biển Mỹ Khê và ly chè sầu đậm đà.",
    estimatedCost: "~2.800.000 đ",
    duration: "3N2Đ",
    imageUrl:
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&auto=format&fit=crop&q=85",
    gridSpan: {
      lgCol: "lg:col-span-7",
      height: "h-[380px] sm:h-[430px]",
    },
    targetUrl: "/planner/new?destination=da-nang&duration=3&vibe=foodie",
  },
  {
    id: "ha-noi",
    destination: "Hà Nội",
    region: "Thủ đô",
    categoryBadge: "Hành trình văn hóa",
    title: "Hà Nội: Ngõ Nhỏ, Cà Phê Trứng Giảng & Bún Chả Que Tre",
    subtitle: "Thủ đô nghìn năm • Phố cổ 36 phố phường",
    description:
      "Dạo quanh bờ hồ Hoàn Kiếm lúc sáng sớm, nhâm nhi ly cà phê trứng Giảng ấm nồng và thưởng thức bún chả que tre nướng than hoa thơm lừng.",
    estimatedCost: "~1.500.000 đ",
    duration: "2N1Đ",
    imageUrl:
      "https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=1000&auto=format&fit=crop&q=85",
    gridSpan: {
      lgCol: "lg:col-span-5",
      height: "h-[380px] sm:h-[430px]",
    },
    targetUrl: "/planner/new?destination=ha-noi&duration=2&vibe=culture",
  },
  {
    id: "phu-quoc",
    destination: "Phú Quốc",
    region: "Kiên Giang",
    categoryBadge: "Thiên đường biển đảo",
    title: "Phú Quốc: Bãi Sao, Bún Quậy & Hoàng Hôn Hàm Ninh",
    subtitle: "Kiên Giang • Bãi Sao & Hòn Mây Rút",
    description:
      "Lặn ngắm rạn san hô Nam đảo, tự tay khuấy tô bún quậy Kiến Xây và ngắm hoàng hôn đỏ rực tại làng chài Hàm Ninh.",
    estimatedCost: "~3.900.000 đ",
    duration: "3N2Đ",
    imageUrl:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1000&auto=format&fit=crop&q=85",
    gridSpan: {
      lgCol: "lg:col-span-4",
      height: "h-[420px] sm:h-[460px]",
    },
    targetUrl: "/planner/new?destination=phu-quoc&duration=3&vibe=beach",
  },
  {
    id: "hoi-an",
    destination: "Hội An",
    region: "Quảng Nam",
    categoryBadge: "Di sản diệu kỳ",
    title: "Hội An: Phố Đèn Lồng, Bánh Mì Phượng & Nước Mót",
    subtitle: "Quảng Nam • Phố Hội Hoài Niệm",
    description:
      "Đi thuyền thả hoa đăng trên sông Hoài thơ mộng, thưởng thức đĩa cao lầu sợi dai giòn và ổ bánh mì Phượng ngập nhân.",
    estimatedCost: "~1.850.000 đ",
    duration: "2N1Đ",
    imageUrl:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1000&auto=format&fit=crop&q=85",
    gridSpan: {
      lgCol: "lg:col-span-4",
      height: "h-[420px] sm:h-[460px]",
    },
    targetUrl: "/planner/new?destination=hoi-an&duration=2&vibe=heritage",
  },
  {
    id: "sa-pa",
    destination: "Sa Pa",
    region: "Lào Cai",
    categoryBadge: "Chữa lành & Mây núi",
    title: "Sa Pa: Săn Biển Mây Đèo Ô Quy Hồ & Lẩu Cá Hồi",
    subtitle: "Lào Cai • Tây Bắc Hùng Vĩ",
    description:
      "Săn mây lúc hoàng hôn trên đỉnh đèo Ô Quy Hồ, dạo bước bản Tả Van giữa thung lũng ruộng bậc thang và thưởng thức nồi lẩu cá hồi măng chua.",
    estimatedCost: "~2.400.000 đ",
    duration: "3N2Đ",
    imageUrl:
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=1000&auto=format&fit=crop&q=85",
    gridSpan: {
      lgCol: "lg:col-span-4",
      height: "h-[420px] sm:h-[460px]",
    },
    targetUrl: "/planner/new?destination=sa-pa&duration=3&vibe=nature",
  },
];

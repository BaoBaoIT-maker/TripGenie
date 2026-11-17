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
    imageUrl: "/images/curated/da-nang.jpg",
    gridSpan: {
      lgCol: "lg:col-span-7",
      height: "h-[380px] sm:h-[430px]",
    },
    targetUrl: "/explore?keyword=%C4%90%C3%A0+N%E1%BA%B5ng",
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
    imageUrl: "/images/curated/ha-noi.jpg",
    gridSpan: {
      lgCol: "lg:col-span-5",
      height: "h-[380px] sm:h-[430px]",
    },
    targetUrl: "/explore?keyword=H%C3%A0+N%E1%BB%99i",
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
    imageUrl: "/images/curated/phu-quoc.jpg",
    gridSpan: {
      lgCol: "lg:col-span-4",
      height: "h-[420px] sm:h-[460px]",
    },
    targetUrl: "/explore?keyword=Ph%C3%BA+Qu%E1%BB%91c",
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
    imageUrl: "/images/curated/hoi-an.jpg",
    gridSpan: {
      lgCol: "lg:col-span-4",
      height: "h-[420px] sm:h-[460px]",
    },
    targetUrl: "/explore?keyword=H%E1%BB%99i+An",
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
    imageUrl: "/images/curated/sa-pa.jpg",
    gridSpan: {
      lgCol: "lg:col-span-4",
      height: "h-[420px] sm:h-[460px]",
    },
    targetUrl: "/explore?keyword=Sa+Pa",
  },
];

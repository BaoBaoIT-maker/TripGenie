import { CommunityPost } from "@/types/community";

export const MOCK_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: "post-1",
    title: "Chuyến đi Đà Lạt 3N2Đ bất ngờ tuyệt vời cùng người yêu ✨",
    content:
      "Tụi mình vừa có chuyến đi 3N2Đ siêu ưng ý theo lịch trình được gợi ý bởi AI! Thời tiết se lạnh vừa phải, cúc họa mi ở Túi Mơ To nở rực rỡ và lẩu gà lá é Tao Ngộ cay nồng cực ngon. Mọi người có thể sao chép lịch trình của tụi mình nhé!",
    destination: "Đà Lạt",
    authorName: "Khánh Linh",
    authorAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    authorBio: "Travel Blogger • 24 tuổi",
    createdAt: "Hôm qua lúc 18:30",
    images: [
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800&auto=format&fit=crop&q=80",
    ],
    likeCount: 342,
    commentCount: 48,
    isLiked: true,
    isBookmarked: false,
    linkedPlannerId: "planner-dalat-3n2d",
    linkedPlannerTitle: "Đà Lạt 3N2Đ: Cafe Chill & Hoàng Hôn",
    tags: ["#ĐàLạt", "#Couple", "#3N2Đ", "#CafeViewĐẹp"],
  },
  {
    id: "post-2",
    title: "Gợi ý cuối tuần đi dã ngoại Thảo Cầm Viên cực vui cho gia đình có bé nhỏ 🐘",
    content:
      "Cuối tuần không biết đi đâu thì Thảo Cầm Viên là chân ái! Cây xanh rợp bóng mát rượi, bãi cỏ sạch để cắm trại picnic. Các bé được cho hươu cao cổ ăn và xem xiếc thú miễn phí. Vé chỉ 60k/người lớn!",
    destination: "TP. Hồ Chí Minh",
    authorName: "Gia Đình Đậu Đậu",
    authorAvatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    authorBio: "Family & Travel",
    createdAt: "3 ngày trước",
    images: [
      "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=800&auto=format&fit=crop&q=80",
    ],
    likeCount: 512,
    commentCount: 86,
    isLiked: false,
    isBookmarked: true,
    linkedPlannerId: "planner-saigon-foodie",
    linkedPlannerTitle: "Sài Gòn 1 Ngày: Dã Ngoại & Ẩm Thực",
    tags: ["#SàiGòn", "#GiaĐình", "#CuốiTuần", "#TrẻEm"],
  },
  {
    id: "post-3",
    title: "Hoàng hôn siêu thực tại Sunset Sanato Phú Quốc 🌅",
    content:
      "Một buổi chiều chill hết nấc bên bãi biển Bãi Trường. Vừa uống cocktail vừa nghe nhạc DJ ngắm mặt trời lặn dần xuống biển. Mọi người nên đi trước 17:00 để chụp ảnh với các tượng điêu khắc nhé!",
    destination: "Phú Quốc",
    authorName: "Minh Quân",
    authorAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    createdAt: "5 ngày trước",
    images: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
    ],
    likeCount: 289,
    commentCount: 31,
    tags: ["#PhúQuốc", "#HoàngHôn", "#BeachClub", "#Healing"],
  },
];

export interface ExperienceTheme {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  iconName: string;
  badgeText: string;
  image: string;
  colorClass: string;
}

export const EXPERIENCE_THEMES: ExperienceTheme[] = [
  {
    id: "couple",
    slug: "di-choi-nguoi-yeu",
    name: "Đi chơi với người yêu",
    subtitle: "Quán cafe hoàng hôn, ăn tối lãng mạn & góc check-in ngọt ngào",
    iconName: "Heart",
    badgeText: "Hẹn hò lãng mạn",
    image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&auto=format&fit=crop&q=80",
    colorClass: "from-rose-500/20 to-pink-500/20 text-rose-600",
  },
  {
    id: "family",
    slug: "di-an-gia-dinh",
    name: "Đi ăn & Chơi cùng gia đình",
    subtitle: "Không gian rộng rãi, ẩm thực ấm cúng & an toàn cho trẻ nhỏ",
    iconName: "Users",
    badgeText: "Gia đình ấm cúng",
    image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80",
    colorClass: "from-amber-500/20 to-orange-500/20 text-amber-600",
  },
  {
    id: "cafe-chill",
    slug: "cafe-chill-cuoi-tuan",
    name: "Cafe chill & Sống ảo",
    subtitle: "View thung lũng, phong cách Hàn Quốc & không gian yên tĩnh",
    iconName: "Coffee",
    badgeText: "Thư giãn cuối tuần",
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80",
    colorClass: "from-emerald-500/20 to-teal-500/20 text-emerald-600",
  },
  {
    id: "entertainment",
    slug: "vui-choi-giai-tri",
    name: "Vui chơi & Giải trí nhóm",
    subtitle: "Tổ hợp giải trí, bắn cung, chèo SUP & cắm trại dã ngoại",
    iconName: "Sparkles",
    badgeText: "Sôi động nhóm bạn",
    image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&auto=format&fit=crop&q=80",
    colorClass: "from-sky-500/20 to-blue-500/20 text-sky-600",
  },
  {
    id: "weekend-getaway",
    slug: "du-lich-ngan-ngay",
    name: "Du lịch ngắn ngày 2N1Đ / 3N2Đ",
    subtitle: "Lịch trình tối ưu thời gian di chuyển, tiết kiệm & trọn vẹn",
    iconName: "Compass",
    badgeText: "Kỳ nghỉ ngắn",
    image: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80",
    colorClass: "from-purple-500/20 to-indigo-500/20 text-purple-600",
  },
  {
    id: "healing-nature",
    slug: "nghi-duong-thien-nhien",
    name: "Healing & Nghỉ dưỡng thiên nhiên",
    subtitle: "Rời xa khói bụi, hít thở không khí trong lành & tái tạo năng lượng",
    iconName: "Trees",
    badgeText: "Chữa lành tâm hồn",
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80",
    colorClass: "from-teal-500/20 to-emerald-500/20 text-teal-600",
  },
];

import { addDays, format } from "date-fns";

export interface TourTemplate {
  id: string;
  title: string;
  destination: string;
  description: string;
  imageUrl: string;
  styles: string[];
  days: { title: string; activities: string[] }[];
}

export const TOUR_TEMPLATES: TourTemplate[] = [
  {
    id: "da-nang-bien-va-thanh-pho",
    title: "Đà Nẵng: Biển xanh & nhịp sống thành phố",
    destination: "Đà Nẵng",
    description: "Một hành trình thư thả kết hợp biển, cảnh quan và ẩm thực địa phương.",
    imageUrl: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1000&q=85",
    styles: ["Ẩm thực đặc sản", "Cafe chill/check-in", "Biển đảo"],
    days: [
      { title: "Chào thành phố biển", activities: ["Dạo biển Mỹ Khê", "Thưởng thức món ăn địa phương", "Đi bộ bên sông Hàn"] },
      { title: "Thiên nhiên & cảnh quan", activities: ["Tham quan bán đảo Sơn Trà", "Ghé chùa Linh Ứng", "Nghỉ chân tại quán cà phê"] },
      { title: "Một chút văn hóa", activities: ["Tham quan Ngũ Hành Sơn", "Ghé chợ Hàn", "Mua đặc sản trước khi về"] },
    ],
  },
  {
    id: "hoi-an-pho-co",
    title: "Hội An: Phố cổ & những khoảng bình yên",
    destination: "Hội An",
    description: "Khám phá phố cổ, thưởng thức món địa phương và tận hưởng không gian bên biển.",
    imageUrl: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1000&q=85",
    styles: ["Di tích & Văn hóa", "Ẩm thực đặc sản", "Cafe chill/check-in"],
    days: [
      { title: "Dạo bước phố cổ", activities: ["Khám phá phố cổ Hội An", "Thưởng thức cao lầu", "Dạo bên sông Hoài buổi tối"] },
      { title: "Làng quê & biển", activities: ["Ghé làng rau Trà Quế", "Thư giãn tại biển An Bàng", "Cà phê và mua quà lưu niệm"] },
    ],
  },
  {
    id: "hue-di-san",
    title: "Huế: Dấu ấn cố đô & hương vị miền Trung",
    destination: "Huế",
    description: "Dành thời gian cho di sản, nhịp sống chậm và những món ăn đặc trưng.",
    imageUrl: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1000&q=85",
    styles: ["Di tích & Văn hóa", "Ẩm thực đặc sản"],
    days: [
      { title: "Khám phá cố đô", activities: ["Tham quan Đại Nội", "Thưởng thức món Huế", "Dạo bên sông Hương"] },
      { title: "Di sản & đời sống", activities: ["Ghé chùa Thiên Mụ", "Tham quan lăng tẩm theo sở thích", "Khám phá chợ Đông Ba"] },
    ],
  },
];

/** Local calendar dates avoid shifting the trip day when UTC crosses midnight. */
export function getTourDates(dayCount: number, start = new Date()) {
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(addDays(start, Math.max(1, dayCount) - 1), "yyyy-MM-dd"),
  };
}

export function getTourPrompt(tour: TourTemplate): string {
  return [
    `Tham khảo lịch trình “${tour.title}”. Ưu tiên các trải nghiệm sau nếu phù hợp dữ liệu, thời gian và tuyến đường; báo rõ điểm không thể đáp ứng:`,
    ...tour.days.map((day, index) => `Ngày ${index + 1}: ${day.activities.join("; ")}.`),
  ].join("\n");
}

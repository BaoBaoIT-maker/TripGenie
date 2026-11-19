export interface SeasonalDestination {
  id: string;
  seasonBadge: string;
  weatherTemp: string;
  weatherCondition: string;
  weatherIconUrl: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  targetUrl: string;
}

const MSN_WEATHER_BASE =
  "https://assets.msn.com/weathermapdata/1/static/weather/Icons/taskbar_v10/Condition_Card";

export const SEASONAL_DESTINATIONS: SeasonalDestination[] = [
  {
    id: "mua-vang-mu-cang-chai",
    seasonBadge: "Tháng 9 – 10",
    weatherTemp: "18°C",
    weatherCondition: "Nắng thu dịu mát",
    weatherIconUrl: `${MSN_WEATHER_BASE}/MostlyCloudyDayV2.svg`,
    title: "Mùa Vàng Mù Cang Chải",
    subtitle: "Thung lũng sóng lúa bậc thang chạm mây trời, rực rỡ sắc vàng Tây Bắc.",
    imageUrl:
      "https://images.unsplash.com/photo-1609412058473-c199497c3c5d?w=1200&auto=format&fit=crop&q=85",
    targetUrl: "/explore?area=sa-pa",
  },
  {
    id: "mua-nuoc-noi-tra-su",
    seasonBadge: "Tháng 10 – 12",
    weatherTemp: "27°C",
    weatherCondition: "Nắng ấm, gió nhẹ",
    weatherIconUrl: `${MSN_WEATHER_BASE}/MostlySunnyDay.svg`,
    title: "Mùa Nước Nổi Trà Sư",
    subtitle: "Thảm bèo cám xanh ngút ngàn giữa mênh mông rừng tràm sông nước miền Tây.",
    imageUrl:
      "https://images.unsplash.com/photo-1580630873708-e0475b1856c4?w=1200&auto=format&fit=crop&q=85",
    targetUrl: "/explore?area=an-giang",
  },
  {
    id: "mua-may-ngan-ma-pi-leng",
    seasonBadge: "Tháng 12 – 2",
    weatherTemp: "12°C",
    weatherCondition: "Sương mây, se lạnh",
    weatherIconUrl: `${MSN_WEATHER_BASE}/FogV2.svg`,
    title: "Mùa Mây Ngàn Mã Pí Lèng",
    subtitle: "Biển mây ôm trọn hẻm Tu Sản và tứ đại đỉnh đèo kỳ vĩ vùng cao nguyên đá.",
    imageUrl:
      "https://images.unsplash.com/photo-1462688681110-15bc88b1497c?w=1200&auto=format&fit=crop&q=85",
    targetUrl: "/explore?area=lao-cai",
  },
  {
    id: "mua-bien-ngoc-ha-long",
    seasonBadge: "Tháng 3 – 8",
    weatherTemp: "29°C",
    weatherCondition: "Nắng ráo, biển êm",
    weatherIconUrl: `${MSN_WEATHER_BASE}/SunnyDayV3.svg`,
    title: "Mùa Biển Ngọc Vịnh Hạ Long",
    subtitle: "Làn nước ngọc bích phẳng lặng len lỏi giữa hàng nghìn đảo đá vôi kỳ vĩ.",
    imageUrl:
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&auto=format&fit=crop&q=85",
    targetUrl: "/explore?area=ha-long",
  },
  {
    id: "mua-den-long-hoi-an",
    seasonBadge: "Quanh năm • Đẹp nhất T2 – T8",
    weatherTemp: "25°C",
    weatherCondition: "Dịu mát về đêm",
    weatherIconUrl: `${MSN_WEATHER_BASE}/MostlyCloudyNightV2.svg`,
    title: "Mùa Đèn Lồng Phố Hội",
    subtitle: "Hoa đăng rực rỡ soi bóng dòng sông Hoài hoài niệm lung linh giữa lòng phố cổ.",
    imageUrl:
      "https://images.unsplash.com/photo-1544722827-484d3a94c799?w=1200&auto=format&fit=crop&q=85",
    targetUrl: "/explore?area=hoi-an",
  },
];

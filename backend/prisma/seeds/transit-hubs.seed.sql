-- Seed data for transit_hubs (Airports, Major Train Stations, Major Bus Terminals, Ferry Ports)
-- Resolves area_id dynamically by travel_areas.slug (post-merger 34 provinces + tourist zones).
-- Idempotent (ON CONFLICT DO UPDATE) with multi-language JSONB translations.

INSERT INTO transit_hubs (id, name, translations, hub_type, latitude, longitude, area_id, is_active)
VALUES
  -- 1. Sân bay quốc tế & nội địa chính (20 sân bay)
  ('SGN', 'Sân bay Quốc tế Tân Sơn Nhất', '{"en": "Tan Son Nhat International Airport", "vi": "Sân bay Quốc tế Tân Sơn Nhất"}'::jsonb, 'AIRPORT', 10.8184, 106.6588, (SELECT id FROM travel_areas WHERE slug = 'ho-chi-minh'), true),
  ('HAN', 'Sân bay Quốc tế Nội Bài', '{"en": "Noi Bai International Airport", "vi": "Sân bay Quốc tế Nội Bài"}'::jsonb, 'AIRPORT', 21.2212, 105.8072, (SELECT id FROM travel_areas WHERE slug = 'ha-noi'), true),
  ('DAD', 'Sân bay Quốc tế Đà Nẵng', '{"en": "Da Nang International Airport", "vi": "Sân bay Quốc tế Đà Nẵng"}'::jsonb, 'AIRPORT', 16.0439, 108.1994, (SELECT id FROM travel_areas WHERE slug = 'da-nang'), true),
  ('CXR', 'Sân bay Quốc tế Cam Ranh (Nha Trang)', '{"en": "Cam Ranh International Airport (Nha Trang)", "vi": "Sân bay Quốc tế Cam Ranh (Nha Trang)"}'::jsonb, 'AIRPORT', 11.9981, 109.2194, (SELECT id FROM travel_areas WHERE slug = 'nha-trang'), true),
  ('DLI', 'Sân bay Liên Khương (Đà Lạt)', '{"en": "Lien Khuong Airport (Da Lat)", "vi": "Sân bay Liên Khương (Đà Lạt)"}'::jsonb, 'AIRPORT', 11.7506, 108.3742, (SELECT id FROM travel_areas WHERE slug = 'da-lat'), true),
  ('VCL', 'Sân bay Chu Lai (Đà Nẵng / Quảng Ngãi)', '{"en": "Chu Lai Airport (Da Nang / Quang Ngai)", "vi": "Sân bay Chu Lai (Đà Nẵng / Quảng Ngãi)"}'::jsonb, 'AIRPORT', 15.4061, 108.7056, (SELECT id FROM travel_areas WHERE slug = 'da-nang'), true),
  ('HPH', 'Sân bay Quốc tế Cát Bi (Hải Phòng)', '{"en": "Cat Bi International Airport (Hai Phong)", "vi": "Sân bay Quốc tế Cát Bi (Hải Phòng)"}'::jsonb, 'AIRPORT', 20.8192, 106.7247, (SELECT id FROM travel_areas WHERE slug = 'hai-phong'), true),
  ('VDO', 'Sân bay Quốc tế Vân Đồn (Quảng Ninh)', '{"en": "Van Don International Airport (Quang Ninh)", "vi": "Sân bay Quốc tế Vân Đồn (Quảng Ninh)"}'::jsonb, 'AIRPORT', 21.1192, 107.4144, (SELECT id FROM travel_areas WHERE slug = 'quang-ninh'), true),
  ('VII', 'Sân bay Quốc tế Vinh', '{"en": "Vinh International Airport", "vi": "Sân bay Quốc tế Vinh"}'::jsonb, 'AIRPORT', 18.7278, 105.6711, (SELECT id FROM travel_areas WHERE slug = 'nghe-an'), true),
  ('HUI', 'Sân bay Quốc tế Phú Bài (Huế)', '{"en": "Phu Bai International Airport (Hue)", "vi": "Sân bay Quốc tế Phú Bài (Huế)"}'::jsonb, 'AIRPORT', 16.4011, 107.7028, (SELECT id FROM travel_areas WHERE slug = 'hue'), true),
  ('THD', 'Sân bay Thọ Xuân (Thanh Hóa)', '{"en": "Tho Xuan Airport (Thanh Hoa)", "vi": "Sân bay Thọ Xuân (Thanh Hóa)"}'::jsonb, 'AIRPORT', 19.9011, 105.4678, (SELECT id FROM travel_areas WHERE slug = 'thanh-hoa'), true),
  ('VDH', 'Sân bay Đồng Hới (Quảng Trị)', '{"en": "Dong Hoi Airport (Quang Tri)", "vi": "Sân bay Đồng Hới (Quảng Trị)"}'::jsonb, 'AIRPORT', 17.5153, 106.5906, (SELECT id FROM travel_areas WHERE slug = 'quang-tri'), true),
  ('PXU', 'Sân bay Pleiku (Gia Lai)', '{"en": "Pleiku Airport (Gia Lai)", "vi": "Sân bay Pleiku (Gia Lai)"}'::jsonb, 'AIRPORT', 14.0044, 108.0169, (SELECT id FROM travel_areas WHERE slug = 'gia-lai'), true),
  ('BMV', 'Sân bay Buôn Ma Thuột (Đắk Lắk)', '{"en": "Buon Ma Thuot Airport (Dak Lak)", "vi": "Sân bay Buôn Ma Thuột (Đắk Lắk)"}'::jsonb, 'AIRPORT', 12.6681, 108.1203, (SELECT id FROM travel_areas WHERE slug = 'dak-lak'), true),
  ('DIN', 'Sân bay Điện Biên Phủ', '{"en": "Dien Bien Phu Airport", "vi": "Sân bay Điện Biên Phủ"}'::jsonb, 'AIRPORT', 21.3972, 103.0078, (SELECT id FROM travel_areas WHERE slug = 'dien-bien'), true),
  ('VCA', 'Sân bay Quốc tế Cần Thơ', '{"en": "Can Tho International Airport", "vi": "Sân bay Quốc tế Cần Thơ"}'::jsonb, 'AIRPORT', 10.0853, 105.7119, (SELECT id FROM travel_areas WHERE slug = 'can-tho'), true),
  ('CAH', 'Sân bay Cà Mau', '{"en": "Ca Mau Airport", "vi": "Sân bay Cà Mau"}'::jsonb, 'AIRPORT', 9.1764, 105.1789, (SELECT id FROM travel_areas WHERE slug = 'ca-mau'), true),
  ('PQC', 'Sân bay Quốc tế Phú Quốc', '{"en": "Phu Quoc International Airport", "vi": "Sân bay Quốc tế Phú Quốc"}'::jsonb, 'AIRPORT', 10.1698, 103.9931, (SELECT id FROM travel_areas WHERE slug = 'phu-quoc'), true),
  ('VCS', 'Sân bay Côn Đảo', '{"en": "Con Dao Airport", "vi": "Sân bay Côn Đảo"}'::jsonb, 'AIRPORT', 8.7317, 106.6328, (SELECT id FROM travel_areas WHERE slug = 'con-dao'), true),
  ('UIH', 'Sân bay Phù Cát (Quy Nhơn - Gia Lai)', '{"en": "Phu Cat Airport (Quy Nhon - Gia Lai)", "vi": "Sân bay Phù Cát (Quy Nhơn - Gia Lai)"}'::jsonb, 'AIRPORT', 13.9553, 109.0422, (SELECT id FROM travel_areas WHERE slug = 'gia-lai'), true),

  -- 2. Ga tàu hỏa chính (13 ga)
  ('GA_SAIGON', 'Ga Sài Gòn', '{"en": "Saigon Railway Station", "vi": "Ga Sài Gòn"}'::jsonb, 'TRAIN_STATION', 10.7828, 106.6781, (SELECT id FROM travel_areas WHERE slug = 'ho-chi-minh'), true),
  ('GA_HANOI', 'Ga Hà Nội', '{"en": "Hanoi Railway Station", "vi": "Ga Hà Nội"}'::jsonb, 'TRAIN_STATION', 21.0244, 105.8411, (SELECT id FROM travel_areas WHERE slug = 'ha-noi'), true),
  ('GA_DANANG', 'Ga Đà Nẵng', '{"en": "Da Nang Railway Station", "vi": "Ga Đà Nẵng"}'::jsonb, 'TRAIN_STATION', 16.0717, 108.2125, (SELECT id FROM travel_areas WHERE slug = 'da-nang'), true),
  ('GA_HUE', 'Ga Huế', '{"en": "Hue Railway Station", "vi": "Ga Huế"}'::jsonb, 'TRAIN_STATION', 16.4578, 107.5794, (SELECT id FROM travel_areas WHERE slug = 'hue'), true),
  ('GA_NHATRANG', 'Ga Nha Trang', '{"en": "Nha Trang Railway Station", "vi": "Ga Nha Trang"}'::jsonb, 'TRAIN_STATION', 12.2478, 109.1836, (SELECT id FROM travel_areas WHERE slug = 'nha-trang'), true),
  ('GA_VINH', 'Ga Vinh', '{"en": "Vinh Railway Station", "vi": "Ga Vinh"}'::jsonb, 'TRAIN_STATION', 18.6811, 105.6669, (SELECT id FROM travel_areas WHERE slug = 'nghe-an'), true),
  ('GA_DONGHOI', 'Ga Đồng Hới', '{"en": "Dong Hoi Railway Station", "vi": "Ga Đồng Hới"}'::jsonb, 'TRAIN_STATION', 17.4722, 106.6028, (SELECT id FROM travel_areas WHERE slug = 'quang-tri'), true),
  ('GA_THAPCHAM', 'Ga Tháp Chàm (Phan Rang - Cửa ngõ Đà Lạt)', '{"en": "Thap Cham Station (Phan Rang - Da Lat Gateway)", "vi": "Ga Tháp Chàm (Phan Rang - Cửa ngõ Đà Lạt)"}'::jsonb, 'TRAIN_STATION', 11.5975, 108.9567, (SELECT id FROM travel_areas WHERE slug = 'khanh-hoa'), true),
  ('GA_LAOCAI', 'Ga Lào Cai (Cửa ngõ Sa Pa)', '{"en": "Lao Cai Station (Sa Pa Gateway)", "vi": "Ga Lào Cai (Cửa ngõ Sa Pa)"}'::jsonb, 'TRAIN_STATION', 22.4883, 103.9781, (SELECT id FROM travel_areas WHERE slug = 'lao-cai'), true),
  ('GA_DIEUTRI', 'Ga Diêu Trì (Cửa ngõ Quy Nhơn)', '{"en": "Dieu Tri Station (Quy Nhon Gateway)", "vi": "Ga Diêu Trì (Cửa ngõ Quy Nhơn)"}'::jsonb, 'TRAIN_STATION', 13.8050, 109.1417, (SELECT id FROM travel_areas WHERE slug = 'gia-lai'), true),
  ('GA_TAMKY', 'Ga Tam Kỳ (Đà Nẵng)', '{"en": "Tam Ky Railway Station (Da Nang)", "vi": "Ga Tam Kỳ (Đà Nẵng)"}'::jsonb, 'TRAIN_STATION', 15.5714, 108.4722, (SELECT id FROM travel_areas WHERE slug = 'da-nang'), true),
  ('GA_THANHHOA', 'Ga Thanh Hóa', '{"en": "Thanh Hoa Railway Station", "vi": "Ga Thanh Hóa"}'::jsonb, 'TRAIN_STATION', 19.8058, 105.7667, (SELECT id FROM travel_areas WHERE slug = 'thanh-hoa'), true),
  ('GA_NINHBINH', 'Ga Ninh Bình', '{"en": "Ninh Binh Railway Station", "vi": "Ga Ninh Bình"}'::jsonb, 'TRAIN_STATION', 20.2458, 105.9753, (SELECT id FROM travel_areas WHERE slug = 'ninh-binh'), true),

  -- 3. Bến xe khách đầu mối lớn (6 bến xe)
  ('BX_MIENDONG', 'Bến xe Miền Đông Mới (TP.HCM)', '{"en": "New Mien Dong Bus Station (HCMC)", "vi": "Bến xe Miền Đông Mới (TP.HCM)"}'::jsonb, 'BUS_TERMINAL', 10.8653, 106.8122, (SELECT id FROM travel_areas WHERE slug = 'ho-chi-minh'), true),
  ('BX_MIENTAY', 'Bến xe Miền Tây (TP.HCM)', '{"en": "Mien Tay Bus Station (HCMC)", "vi": "Bến xe Miền Tây (TP.HCM)"}'::jsonb, 'BUS_TERMINAL', 10.7511, 106.6139, (SELECT id FROM travel_areas WHERE slug = 'ho-chi-minh'), true),
  ('BX_MYDINH', 'Bến xe Mỹ Đình (Hà Nội)', '{"en": "My Dinh Bus Station (Hanoi)", "vi": "Bến xe Mỹ Đình (Hà Nội)"}'::jsonb, 'BUS_TERMINAL', 21.0286, 105.7778, (SELECT id FROM travel_areas WHERE slug = 'ha-noi'), true),
  ('BX_GIAPBAT', 'Bến xe Giáp Bát (Hà Nội)', '{"en": "Giap Bat Bus Station (Hanoi)", "vi": "Bến xe Giáp Bát (Hà Nội)"}'::jsonb, 'BUS_TERMINAL', 20.9806, 105.8417, (SELECT id FROM travel_areas WHERE slug = 'ha-noi'), true),
  ('BX_TT_DANANG', 'Bến xe Trung tâm Đà Nẵng', '{"en": "Da Nang Central Bus Station", "vi": "Bến xe Trung tâm Đà Nẵng"}'::jsonb, 'BUS_TERMINAL', 16.0494, 108.1719, (SELECT id FROM travel_areas WHERE slug = 'da-nang'), true),
  ('BX_LIENTINH_DALAT', 'Bến xe Liên tỉnh Đà Lạt', '{"en": "Da Lat Intercity Bus Station", "vi": "Bến xe Liên tỉnh Đà Lạt"}'::jsonb, 'BUS_TERMINAL', 11.9286, 108.4489, (SELECT id FROM travel_areas WHERE slug = 'da-lat'), true),

  -- 4. Bến cảng tàu cao tốc & phà biển đi đảo (3 cảng)
  ('BEN_RACHGIA', 'Cảng Bến tàu Rạch Giá (Đi Phú Quốc)', '{"en": "Rach Gia Ferry Port (to Phu Quoc)", "vi": "Cảng Bến tàu Rạch Giá (Đi Phú Quốc)"}'::jsonb, 'FERRY_TERMINAL', 10.0131, 105.0744, (SELECT id FROM travel_areas WHERE slug = 'an-giang'), true),
  ('BEN_HATIEN', 'Bến phà / Tàu cao tốc Hà Tiên (Đi Phú Quốc)', '{"en": "Ha Tien Ferry & Speedboat Pier (to Phu Quoc)", "vi": "Bến phà / Tàu cao tốc Hà Tiên (Đi Phú Quốc)"}'::jsonb, 'FERRY_TERMINAL', 10.3756, 104.4756, (SELECT id FROM travel_areas WHERE slug = 'an-giang'), true),
  ('BEN_TRANDE', 'Cảng Trần Đề (Tàu cao tốc đi Côn Đảo)', '{"en": "Tran De Port (Speed Ferry to Con Dao)", "vi": "Cảng Trần Đề (Tàu cao tốc đi Côn Đảo)"}'::jsonb, 'FERRY_TERMINAL', 9.4897, 106.2081, (SELECT id FROM travel_areas WHERE slug = 'can-tho'), true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  translations = COALESCE(transit_hubs.translations, '{}'::jsonb) || EXCLUDED.translations,
  hub_type = EXCLUDED.hub_type,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  area_id = EXCLUDED.area_id,
  is_active = EXCLUDED.is_active;

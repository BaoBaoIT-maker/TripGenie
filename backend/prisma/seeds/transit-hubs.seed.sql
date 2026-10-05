-- Seed data for transit_hubs (Airports, Major Train Stations, Major Bus Terminals)
-- Follows AGENTS.md: Pure standard SQL, idempotent (ON CONFLICT DO UPDATE).

INSERT INTO transit_hubs (id, name, hub_type, latitude, longitude, area_id, is_active)
VALUES
  -- 1. Sân bay quốc tế & nội địa chính (20 sân bay)
  ('SGN', 'Sân bay Quốc tế Tân Sơn Nhất', 'AIRPORT', 10.8184, 106.6588, 3, true),
  ('HAN', 'Sân bay Quốc tế Nội Bài', 'AIRPORT', 21.2212, 105.8072, 2, true),
  ('DAD', 'Sân bay Quốc tế Đà Nẵng', 'AIRPORT', 16.0439, 108.1994, 5, true),
  ('CXR', 'Sân bay Quốc tế Cam Ranh (Nha Trang)', 'AIRPORT', 11.9981, 109.2194, 26, true),
  ('DLI', 'Sân bay Liên Khương (Đà Lạt)', 'AIRPORT', 11.7506, 108.3742, 27, true),
  ('VCL', 'Sân bay Chu Lai (Quảng Nam / Quảng Ngãi)', 'AIRPORT', 15.4061, 108.7056, 24, true),
  ('HPH', 'Sân bay Quốc tế Cát Bi (Hải Phòng)', 'AIRPORT', 20.8192, 106.7247, 4, true),
  ('VDO', 'Sân bay Quốc tế Vân Đồn (Quảng Ninh)', 'AIRPORT', 21.1192, 107.4144, 14, true),
  ('VII', 'Sân bay Quốc tế Vinh', 'AIRPORT', 18.7278, 105.6711, 21, true),
  ('HUI', 'Sân bay Quốc tế Phú Bài (Huế)', 'AIRPORT', 16.4011, 107.7028, 7, true),
  ('THD', 'Sân bay Thọ Xuân (Thanh Hóa)', 'AIRPORT', 19.9011, 105.4678, 20, true),
  ('VDH', 'Sân bay Đồng Hới (Quảng Bình)', 'AIRPORT', 17.5153, 106.5906, 23, true),
  ('PXU', 'Sân bay Pleiku (Gia Lai)', 'AIRPORT', 14.0044, 108.0169, 28, true),
  ('BMV', 'Sân bay Buôn Ma Thuột (Đắk Lắk)', 'AIRPORT', 12.6681, 108.1203, 29, true),
  ('DIN', 'Sân bay Điện Biên Phủ', 'AIRPORT', 21.3972, 103.0078, 53, true),
  ('VCA', 'Sân bay Quốc tế Cần Thơ', 'AIRPORT', 10.0853, 105.7119, 6, true),
  ('CAH', 'Sân bay Cà Mau', 'AIRPORT', 9.1764, 105.1789, 33, true),
  ('PQC', 'Sân bay Quốc tế Phú Quốc', 'AIRPORT', 10.1698, 103.9931, 102, true),
  ('VCS', 'Sân bay Côn Đảo', 'AIRPORT', 8.7317, 106.6328, 9, true),
  ('UIH', 'Sân bay Phù Cát (Quy Nhơn)', 'AIRPORT', 13.9553, 109.0422, 25, true),

  -- 2. Ga tàu hỏa chính (Trục Bắc - Nam & Ga kết nối du lịch)
  ('GA_SAIGON', 'Ga Sài Gòn', 'TRAIN_STATION', 10.7828, 106.6781, 3, true),
  ('GA_HANOI', 'Ga Hà Nội', 'TRAIN_STATION', 21.0244, 105.8411, 2, true),
  ('GA_DANANG', 'Ga Đà Nẵng', 'TRAIN_STATION', 16.0717, 108.2125, 5, true),
  ('GA_HUE', 'Ga Huế', 'TRAIN_STATION', 16.4578, 107.5794, 7, true),
  ('GA_NHATRANG', 'Ga Nha Trang', 'TRAIN_STATION', 12.2478, 109.1836, 26, true),
  ('GA_VINH', 'Ga Vinh', 'TRAIN_STATION', 18.6811, 105.6669, 21, true),
  ('GA_DONGHOI', 'Ga Đồng Hới', 'TRAIN_STATION', 17.4722, 106.6028, 23, true),
  ('GA_THAPCHAM', 'Ga Tháp Chàm (Phan Rang - Cửa ngõ Đà Lạt)', 'TRAIN_STATION', 11.5975, 108.9567, 80, true),
  ('GA_LAOCAI', 'Ga Lào Cai (Cửa ngõ Sa Pa)', 'TRAIN_STATION', 22.4883, 103.9781, 17, true),
  ('GA_DIEUTRI', 'Ga Diêu Trì (Cửa ngõ Quy Nhơn)', 'TRAIN_STATION', 13.8050, 109.1417, 25, true),
  ('GA_TAMKY', 'Ga Tam Kỳ (Quảng Nam)', 'TRAIN_STATION', 15.5714, 108.4722, 24, true),
  ('GA_THANHHOA', 'Ga Thanh Hóa', 'TRAIN_STATION', 19.8058, 105.7667, 20, true),
  ('GA_NINHBINH', 'Ga Ninh Bình', 'TRAIN_STATION', 20.2458, 105.9753, 68, true),

  -- 3. Bến xe khách đầu mối lớn
  ('BX_MIENDONG', 'Bến xe Miền Đông Mới (TP.HCM)', 'BUS_TERMINAL', 10.8653, 106.8122, 3, true),
  ('BX_MIENTAY', 'Bến xe Miền Tây (TP.HCM)', 'BUS_TERMINAL', 10.7511, 106.6139, 3, true),
  ('BX_MYDINH', 'Bến xe Mỹ Đình (Hà Nội)', 'BUS_TERMINAL', 21.0286, 105.7778, 2, true),
  ('BX_GIAPBAT', 'Bến xe Giáp Bát (Hà Nội)', 'BUS_TERMINAL', 20.9806, 105.8417, 2, true),
  ('BX_TT_DANANG', 'Bến xe Trung tâm Đà Nẵng', 'BUS_TERMINAL', 16.0494, 108.1719, 5, true),
  ('BX_LIENTINH_DALAT', 'Bến xe Liên tỉnh Đà Lạt', 'BUS_TERMINAL', 11.9286, 108.4489, 27, true),

  -- 4. Bến cảng tàu cao tốc & phà biển đi đảo
  ('BEN_RACHGIA', 'Cảng Bến tàu Rạch Giá (Đi Phú Quốc)', 'FERRY_TERMINAL', 10.0131, 105.0744, 31, true),
  ('BEN_HATIEN', 'Bến phà / Tàu cao tốc Hà Tiên (Đi Phú Quốc)', 'FERRY_TERMINAL', 10.3756, 104.4756, 31, true),
  ('BEN_TRANDE', 'Cảng Trần Đề (Tàu cao tốc đi Côn Đảo)', 'FERRY_TERMINAL', 9.4897, 106.2081, 32, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  hub_type = EXCLUDED.hub_type,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  area_id = EXCLUDED.area_id,
  is_active = EXCLUDED.is_active;

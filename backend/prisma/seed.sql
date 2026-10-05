-- =============================================================================
-- TRIPGENIE — SEED DATA (34 Tỉnh/Thành Sáp Nhập & Chi Tiết Đà Nẵng)
-- =============================================================================

-- 1. CATEGORIES DU LỊCH CHUẨN
INSERT INTO categories (name, name_vi, slug, icon_url, sort_order) VALUES
  ('Attraction',      'Điểm tham quan',     'diem-tham-quan', 'landmark',      1),
  ('Historical',      'Di tích lịch sử',    'di-tich-lich-su', 'monument',      2),
  ('Nature & Beach',  'Thiên nhiên & Biển', 'thien-nhien',    'mountain-sun',  3),
  ('Restaurant',      'Nhà hàng ẩm thực',   'nha-hang',       'utensils',      4),
  ('Cafe & Dessert',  'Cà phê & Tráng miệng', 'ca-phe',       'coffee',        5),
  ('Street Food',     'Ẩm thực đường phố',  'an-vat-via-he',  'bowl-food',     6),
  ('Entertainment',   'Vui chơi giải trí',  'vui-choi',       'ticket',        7),
  ('Shopping & Market','Chợ & Mua sắm',     'cho-sieu-thi',   'bag-shopping',  8),
  ('Hotel & Resort',  'Khách sạn & Resort', 'khach-san',      'hotel',         9),
  ('Homestay',        'Homestay nghỉ dưỡng', 'homestay',      'house',         10),
  ('Bar & Nightlife', 'Bar & Cuộc sống đêm', 'bar-pub',       'martini-glass', 11),
  ('Spa & Wellness',  'Spa & Chăm sóc sức khỏe', 'spa',       'spa',           12)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_vi = EXCLUDED.name_vi,
  icon_url = EXCLUDED.icon_url,
  sort_order = EXCLUDED.sort_order;

-- 2. QUỐC GIA VIỆT NAM (ROOT)
INSERT INTO travel_areas (name, name_vi, slug, type, code, parent_id, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng)
VALUES ('Vietnam', 'Việt Nam', 'viet-nam', 'COUNTRY', 'VN', NULL, 8.18, 23.39, 102.14, 109.46)
ON CONFLICT (slug) DO NOTHING;

-- 3. DANH SÁCH 34 TỈNH / THÀNH PHỐ SAU SÁP NHẬP
DO $$
DECLARE
    v_vn_id INT;
    v_danang_id INT;
    v_son_tra_id INT;
    v_hoa_vang_id INT;
    v_ngu_hanh_son_id INT;
BEGIN
    SELECT id INTO v_vn_id FROM travel_areas WHERE slug = 'viet-nam' LIMIT 1;

    -- Danh sách 34 Tỉnh/Thành
    INSERT INTO travel_areas (name, name_vi, slug, type, code, parent_id, old_names, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, boundary)
    VALUES
      ('Hanoi City', 'Thành phố Hà Nội', 'ha-noi', 'CITY', '01', v_vn_id, ARRAY[]::TEXT[], 20.56, 21.38, 105.28, 106.02,
       ST_Multi(ST_MakeEnvelope(105.28, 20.56, 106.02, 21.38, 4326))::geography),
      ('Ho Chi Minh City', 'Thành phố Hồ Chí Minh', 'ho-chi-minh', 'CITY', '79', v_vn_id, ARRAY[]::TEXT[], 10.37, 11.16, 106.36, 107.03,
       ST_Multi(ST_MakeEnvelope(106.36, 10.37, 107.03, 11.16, 4326))::geography),
      ('Hai Phong City', 'Thành phố Hải Phòng', 'hai-phong', 'CITY', '31', v_vn_id, ARRAY['Hải Dương'], 20.55, 21.05, 106.40, 107.10,
       ST_Multi(ST_MakeEnvelope(106.40, 20.55, 107.10, 21.05, 4326))::geography),
      ('Da Nang City', 'Thành phố Đà Nẵng', 'da-nang', 'CITY', '48', v_vn_id, ARRAY[]::TEXT[], 15.90, 16.22, 107.90, 108.38,
       ST_Multi(ST_MakeEnvelope(107.90, 15.90, 108.38, 16.22, 4326))::geography),
      ('Can Tho City', 'Thành phố Cần Thơ', 'can-tho', 'CITY', '92', v_vn_id, ARRAY['Hậu Giang', 'Sóc Trăng'], 9.50, 10.33, 105.25, 106.10,
       ST_Multi(ST_MakeEnvelope(105.25, 9.50, 106.10, 10.33, 4326))::geography),
      ('Hue City', 'Thành phố Huế', 'hue', 'CITY', '46', v_vn_id, ARRAY['Thừa Thiên Huế'], 16.00, 16.80, 107.00, 108.20,
       ST_Multi(ST_MakeEnvelope(107.00, 16.00, 108.20, 16.80, 4326))::geography),
      ('Dong Thap', 'Tỉnh Đồng Tháp', 'dong-thap', 'PROVINCE', '87', v_vn_id, ARRAY['Long An', 'Tiền Giang'], 10.10, 11.05, 105.15, 106.80, NULL),
      ('Dong Nai', 'Tỉnh Đồng Nai', 'dong-nai', 'PROVINCE', '75', v_vn_id, ARRAY['Bà Rịa - Vũng Tàu', 'Bình Dương'], 10.30, 11.55, 106.50, 107.60, NULL),
      ('Nam Dinh', 'Tỉnh Nam Định', 'nam-dinh', 'PROVINCE', '35', v_vn_id, ARRAY['Hà Nam', 'Ninh Bình'], 19.90, 20.60, 105.50, 106.50, NULL),
      ('Phu Tho', 'Tỉnh Phú Thọ', 'phu-tho', 'PROVINCE', '25', v_vn_id, ARRAY['Vĩnh Phúc', 'Tuyên Quang'], 20.90, 22.30, 104.80, 105.80, NULL),
      ('Thai Nguyen', 'Tỉnh Thái Nguyên', 'thai-nguyen', 'PROVINCE', '19', v_vn_id, ARRAY['Bắc Kạn'], 21.30, 22.45, 105.45, 106.25, NULL),
      ('Bac Giang', 'Tỉnh Bắc Giang', 'bac-giang', 'PROVINCE', '24', v_vn_id, ARRAY['Bắc Ninh'], 21.05, 21.65, 105.90, 107.10, NULL),
      ('Quang Ninh', 'Tỉnh Quảng Ninh', 'quang-ninh', 'PROVINCE', '22', v_vn_id, ARRAY[]::TEXT[], 20.65, 21.60, 106.50, 108.10, NULL),
      ('Lang Son', 'Tỉnh Lạng Sơn', 'lang-son', 'PROVINCE', '20', v_vn_id, ARRAY['Cao Bằng'], 21.30, 23.10, 105.80, 107.35, NULL),
      ('Ha Giang', 'Tỉnh Hà Giang', 'ha-giang', 'PROVINCE', '03', v_vn_id, ARRAY[]::TEXT[], 22.15, 23.40, 104.35, 105.60, NULL),
      ('Lao Cai', 'Tỉnh Lào Cai', 'lao-cai', 'PROVINCE', '10', v_vn_id, ARRAY['Yên Bái'], 21.35, 22.85, 103.50, 105.10, NULL),
      ('Son La', 'Tỉnh Sơn La', 'son-la', 'PROVINCE', '14', v_vn_id, ARRAY['Điện Biên'], 20.60, 22.35, 102.15, 105.05, NULL),
      ('Hoa Binh', 'Tỉnh Hòa Bình', 'hoa-binh', 'PROVINCE', '17', v_vn_id, ARRAY[]::TEXT[], 20.30, 21.10, 104.80, 105.90, NULL),
      ('Thanh Hoa', 'Tỉnh Thanh Hóa', 'thanh-hoa', 'PROVINCE', '38', v_vn_id, ARRAY[]::TEXT[], 19.30, 20.70, 104.35, 106.10, NULL),
      ('Nghe An', 'Tỉnh Nghệ An', 'nghe-an', 'PROVINCE', '40', v_vn_id, ARRAY[]::TEXT[], 18.55, 20.00, 103.85, 105.80, NULL),
      ('Ha Tinh', 'Tỉnh Hà Tĩnh', 'ha-tinh', 'PROVINCE', '42', v_vn_id, ARRAY[]::TEXT[], 17.90, 18.75, 105.05, 106.55, NULL),
      ('Quang Binh', 'Tỉnh Quảng Bình', 'quang-binh', 'PROVINCE', '44', v_vn_id, ARRAY['Quảng Trị'], 16.30, 18.10, 105.60, 107.40, NULL),
      ('Quang Nam', 'Tỉnh Quảng Nam', 'quang-nam', 'PROVINCE', '49', v_vn_id, ARRAY[]::TEXT[], 14.95, 16.05, 107.20, 108.70, NULL),
      ('Quang Ngai', 'Tỉnh Quảng Ngãi', 'quang-ngai', 'PROVINCE', '51', v_vn_id, ARRAY['Bình Định'], 13.50, 15.45, 108.35, 109.35, NULL),
      ('Khanh Hoa', 'Tỉnh Khánh Hòa', 'khanh-hoa', 'PROVINCE', '56', v_vn_id, ARRAY['Phú Yên', 'Ninh Thuận'], 11.30, 13.70, 108.65, 109.50, NULL),
      ('Lam Dong', 'Tỉnh Lâm Đồng', 'lam-dong', 'PROVINCE', '68', v_vn_id, ARRAY['Bình Thuận', 'Đắk Nông'], 10.55, 12.50, 107.25, 108.95, NULL),
      ('Gia Lai', 'Tỉnh Gia Lai', 'gia-lai', 'PROVINCE', '64', v_vn_id, ARRAY['Kon Tum'], 13.00, 15.45, 107.35, 108.90, NULL),
      ('Dak Lak', 'Tỉnh Đắk Lắk', 'dak-lak', 'PROVINCE', '66', v_vn_id, ARRAY[]::TEXT[], 12.15, 13.45, 107.45, 109.15, NULL),
      ('Tay Ninh', 'Tỉnh Tây Ninh', 'tay-ninh', 'PROVINCE', '72', v_vn_id, ARRAY['Bình Phước'], 10.95, 12.30, 105.80, 107.40, NULL),
      ('An Giang', 'Tỉnh An Giang', 'an-giang', 'PROVINCE', '89', v_vn_id, ARRAY['Kiên Giang'], 9.40, 10.95, 103.75, 105.60, NULL),
      ('Vinh Long', 'Tỉnh Vĩnh Long', 'vinh-long', 'PROVINCE', '86', v_vn_id, ARRAY['Bến Tre', 'Trà Vinh'], 9.50, 10.35, 105.75, 106.85, NULL),
      ('Ca Mau', 'Tỉnh Cà Mau', 'ca-mau', 'PROVINCE', '96', v_vn_id, ARRAY['Bạc Liêu'], 8.55, 9.60, 104.70, 105.85, NULL),
      ('Hung Yen', 'Tỉnh Hưng Yên', 'hung-yen', 'PROVINCE', '33', v_vn_id, ARRAY['Thái Bình'], 20.30, 21.05, 105.85, 106.65, NULL),
      ('Lai Chau', 'Tỉnh Lai Châu', 'lai-chau', 'PROVINCE', '12', v_vn_id, ARRAY[]::TEXT[], 21.80, 22.85, 102.30, 103.95, NULL)
    ON CONFLICT (slug) DO UPDATE SET
      name_vi = EXCLUDED.name_vi,
      type = EXCLUDED.type,
      code = EXCLUDED.code,
      old_names = EXCLUDED.old_names,
      boundary = COALESCE(EXCLUDED.boundary, travel_areas.boundary);

    -- Lấy ID của Đà Nẵng để gán cho các quận huyện
    SELECT id INTO v_danang_id FROM travel_areas WHERE slug = 'da-nang' LIMIT 1;

    -- 4. CẤP QUẬN / HUYỆN CỦA ĐÀ NẴNG (DISTRICTS)
    INSERT INTO travel_areas (name, name_vi, slug, type, code, parent_id, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, boundary)
    VALUES
      ('Hai Chau', 'Quận Hải Châu', 'hai-chau-da-nang', 'DISTRICT', '490', v_danang_id, 16.0200, 16.0850, 108.2000, 108.2350,
       ST_Multi(ST_MakeEnvelope(108.2000, 16.0200, 108.2350, 16.0850, 4326))::geography),
      ('Son Tra', 'Quận Sơn Trà', 'son-tra-da-nang', 'DISTRICT', '492', v_danang_id, 16.0500, 16.1400, 108.2200, 108.3200,
       ST_Multi(ST_MakeEnvelope(108.2200, 16.0500, 108.3200, 16.1400, 4326))::geography),
      ('Ngu Hanh Son', 'Quận Ngũ Hành Sơn', 'ngu-hanh-son-da-nang', 'DISTRICT', '493', v_danang_id, 15.9600, 16.0500, 108.2300, 108.2900,
       ST_Multi(ST_MakeEnvelope(108.2300, 15.9600, 108.2900, 16.0500, 4326))::geography),
      ('Thanh Khe', 'Quận Thanh Khê', 'thanh-khe-da-nang', 'DISTRICT', '491', v_danang_id, 16.0500, 16.0800, 108.1600, 108.2100,
       ST_Multi(ST_MakeEnvelope(108.1600, 16.0500, 108.2100, 16.0800, 4326))::geography),
      ('Lien Chieu', 'Quận Liên Chiểu', 'lien-chieu-da-nang', 'DISTRICT', '494', v_danang_id, 16.0700, 16.1700, 108.0800, 108.1800,
       ST_Multi(ST_MakeEnvelope(108.0800, 16.0700, 108.1800, 16.1700, 4326))::geography),
      ('Cam Le', 'Quận Cẩm Lệ', 'cam-le-da-nang', 'DISTRICT', '495', v_danang_id, 15.9900, 16.0400, 108.1600, 108.2300,
       ST_Multi(ST_MakeEnvelope(108.1600, 15.9900, 108.2300, 16.0400, 4326))::geography),
      ('Hoa Vang', 'Huyện Hòa Vang', 'hoa-vang-da-nang', 'DISTRICT', '497', v_danang_id, 15.9000, 16.2000, 107.9000, 108.1800,
       ST_Multi(ST_MakeEnvelope(107.9000, 15.9000, 108.1800, 16.2000, 4326))::geography)
    ON CONFLICT (slug) DO UPDATE SET
      name_vi = EXCLUDED.name_vi,
      parent_id = EXCLUDED.parent_id,
      code = EXCLUDED.code,
      boundary = COALESCE(EXCLUDED.boundary, travel_areas.boundary);

    -- Lấy ID các quận để gán cho các ZONES du lịch nổi tiếng
    SELECT id INTO v_son_tra_id FROM travel_areas WHERE slug = 'son-tra-da-nang' LIMIT 1;
    SELECT id INTO v_hoa_vang_id FROM travel_areas WHERE slug = 'hoa-vang-da-nang' LIMIT 1;
    SELECT id INTO v_ngu_hanh_son_id FROM travel_areas WHERE slug = 'ngu-hanh-son-da-nang' LIMIT 1;

    -- 5. CÁC KHU DU LỊCH ĐẶC THÙ (ZONES)
    INSERT INTO travel_areas (name, name_vi, slug, type, parent_id, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng)
    VALUES
      ('Son Tra Peninsula', 'Bán đảo Sơn Trà', 'ban-dao-son-tra', 'ZONE', v_son_tra_id, 16.0900, 16.1500, 108.2400, 108.3300),
      ('Ba Na Hills', 'Khu du lịch Bà Nà Hills', 'ba-na-hills', 'ZONE', v_hoa_vang_id, 15.9800, 16.0200, 107.9700, 108.0100),
      ('Marble Mountains', 'Danh thắng Ngũ Hành Sơn', 'danh-thang-ngu-hanh-son', 'ZONE', v_ngu_hanh_son_id, 16.0000, 16.0200, 108.2500, 108.2700)
    ON CONFLICT (slug) DO NOTHING;

END $$;

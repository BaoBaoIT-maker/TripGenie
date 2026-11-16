-- =============================================================================
-- TRIPGENIE — BASE SEED DATA (Categories & Root Country)
-- Administrative provinces, real GeoJSON boundaries, bboxes, districts, and
-- tourist zones are seeded in seed_geojson.js (via `npm run seed`).
-- =============================================================================

-- 1. CATEGORIES DU LỊCH CHUẨN (12 danh mục)
INSERT INTO categories (name, name_vi, slug, icon_url, sort_order) VALUES
  ('Attraction',       'Điểm tham quan',          'diem-tham-quan', 'landmark',      1),
  ('Historical',       'Di tích lịch sử',         'di-tich-lich-su', 'monument',      2),
  ('Nature & Beach',   'Thiên nhiên & Biển',      'thien-nhien',    'mountain-sun',  3),
  ('Restaurant',       'Nhà hàng ẩm thực',        'nha-hang',       'utensils',      4),
  ('Cafe & Dessert',   'Cà phê & Tráng miệng',    'ca-phe',         'coffee',        5),
  ('Street Food',      'Ẩm thực đường phố',       'an-vat-via-he',  'bowl-food',     6),
  ('Entertainment',    'Vui chơi giải trí',       'vui-choi',       'ticket',        7),
  ('Shopping & Market','Chợ & Mua sắm',           'cho-sieu-thi',   'bag-shopping',  8),
  ('Hotel & Resort',   'Khách sạn & Resort',      'khach-san',      'hotel',         9),
  ('Homestay',         'Homestay nghỉ dưỡng',     'homestay',       'house',         10),
  ('Bar & Nightlife',  'Bar & Cuộc sống đêm',     'bar-pub',        'martini-glass', 11),
  ('Spa & Wellness',   'Spa & Chăm sóc sức khỏe', 'spa',            'spa',           12)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_vi = EXCLUDED.name_vi,
  icon_url = EXCLUDED.icon_url,
  sort_order = EXCLUDED.sort_order;

-- 2. QUỐC GIA VIỆT NAM (ROOT COUNTRY)
INSERT INTO travel_areas (name, name_vi, slug, type, code, parent_id, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng)
VALUES ('Vietnam', 'Việt Nam', 'viet-nam', 'COUNTRY', 'VN', NULL, 8.18, 23.39, 102.14, 109.46)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_vi = EXCLUDED.name_vi,
  code = EXCLUDED.code,
  bbox_min_lat = EXCLUDED.bbox_min_lat,
  bbox_max_lat = EXCLUDED.bbox_max_lat,
  bbox_min_lng = EXCLUDED.bbox_min_lng,
  bbox_max_lng = EXCLUDED.bbox_max_lng;

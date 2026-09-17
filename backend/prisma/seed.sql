-- ============================================================
-- SEED: categories
-- ============================================================
INSERT INTO categories (name, name_vi, slug, sort_order) VALUES
  ('Restaurant',     'Nha hang',          'nha-hang',       1),
  ('Cafe',           'Ca phe',            'ca-phe',         2),
  ('Street Food',    'An vat - Via he',   'an-vat',         3),
  ('Bar & Pub',      'Bar & Pub',         'bar-pub',        4),
  ('Attraction',     'Diem tham quan',    'diem-tham-quan', 5),
  ('Beach',          'Bai bien',          'bai-bien',       6),
  ('Historical',     'Di tich lich su',   'di-tich',        7),
  ('Nature',         'Thien nhien',       'thien-nhien',    8),
  ('Hotel',          'Khach san',         'khach-san',      9),
  ('Homestay',       'Homestay',          'homestay',       10),
  ('Shopping',       'Mua sam',           'mua-sam',        11),
  ('Entertainment',  'Vui choi giai tri', 'vui-choi',       12),
  ('Sport',          'The thao',          'the-thao',       13),
  ('Spa & Wellness', 'Spa thu gian',      'spa',            14),
  ('Market',         'Cho sieu thi',      'cho-sieu-thi',   15)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: travel_areas — 7 Tier-1 provinces + 5 Tier-2
-- ============================================================
INSERT INTO travel_areas (name, name_vi, slug, type, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng) VALUES

  -- TIER 1: Top 7 tourist destinations
  ('Da Nang',    'Da Nang',    'da-nang',    'CITY',     15.9700, 16.1600, 107.9800, 108.3600),
  ('Hoi An',     'Hoi An',     'hoi-an',     'DISTRICT', 15.8500, 15.9400, 108.2800, 108.4000),
  ('Ho Chi Minh City', 'TP Ho Chi Minh', 'ho-chi-minh', 'CITY', 10.3500, 11.0500, 106.3600, 107.0200),
  ('Hanoi',      'Ha Noi',     'ha-noi',     'CITY',     20.7500, 21.2000, 105.5000, 106.0200),
  ('Ha Long',    'Ha Long',    'ha-long',    'CITY',     20.8500, 21.0800, 106.9500, 107.2000),
  ('Nha Trang',  'Nha Trang',  'nha-trang',  'CITY',     11.9600, 12.3200, 109.0600, 109.3200),
  ('Phu Quoc',   'Phu Quoc',   'phu-quoc',   'DISTRICT', 9.7900,  10.4600, 103.8000, 104.1200),

  -- TIER 2: Trending destinations
  ('Da Lat',     'Da Lat',     'da-lat',     'CITY',     11.8300, 12.0600, 108.3000, 108.5400),
  ('Hue',        'Hue',        'hue',        'CITY',     16.2500, 16.6000, 107.3000, 107.7000),
  ('Sa Pa',      'Sa Pa',      'sa-pa',      'DISTRICT', 22.2500, 22.4300, 103.7800, 103.9500),
  ('Phan Thiet', 'Phan Thiet', 'phan-thiet', 'CITY',     10.8800, 11.0800, 107.9500, 108.1500),
  ('Quy Nhon',   'Quy Nhon',   'quy-nhon',   'CITY',     13.6000, 14.0000, 108.9000, 109.2500)

ON CONFLICT (slug) DO NOTHING;

-- Verify
SELECT 'categories' AS tbl, COUNT(*) FROM categories
UNION ALL
SELECT 'travel_areas', COUNT(*) FROM travel_areas;

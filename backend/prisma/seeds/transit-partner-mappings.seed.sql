-- =============================================================================
-- TRIPGENIE — SEED DATA: TRANSIT PARTNER MAPPINGS (VeXeRe, DSVN, Traveloka)
-- Follows AGENTS.md & backend.md: Pure standard SQL, idempotent (ON CONFLICT DO UPDATE)
-- =============================================================================

CREATE TABLE IF NOT EXISTS transit_partner_mappings (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  hub_type VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  external_id VARCHAR(50) NOT NULL,
  area_id INT REFERENCES travel_areas(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_transit_partner_route UNIQUE (provider, hub_type, slug)
);

CREATE INDEX IF NOT EXISTS idx_transit_partner_lookup ON transit_partner_mappings (provider, hub_type);
CREATE INDEX IF NOT EXISTS idx_transit_partner_area ON transit_partner_mappings (area_id);

INSERT INTO transit_partner_mappings (provider, hub_type, name, slug, external_id, area_id, metadata)
VALUES
  -- 1. VeXeRe Xe khách (BUS)
  ('VEXERE', 'BUS', 'Sài Gòn - TP.HCM', 'sai-gon', '129', 3, '{"aliases": ["sài gòn", "tp. hồ chí minh", "hồ chí minh", "tphcm", "sg"]}'::jsonb),
  ('VEXERE', 'BUS', 'Hà Nội', 'ha-noi', '124', 2, '{"aliases": ["hà nội", "hn", "thủ đô"]}'::jsonb),
  ('VEXERE', 'BUS', 'Đà Nẵng', 'da-nang', '115', 5, '{"aliases": ["đà nẵng", "dn"]}'::jsonb),
  ('VEXERE', 'BUS', 'Đà Lạt - Lâm Đồng', 'da-lat', '137', 88, '{"aliases": ["đà lạt", "lâm đồng"]}'::jsonb),
  ('VEXERE', 'BUS', 'Nha Trang - Khánh Hòa', 'nha-trang', '139', 26, '{"aliases": ["nha trang", "khánh hòa"]}'::jsonb),
  ('VEXERE', 'BUS', 'Vũng Tàu', 'vung-tau', '16', 9, '{"aliases": ["vũng tàu", "bà rịa"]}'::jsonb),
  ('VEXERE', 'BUS', 'Cần Thơ', 'can-tho', '113', 6, '{"aliases": ["cần thơ"]}'::jsonb),
  ('VEXERE', 'BUS', 'Huế', 'thua-thien-hue', '158', 7, '{"aliases": ["huế", "thừa thiên huế"]}'::jsonb),
  ('VEXERE', 'BUS', 'Phú Quốc - Kiên Giang', 'kien-giang', '138', 31, '{"aliases": ["phú quốc", "kiên giang", "rạch giá", "hà tiên"]}'::jsonb),
  ('VEXERE', 'BUS', 'Hội An - Quảng Nam', 'quang-nam', '147', 87, '{"aliases": ["hội an", "quảng nam", "tam kỳ"]}'::jsonb),
  ('VEXERE', 'BUS', 'Quy Nhơn - Bình Định', 'binh-dinh', '18', 25, '{"aliases": ["quy nhơn", "bình định"]}'::jsonb),
  ('VEXERE', 'BUS', 'Phan Thiết - Bình Thuận', 'binh-thuan', '19', 27, '{"aliases": ["phan thiết", "mũi né", "bình thuận"]}'::jsonb),
  ('VEXERE', 'BUS', 'Buôn Ma Thuột - Đắk Lắk', 'dak-lak', '120', 29, '{"aliases": ["buôn ma thuột", "đắk lắk", "bmt"]}'::jsonb),
  ('VEXERE', 'BUS', 'Sa Pa - Lào Cai', 'lao-cai', '140', 17, '{"aliases": ["sa pa", "sapa", "lào cai"]}'::jsonb),
  ('VEXERE', 'BUS', 'Ninh Bình', 'ninh-binh', '143', 68, '{"aliases": ["ninh bình", "tràng an"]}'::jsonb),
  ('VEXERE', 'BUS', 'Đồng Hới - Quảng Bình', 'quang-binh', '146', 23, '{"aliases": ["đồng hới", "quảng bình", "phong nha"]}'::jsonb),
  ('VEXERE', 'BUS', 'Hải Phòng', 'hai-phong', '127', 4, '{"aliases": ["hải phòng", "cát bà"]}'::jsonb),
  ('VEXERE', 'BUS', 'Hạ Long - Quảng Ninh', 'quang-ninh', '148', 14, '{"aliases": ["hạ long", "quảng ninh"]}'::jsonb),
  ('VEXERE', 'BUS', 'Cà Mau', 'ca-mau', '112', 33, '{"aliases": ["cà mau"]}'::jsonb),
  ('VEXERE', 'BUS', 'Hà Tĩnh', 'ha-tinh', '125', 22, '{"aliases": ["hà tĩnh"]}'::jsonb),
  ('VEXERE', 'BUS', 'Thanh Hóa', 'thanh-hoa', '157', 20, '{"aliases": ["thanh hóa", "sầm sơn"]}'::jsonb),
  ('VEXERE', 'BUS', 'Vinh - Nghệ An', 'nghe-an', '142', 21, '{"aliases": ["vinh", "nghệ an", "cửa lò"]}'::jsonb),

  -- 2. VeXeRe Tàu hỏa (TRAIN)
  ('VEXERE', 'TRAIN', 'Ga Sài Gòn', 'sai-gon', 'GA_SAIGON', 3, '{"aliases": ["sài gòn", "tp. hồ chí minh", "hồ chí minh"]}'::jsonb),
  ('VEXERE', 'TRAIN', 'Ga Hà Nội', 'ha-noi', 'GA_HANOI', 2, '{"aliases": ["hà nội"]}'::jsonb),
  ('VEXERE', 'TRAIN', 'Ga Đà Nẵng', 'da-nang', 'GA_DANANG', 5, '{"aliases": ["đà nẵng"]}'::jsonb),
  ('VEXERE', 'TRAIN', 'Ga Nha Trang', 'nha-trang', 'GA_NHATRANG', 26, '{"aliases": ["nha trang", "khánh hòa"]}'::jsonb),
  ('VEXERE', 'TRAIN', 'Ga Huế', 'thua-thien-hue', 'GA_HUE', 7, '{"aliases": ["huế", "thừa thiên huế"]}'::jsonb),
  ('VEXERE', 'TRAIN', 'Ga Vinh', 'nghe-an', 'GA_VINH', 21, '{"aliases": ["vinh", "nghệ an"]}'::jsonb),
  ('VEXERE', 'TRAIN', 'Ga Đồng Hới', 'quang-binh', 'GA_DONGHOI', 23, '{"aliases": ["đồng hới", "quảng bình"]}'::jsonb),
  ('VEXERE', 'TRAIN', 'Ga Thanh Hóa', 'thanh-hoa', 'GA_THANHHOA', 20, '{"aliases": ["thanh hóa"]}'::jsonb),
  ('VEXERE', 'TRAIN', 'Ga Ninh Bình', 'ninh-binh', 'GA_NINHBINH', 68, '{"aliases": ["ninh bình"]}'::jsonb)
ON CONFLICT (provider, hub_type, slug) DO UPDATE SET
  name = EXCLUDED.name,
  external_id = EXCLUDED.external_id,
  area_id = EXCLUDED.area_id,
  metadata = EXCLUDED.metadata;

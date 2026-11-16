const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DEFAULT_DB_URL = 'postgresql://postgres:postgres@localhost:5432/travel_db?schema=public';

// Ánh xạ tên cũ (sáp nhập) chuẩn theo Nghị quyết 202/2025/QH15
const PROVINCE_OLD_NAMES = {
  'Hải Phòng': ['Hải Dương'],
  'Đà Nẵng': ['Quảng Nam'],
  'TP. Hồ Chí Minh': ['Bình Dương', 'Bà Rịa - Vũng Tàu'],
  'Cần Thơ': ['Sóc Trăng', 'Hậu Giang'],
  'Tuyên Quang': ['Hà Giang'],
  'Lào Cai': ['Yên Bái'],
  'Thái Nguyên': ['Bắc Kạn'],
  'Phú Thọ': ['Vĩnh Phúc', 'Hòa Bình'],
  'Bắc Ninh': ['Bắc Giang'],
  'Hưng Yên': ['Thái Bình'],
  'Ninh Bình': ['Hà Nam', 'Nam Định'],
  'Quảng Trị': ['Quảng Bình'],
  'Quảng Ngãi': ['Kon Tum'],
  'Gia Lai': ['Bình Định'],
  'Khánh Hòa': ['Ninh Thuận'],
  'Lâm Đồng': ['Bình Thuận', 'Đắk Nông'],
  'Đắk Lắk': ['Phú Yên'],
  'Đồng Nai': ['Bình Phước'],
  'Tây Ninh': ['Long An'],
  'Vĩnh Long': ['Bến Tre', 'Trà Vinh'],
  'Đồng Tháp': ['Tiền Giang'],
  'Cà Mau': ['Bạc Liêu'],
  'An Giang': ['Kiên Giang'],
};

const PROVINCE_SLUG_OVERRIDES = {
  'TP. Hồ Chí Minh': 'ho-chi-minh',
};

const CENTRAL_CITY_EN_NAMES = {
  'ha-noi': 'Hanoi City',
  'ho-chi-minh': 'Ho Chi Minh City',
  'hai-phong': 'Hai Phong City',
  'da-nang': 'Da Nang City',
  'can-tho': 'Can Tho City',
  hue: 'Hue City',
};

/**
 * Core urban bounding boxes for post-merger coastal/extended municipalities.
 * Keeps `boundary` as the full GeoJSON territory while ensuring TransitService center
 * resolution and local place crawls anchor on the urban core rather than outlying anexes.
 */
const METRO_BBOX_OVERRIDES = {
  'ho-chi-minh': { minLat: 10.37, maxLat: 11.16, minLng: 106.36, maxLng: 107.03 },
  'da-nang': { minLat: 15.84, maxLat: 16.22, minLng: 107.90, maxLng: 108.42 },
  'hai-phong': { minLat: 20.55, maxLat: 21.05, minLng: 106.40, maxLng: 107.10 },
  'can-tho': { minLat: 9.50, maxLat: 10.33, minLng: 105.25, maxLng: 106.10 },
};

// Slug cũ (trước sáp nhập / trùng tên / quận cũ Đà Nẵng) -> slug chuẩn để migrate an toàn trước khi xóa
const LEGACY_AREA_MIGRATIONS = {
  'tp-ho-chi-minh': 'ho-chi-minh',
  'ha-giang': 'tuyen-quang',
  'nam-dinh': 'ninh-binh',
  'bac-giang': 'bac-ninh',
  'quang-binh': 'quang-tri',
  'quang-nam': 'da-nang',
  'hoa-binh': 'phu-tho',
  'hoi-an-da-nang': 'hoi-an',
  'hai-chau-da-nang': 'da-nang',
  'son-tra-da-nang': 'da-nang',
  'ngu-hanh-son-da-nang': 'da-nang',
  'thanh-khe-da-nang': 'da-nang',
  'lien-chieu-da-nang': 'da-nang',
  'cam-le-da-nang': 'da-nang',
  'hoa-vang-da-nang': 'da-nang',
};

// Các khu/điểm du lịch trọng điểm trực thuộc tỉnh mới sau sáp nhập (Phương án 2)
const TOURIST_ZONES = [
  // Đà Nẵng scenic zones (gắn trực tiếp về da-nang)
  { name: 'Son Tra Peninsula', nameVi: 'Bán đảo Sơn Trà', slug: 'ban-dao-son-tra', parentSlug: 'da-nang', minLat: 16.09, maxLat: 16.15, minLng: 108.24, maxLng: 108.33 },
  { name: 'Ba Na Hills', nameVi: 'Khu du lịch Bà Nà Hills', slug: 'ba-na-hills', parentSlug: 'da-nang', minLat: 15.98, maxLat: 16.02, minLng: 107.97, maxLng: 108.01 },
  { name: 'Marble Mountains', nameVi: 'Danh thắng Ngũ Hành Sơn', slug: 'danh-thang-ngu-hanh-son', parentSlug: 'da-nang', minLat: 16.00, maxLat: 16.02, minLng: 108.25, maxLng: 108.27 },
  // Major regional tourist hubs under post-merger provinces
  { name: 'Hoi An', nameVi: 'Hội An', slug: 'hoi-an', parentSlug: 'da-nang', code: '503', minLat: 15.85, maxLat: 15.94, minLng: 108.28, maxLng: 108.40 },
  { name: 'Phu Quoc', nameVi: 'Phú Quốc', slug: 'phu-quoc', parentSlug: 'an-giang', minLat: 9.99, maxLat: 10.46, minLng: 103.82, maxLng: 104.09 },
  { name: 'Da Lat', nameVi: 'Đà Lạt', slug: 'da-lat', parentSlug: 'lam-dong', minLat: 11.82, maxLat: 12.02, minLng: 108.35, maxLng: 108.58 },
  { name: 'Mui Ne - Phan Thiet', nameVi: 'Mũi Né - Phan Thiết', slug: 'mui-ne', parentSlug: 'lam-dong', minLat: 10.88, maxLat: 11.00, minLng: 108.08, maxLng: 108.34 },
  { name: 'Nha Trang', nameVi: 'Nha Trang', slug: 'nha-trang', parentSlug: 'khanh-hoa', minLat: 12.16, maxLat: 12.34, minLng: 109.10, maxLng: 109.26 },
  { name: 'Vung Tau', nameVi: 'Vũng Tàu', slug: 'vung-tau', parentSlug: 'ho-chi-minh', minLat: 10.30, maxLat: 10.46, minLng: 107.04, maxLng: 107.20 },
  { name: 'Con Dao', nameVi: 'Côn Đảo', slug: 'con-dao', parentSlug: 'ho-chi-minh', minLat: 8.62, maxLat: 8.76, minLng: 106.54, maxLng: 106.72 },
  { name: 'Sa Pa', nameVi: 'Sa Pa', slug: 'sa-pa', parentSlug: 'lao-cai', minLat: 22.24, maxLat: 22.42, minLng: 103.75, maxLng: 103.94 },
  { name: 'Ha Long', nameVi: 'Hạ Long', slug: 'ha-long', parentSlug: 'quang-ninh', minLat: 20.82, maxLat: 21.02, minLng: 106.95, maxLng: 107.25 },
  { name: 'Cat Ba', nameVi: 'Cát Bà', slug: 'cat-ba', parentSlug: 'hai-phong', minLat: 20.70, maxLat: 20.86, minLng: 106.94, maxLng: 107.12 },
  { name: 'Ly Son', nameVi: 'Lý Sơn', slug: 'ly-son', parentSlug: 'quang-ngai', minLat: 15.36, maxLat: 15.40, minLng: 109.08, maxLng: 109.15 },
];

function loadLocalEnv() {
  if (process.env.DATABASE_URL || typeof process.loadEnvFile !== 'function') return;
  try {
    process.loadEnvFile(path.resolve(__dirname, '../.env'));
  } catch {
    // Optional local .env file; production injects DATABASE_URL via environment
  }
}

function createDbClient(connectionString) {
  loadLocalEnv();
  const resolvedUrl = connectionString || process.env.DATABASE_URL || DEFAULT_DB_URL;
  const isLocal = /localhost|127\.0\.0\.1/.test(resolvedUrl);
  return new Client({
    connectionString: resolvedUrl,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
}

function stripVietnameseDiacritics(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();
}

function slugify(text) {
  return stripVietnameseDiacritics(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Computes bbox of the largest exterior polygon ring (mainland landmass) so coastal
 * provinces containing distant archipelagos (Hoàng Sa, Trường Sa, Phú Quý, Côn Đảo)
 * keep accurate mainland center coordinates while `boundary` stores the full MultiPolygon.
 */
function computeMainlandPolygonBbox(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let largestRing = polygons[0][0];
  let maxArea = -1;

  for (const polygon of polygons) {
    const ring = polygon[0];
    let area2 = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      area2 += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    const area = Math.abs(area2) / 2;
    if (area > maxArea) {
      maxArea = area;
      largestRing = ring;
    }
  }

  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  for (const [lng, lat] of largestRing) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return { minLat, maxLat, minLng, maxLng };
}

function buildProvinceSeedRecords(geojsonData) {
  return geojsonData.features.map((feature) => {
    const props = feature.properties || {};
    const nameVi = (props.ten_tinh || props.name || props.Ten || '').trim();
    const code = String(props.ma_tinh || props.id || props.Ma || '');
    const slug = PROVINCE_SLUG_OVERRIDES[nameVi] || slugify(nameVi);
    const type = CENTRAL_CITY_EN_NAMES[slug] ? 'CITY' : 'PROVINCE';
    const name = CENTRAL_CITY_EN_NAMES[slug] || stripVietnameseDiacritics(nameVi);
    const oldNames = PROVINCE_OLD_NAMES[nameVi] || [];
    const bbox = METRO_BBOX_OVERRIDES[slug] || computeMainlandPolygonBbox(feature.geometry);

    return {
      slug,
      name,
      nameVi,
      type,
      code,
      oldNames,
      bbox,
      geometryJson: JSON.stringify(feature.geometry),
    };
  });
}

async function migrateLegacyAreas(client) {
  const hasTransitHubs = Boolean(
    (await client.query("SELECT to_regclass('public.transit_hubs') AS tbl")).rows[0]?.tbl,
  );

  for (const [legacySlug, targetSlug] of Object.entries(LEGACY_AREA_MIGRATIONS)) {
    const res = await client.query(
      'SELECT slug, id FROM travel_areas WHERE slug = $1 OR slug = $2',
      [legacySlug, targetSlug],
    );
    const legacyId = res.rows.find((r) => r.slug === legacySlug)?.id;
    const targetId = res.rows.find((r) => r.slug === targetSlug)?.id;
    if (!legacyId || !targetId || legacyId === targetId) continue;

    await client.query('UPDATE travel_areas SET parent_id = $1 WHERE parent_id = $2', [targetId, legacyId]);
    await client.query('UPDATE places SET area_id = $1 WHERE area_id = $2', [targetId, legacyId]);
    await client.query('UPDATE itineraries SET area_id = $1 WHERE area_id = $2', [targetId, legacyId]);
    await client.query('UPDATE crawl_jobs SET area_id = $1 WHERE area_id = $2', [targetId, legacyId]);
    await client.query('UPDATE knowledge_documents SET area_id = $1 WHERE area_id = $2', [targetId, legacyId]);
    if (hasTransitHubs) {
      await client.query('UPDATE transit_hubs SET area_id = $1 WHERE area_id = $2', [targetId, legacyId]);
    }

    const covRes = await client.query('SELECT area_id FROM data_coverage WHERE area_id = $1', [targetId]);
    if (covRes.rows.length > 0) {
      await client.query('DELETE FROM data_coverage WHERE area_id = $1', [legacyId]);
    } else {
      await client.query('UPDATE data_coverage SET area_id = $1 WHERE area_id = $2', [targetId, legacyId]);
    }

    await client.query('DELETE FROM travel_areas WHERE id = $1', [legacyId]);
    console.log(`Migrated and removed legacy area '${legacySlug}' (id=${legacyId}) -> '${targetSlug}' (id=${targetId})`);
  }
}

async function seedGeoJson(existingClient = null) {
  const ownsClient = !existingClient;
  const client = existingClient || createDbClient();

  try {
    if (ownsClient) {
      await client.connect();
      console.log('Connected to PostgreSQL.');
    }

    await client.query('BEGIN');

    // 1. Ensure categories + Vietnam root country exist
    const seedSqlPath = path.join(__dirname, 'seed.sql');
    if (fs.existsSync(seedSqlPath)) {
      await client.query(fs.readFileSync(seedSqlPath, 'utf8'));
    }

    const vnRes = await client.query("SELECT id FROM travel_areas WHERE slug = 'viet-nam' LIMIT 1;");
    const vnId = vnRes.rows[0]?.id;
    if (!vnId) {
      throw new Error("Root area 'viet-nam' not found after seed.sql.");
    }

    // 2. Load and upsert 34 post-merger provinces from GeoJSON with full boundary + computed bbox
    const geoJsonPath = path.join(__dirname, 'vietnam_34_tinhthanh.geojson');
    const geojsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
    const provinces = buildProvinceSeedRecords(geojsonData);

    for (const prov of provinces) {
      await client.query(
        `
        INSERT INTO travel_areas (
          name, name_vi, slug, type, code, parent_id, old_names,
          bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, boundary
        )
        VALUES (
          $1, $2, $3, $4::area_type_enum, $5, $6, $7,
          $8, $9, $10, $11,
          ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($12), 4326))::geography
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          name_vi = EXCLUDED.name_vi,
          type = EXCLUDED.type,
          code = EXCLUDED.code,
          parent_id = EXCLUDED.parent_id,
          old_names = EXCLUDED.old_names,
          bbox_min_lat = EXCLUDED.bbox_min_lat,
          bbox_max_lat = EXCLUDED.bbox_max_lat,
          bbox_min_lng = EXCLUDED.bbox_min_lng,
          bbox_max_lng = EXCLUDED.bbox_max_lng,
          boundary = EXCLUDED.boundary;
        `,
        [
          prov.name,
          prov.nameVi,
          prov.slug,
          prov.type,
          prov.code,
          vnId,
          prov.oldNames,
          prov.bbox.minLat,
          prov.bbox.maxLat,
          prov.bbox.minLng,
          prov.bbox.maxLng,
          prov.geometryJson,
        ],
      );
    }
    console.log(`Seeded ${provinces.length} post-merger provinces/cities from GeoJSON.`);

    // 3. Upsert major tourist zones under their merged province / city
    for (const z of TOURIST_ZONES) {
      const parentId = (
        await client.query('SELECT id FROM travel_areas WHERE slug = $1 LIMIT 1;', [z.parentSlug])
      ).rows[0]?.id;
      if (!parentId) {
        throw new Error(`Parent area '${z.parentSlug}' not found for zone '${z.slug}'.`);
      }

      await client.query(
        `
        INSERT INTO travel_areas (name, name_vi, slug, type, code, parent_id, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng)
        VALUES ($1, $2, $3, 'ZONE', $4, $5, $6, $7, $8, $9)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          name_vi = EXCLUDED.name_vi,
          type = EXCLUDED.type,
          code = COALESCE(EXCLUDED.code, travel_areas.code),
          parent_id = EXCLUDED.parent_id,
          bbox_min_lat = EXCLUDED.bbox_min_lat,
          bbox_max_lat = EXCLUDED.bbox_max_lat,
          bbox_min_lng = EXCLUDED.bbox_min_lng,
          bbox_max_lng = EXCLUDED.bbox_max_lng;
        `,
        [z.name, z.nameVi, z.slug, z.code || null, parentId, z.minLat, z.maxLat, z.minLng, z.maxLng],
      );
    }
    console.log(`Seeded ${TOURIST_ZONES.length} tourist zones.`);

    // 4. Migrate FKs & remove legacy pre-merger/duplicate slugs & old Da Nang districts
    await migrateLegacyAreas(client);

    // Sync SERIAL sequence after upserts/cleanups
    await client.query(
      "SELECT setval(pg_get_serial_sequence('travel_areas', 'id'), COALESCE((SELECT MAX(id) FROM travel_areas), 1));",
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (ownsClient) {
      await client.end();
    }
  }
}

function runSelfCheck() {
  const geojsonData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'vietnam_34_tinhthanh.geojson'), 'utf8'),
  );
  const provinces = buildProvinceSeedRecords(geojsonData);
  assert.equal(provinces.length, 34, 'Must produce exactly 34 provinces/cities');

  const provinceSlugs = new Set(provinces.map((p) => p.slug));
  assert.equal(provinceSlugs.size, 34, 'All 34 province slugs must be unique');
  assert.ok(provinceSlugs.has('ho-chi-minh'), 'TP.HCM must map to slug ho-chi-minh');
  assert.ok(!provinceSlugs.has('tp-ho-chi-minh'), 'Duplicate slug tp-ho-chi-minh must not exist');

  for (const p of provinces) {
    assert.ok(p.name.length > 0 && p.nameVi.length > 0 && p.code.length > 0, `Missing metadata on ${p.slug}`);
    assert.ok(p.bbox.minLat < p.bbox.maxLat && p.bbox.minLng < p.bbox.maxLng, `Invalid bbox on ${p.slug}`);
    assert.ok(p.bbox.maxLng <= 110.0, `Mainland/metro bbox lng skewed offshore on ${p.slug}: ${p.bbox.maxLng}`);
  }

  for (const [legacy, target] of Object.entries(LEGACY_AREA_MIGRATIONS)) {
    assert.ok(!provinceSlugs.has(legacy), `Legacy slug '${legacy}' overlaps canonical provinces`);
    assert.ok(
      provinceSlugs.has(target) || TOURIST_ZONES.some((z) => z.slug === target),
      `Migration target '${target}' missing`,
    );
  }

  const allSlugs = new Set([
    'viet-nam',
    ...provinceSlugs,
    ...TOURIST_ZONES.map((z) => z.slug),
  ]);
  for (const legacy of Object.keys(LEGACY_AREA_MIGRATIONS)) {
    assert.ok(!allSlugs.has(legacy), `Legacy slug '${legacy}' must not appear in canonical slugs`);
  }
  for (const z of TOURIST_ZONES) {
    assert.ok(allSlugs.has(z.parentSlug), `Zone '${z.slug}' references unknown parent '${z.parentSlug}'`);
    assert.ok(z.minLat < z.maxLat && z.minLng < z.maxLng, `Invalid zone bbox on ${z.slug}`);
  }

  const hubsSql = fs.readFileSync(path.join(__dirname, 'seeds', 'transit-hubs.seed.sql'), 'utf8');
  const referencedSlugs = [...hubsSql.matchAll(/slug\s*=\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
  assert.ok(referencedSlugs.length >= 42, 'Every transit hub row must resolve area_id via slug lookup');
  for (const s of referencedSlugs) {
    assert.ok(allSlugs.has(s), `transit-hubs.seed.sql references unknown area slug '${s}'`);
  }

  console.log(`Self-check passed: ${provinces.length} provinces, ${TOURIST_ZONES.length} zones, ${referencedSlugs.length} transit hub area lookups.`);
}

module.exports = {
  seedGeoJson,
  createDbClient,
  buildProvinceSeedRecords,
  computeMainlandPolygonBbox,
  PROVINCE_OLD_NAMES,
  LEGACY_AREA_MIGRATIONS,
  TOURIST_ZONES,
};

if (require.main === module) {
  if (process.argv.includes('--check')) {
    runSelfCheck();
  } else {
    seedGeoJson()
      .then(() => console.log('GeoJSON seed completed successfully.'))
      .catch((err) => {
        console.error('Seed GeoJSON failed:', err);
        process.exit(1);
      });
  }
}

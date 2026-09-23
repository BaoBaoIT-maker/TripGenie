const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

// 6 Thành phố trực thuộc Trung ương
const CENTRAL_CITIES = ['Hà Nội', 'Hải Phòng', 'Huế', 'Đà Nẵng', 'TP. Hồ Chí Minh', 'Cần Thơ'];

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function seedGeoJson() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/travel_db?schema=public',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL.');

    // 1. Seed Categories trước
    const seedSqlPath = path.join(__dirname, 'seed.sql');
    if (fs.existsSync(seedSqlPath)) {
      const sql = fs.readFileSync(seedSqlPath, 'utf8');
      await client.query(sql);
      console.log('Categories seeded.');
    }

    // 2. Lấy ID của Việt Nam
    let vnRes = await client.query("SELECT id FROM travel_areas WHERE slug = 'viet-nam' LIMIT 1;");
    let vnId;
    if (vnRes.rows.length === 0) {
      const insertVn = await client.query(`
        INSERT INTO travel_areas (name, name_vi, slug, type, code)
        VALUES ('Vietnam', 'Việt Nam', 'viet-nam', 'COUNTRY', 'VN')
        RETURNING id;
      `);
      vnId = insertVn.rows[0].id;
    } else {
      vnId = vnRes.rows[0].id;
    }

    // 3. Đọc GeoJSON 34 tỉnh thành từ gis.vn
    const geoJsonPath = path.join(__dirname, 'vietnam_34_tinhthanh.geojson');
    if (!fs.existsSync(geoJsonPath)) {
      throw new Error(`File not found: ${geoJsonPath}`);
    }

    const geojsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
    console.log(`Loading ${geojsonData.features.length} provinces from gis.vn GeoJSON...`);

    for (const feature of geojsonData.features) {
      const props = feature.properties || {};
      const nameVi = props.ten_tinh || props.name || props.Ten;
      const code = String(props.ma_tinh || props.id || props.Ma);
      const slug = slugify(nameVi);
      const type = CENTRAL_CITIES.includes(nameVi) ? 'CITY' : 'PROVINCE';
      const oldNames = PROVINCE_OLD_NAMES[nameVi] || [];
      const geomJson = JSON.stringify(feature.geometry);

      // Chèn hoặc cập nhật tỉnh thành với MultiPolygon từ GeoJSON
      const upsertQuery = `
        INSERT INTO travel_areas (name, name_vi, slug, type, code, parent_id, old_names, boundary)
        VALUES (
          $1, $2, $3, $4::area_type_enum, $5, $6, $7,
          ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($8), 4326))::geography
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          name_vi = EXCLUDED.name_vi,
          type = EXCLUDED.type,
          code = EXCLUDED.code,
          parent_id = EXCLUDED.parent_id,
          old_names = EXCLUDED.old_names,
          boundary = EXCLUDED.boundary;
      `;

      await client.query(upsertQuery, [
        nameVi, // name
        nameVi, // name_vi
        slug,
        type,
        code,
        vnId,
        oldNames,
        geomJson,
      ]);

      console.log(`Seeded province: ${nameVi} (${type}, code: ${code}) with real polygon.`);
    }

    // 4. Lấy ID của Đà Nẵng để seed các Quận/Huyện & Zones
    const dnRes = await client.query("SELECT id FROM travel_areas WHERE slug = 'da-nang' LIMIT 1;");
    if (dnRes.rows.length > 0) {
      const danangId = dnRes.rows[0].id;

      // Seed các quận huyện Đà Nẵng
      const districts = [
        { name: 'Quận Hải Châu', slug: 'hai-chau-da-nang', code: '490', minLat: 16.02, maxLat: 16.085, minLng: 108.20, maxLng: 108.235 },
        { name: 'Quận Sơn Trà', slug: 'son-tra-da-nang', code: '492', minLat: 16.05, maxLat: 16.14, minLng: 108.22, maxLng: 108.32 },
        { name: 'Quận Ngũ Hành Sơn', slug: 'ngu-hanh-son-da-nang', code: '493', minLat: 15.96, maxLat: 16.05, minLng: 108.23, maxLng: 108.29 },
        { name: 'Quận Thanh Khê', slug: 'thanh-khe-da-nang', code: '491', minLat: 16.05, maxLat: 16.08, minLng: 108.16, maxLng: 108.21 },
        { name: 'Quận Liên Chiểu', slug: 'lien-chieu-da-nang', code: '494', minLat: 16.07, maxLat: 16.17, minLng: 108.08, maxLng: 108.18 },
        { name: 'Quận Cẩm Lệ', slug: 'cam-le-da-nang', code: '495', minLat: 15.99, maxLat: 16.04, minLng: 108.16, maxLng: 108.23 },
        { name: 'Huyện Hòa Vang', slug: 'hoa-vang-da-nang', code: '497', minLat: 15.90, maxLat: 16.20, minLng: 107.90, maxLng: 108.18 },
        { name: 'Thành phố Hội An', slug: 'hoi-an-da-nang', code: '503', minLat: 15.85, maxLat: 15.94, minLng: 108.28, maxLng: 108.40 },
      ];

      for (const d of districts) {
        await client.query(`
          INSERT INTO travel_areas (name, name_vi, slug, type, code, parent_id, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, boundary)
          VALUES (
            $1, $1, $2, 'DISTRICT', $3, $4, $5, $6, $7, $8,
            ST_Multi(ST_MakeEnvelope($7, $5, $8, $6, 4326))::geography
          )
          ON CONFLICT (slug) DO UPDATE SET
            name_vi = EXCLUDED.name_vi,
            parent_id = EXCLUDED.parent_id,
            code = EXCLUDED.code,
            boundary = EXCLUDED.boundary;
        `, [d.name, d.slug, d.code, danangId, d.minLat, d.maxLat, d.minLng, d.maxLng]);
      }
      console.log('Seeded Da Nang districts and Hoi An successfully.');
    }

    // Kiểm tra kết quả
    const countRes = await client.query('SELECT type, count(*) as count FROM travel_areas GROUP BY type ORDER BY count DESC;');
    console.log('\n--- KẾT QUẢ TRAVEL AREAS TRONG DATABASE: ---');
    console.table(countRes.rows);

  } catch (error) {
    console.error('Seed GeoJSON failed:', error);
  } finally {
    await client.end();
  }
}

seedGeoJson();

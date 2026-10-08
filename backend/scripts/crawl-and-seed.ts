import { Client } from 'pg';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// OSM tag to internal category mapping
const OSM_TAG_TO_CATEGORY: Record<string, string> = {
  'amenity:restaurant': 'nha-hang',
  'amenity:cafe': 'ca-phe',
  'amenity:bar': 'bar-pub',
  'amenity:pub': 'bar-pub',
  'amenity:nightclub': 'bar-pub',
  'amenity:fast_food': 'an-vat-via-he',
  'amenity:food_court': 'an-vat-via-he',
  'amenity:marketplace': 'cho-sieu-thi',
  'tourism:hotel': 'khach-san',
  'tourism:hostel': 'khach-san',
  'tourism:guest_house': 'homestay',
  'tourism:museum': 'di-tich-lich-su',
  'tourism:attraction': 'diem-tham-quan',
  'tourism:viewpoint': 'thien-nhien',
  'tourism:theme_park': 'vui-choi',
  'tourism:beach': 'thien-nhien',
  'natural:beach': 'thien-nhien',
  'leisure:spa': 'spa',
  'leisure:water_park': 'vui-choi',
  'shop:mall': 'cho-sieu-thi',
  'shop:supermarket': 'cho-sieu-thi',
};

function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchOverpassData(minLat: number, maxLat: number, minLng: number, maxLng: number) {
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `
    [out:json][timeout:60][maxsize:50000000];
    (
      node["amenity"~"restaurant|cafe|bar|pub|nightclub|fast_food|food_court|marketplace"](${bbox});
      node["tourism"~"hotel|hostel|guest_house|museum|attraction|viewpoint|theme_park|beach"](${bbox});
      node["historic"](${bbox});
      node["natural"~"beach"](${bbox});
      node["leisure"~"spa|water_park|sports_centre|fitness_centre"](${bbox});
      node["shop"~"mall|supermarket"](${bbox});
    );
    out body;
  `;

  console.log(`🌐 Querying Overpass API for bbox [${bbox}]...`);
  const response = await axios.post(
    'https://overpass-api.de/api/interpreter',
    `data=${encodeURIComponent(query)}`,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TripGenieBot/1.0 (https://tripgenie.app; contact@tripgenie.app)',
      },
      timeout: 60000,
    },
  );

  return response.data.elements || [];
}

async function enrichWithWikimedia(name: string, wikidataId?: string | null): Promise<{ summary?: string; photos: string[] }> {
  const result: { summary?: string; photos: string[] } = { photos: [] };
  const client = axios.create({
    timeout: 8000,
    headers: { 'User-Agent': 'TripGenieBot/1.0 (https://tripgenie.app)' },
  });

  try {
    let targetTitle: string | null = null;
    if (wikidataId && wikidataId.startsWith('Q')) {
      try {
        const wdRes = await client.get(
          `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=sitelinks&format=json`,
        );
        const entity = wdRes.data?.entities?.[wikidataId];
        if (entity?.sitelinks?.viwiki?.title) {
          targetTitle = entity.sitelinks.viwiki.title;
        } else if (entity?.sitelinks?.enwiki?.title) {
          targetTitle = entity.sitelinks.enwiki.title;
        }
      } catch {}
    }

    if (!targetTitle && name) {
      try {
        const searchRes = await client.get(
          `https://vi.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(name.trim())}&limit=1&namespace=0&format=json`,
        );
        if (searchRes.data?.[1]?.[0]) {
          targetTitle = searchRes.data[1][0];
        }
      } catch {}
    }

    if (targetTitle) {
      const pageRes = await client.get(
        `https://vi.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(targetTitle)}`,
      );
      if (pageRes.data?.extract) {
        result.summary = pageRes.data.extract;
      }
      if (pageRes.data?.originalimage?.source) {
        result.photos.push(pageRes.data.originalimage.source);
      } else if (pageRes.data?.thumbnail?.source) {
        result.photos.push(pageRes.data.thumbnail.source);
      }
    }
  } catch {}

  return result;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/travel_db?schema=public';
  console.log(`🔌 Connecting to PostgreSQL at ${dbUrl.replace(/:[^:]*@/, ':***@')}...`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // 1. Kiểm tra bảng categories, nếu rỗng thì chạy seed.sql
    const catCheck = await client.query('SELECT count(*) as count FROM categories;');
    if (parseInt(catCheck.rows[0].count, 10) === 0) {
      console.log('🌱 categories table is empty. Running prisma/seed.sql...');
      const seedSql = fs.readFileSync(path.join(__dirname, '../prisma/seed.sql'), 'utf8');
      await client.query(seedSql);
      console.log('✅ prisma/seed.sql executed successfully.');
    } else {
      console.log(`✅ Database already has ${catCheck.rows[0].count} categories.`);
    }

    // 2. Lấy category map (slug -> id)
    const catRows = await client.query('SELECT id, slug FROM categories;');
    const categoryMap = new Map<string, number>();
    for (const r of catRows.rows) {
      categoryMap.set(r.slug, r.id);
    }

    // 3. Tìm khu vực Đà Nẵng
    const areaRes = await client.query("SELECT id, name, name_vi, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng FROM travel_areas WHERE slug = 'da-nang' LIMIT 1;");
    if (areaRes.rows.length === 0) {
      throw new Error("Travel area 'da-nang' not found! Make sure seed.sql ran properly.");
    }
    const area = areaRes.rows[0];
    console.log(`📍 Target Area: ${area.name_vi || area.name} (ID: ${area.id})`);
    const minLat = Number(area.bbox_min_lat) || 15.90;
    const maxLat = Number(area.bbox_max_lat) || 16.22;
    const minLng = Number(area.bbox_min_lng) || 107.90;
    const maxLng = Number(area.bbox_max_lng) || 108.38;

    // 4. Cào dữ liệu từ Overpass
    const elements = await fetchOverpassData(minLat, maxLat, minLng, maxLng);
    console.log(`📦 Fetched ${elements.length} raw elements from OpenStreetMap.`);

    let insertedCount = 0;
    let duplicateCount = 0;
    let enrichedCount = 0;

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name;
      if (!name) continue;

      // Xác định categorySlug
      let categorySlug: string | null = null;
      for (const [tagKey, slug] of Object.entries(OSM_TAG_TO_CATEGORY)) {
        const [k, v] = tagKey.split(':');
        if (tags[k] && (v === '*' || tags[k] === v)) {
          categorySlug = slug;
          break;
        }
      }
      if (!categorySlug && tags.historic) categorySlug = 'di-tich-lich-su';
      if (!categorySlug && tags.amenity === 'cafe') categorySlug = 'ca-phe';
      if (!categorySlug && tags.amenity === 'restaurant') categorySlug = 'nha-hang';
      if (!categorySlug) continue;

      const categoryId = categoryMap.get(categorySlug);
      if (!categoryId) continue;

      const lat = el.lat;
      const lng = el.lon;
      const nameNorm = normalizeVietnamese(name);

      // 5. Kiểm tra trùng lặp (Deduplication: ST_DWithin 50m hoặc tên giống)
      const dupCheck = await client.query(
        `SELECT id FROM places 
         WHERE deleted_at IS NULL 
           AND (
             (name_normalized = $1 AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 100))
             OR ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 30)
           ) LIMIT 1;`,
        [nameNorm, lng, lat]
      );

      if (dupCheck.rows.length > 0) {
        duplicateCount++;
        continue;
      }

      // Xử lý thông tin bổ sung
      const rawPhone = tags.phone || tags['contact:phone'] || null;
      const phone = rawPhone ? rawPhone.split(';')[0].trim().slice(0, 30) : null;
      const website = tags.website || tags['contact:website'] || null;
      const address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:district'], 'Đà Nẵng'].filter(Boolean).join(', ') || 'Đà Nẵng, Việt Nam';
      const wikidata = tags.wikidata || null;

      try {
        // 6. Thêm địa điểm vào bảng places
        const insertRes = await client.query(
          `INSERT INTO places (
            id, name, name_normalized, description, latitude, longitude,
            location, address, category_id, area_id, status, tags,
            phone, website
          ) VALUES (
            uuid_generate_v4(), $1, $2, $3, $4, $5,
            ST_SetSRID(ST_MakePoint($5, $4), 4326),
            $6, $7, $8, 'ACTIVE', $9, $10, $11
          ) RETURNING id;`,
          [
            name.slice(0, 255),
            nameNorm.slice(0, 255),
            tags.description || null,
            lat,
            lng,
            address,
            categoryId,
            area.id,
            [categorySlug, 'da-nang'],
            phone,
            website,
          ]
        );

        const placeId = insertRes.rows[0].id;
        insertedCount++;

        // Ghi nguồn dữ liệu
        await client.query(
          `INSERT INTO place_sources (place_id, provider, external_id, raw_data, last_synced_at)
           VALUES ($1, 'OSM', $2, $3, NOW())
           ON CONFLICT (provider, external_id) DO NOTHING;`,
          [placeId, String(el.id), JSON.stringify(tags)]
        );

        // 7. Làm giàu hình ảnh với Wikimedia cho một số điểm chính hoặc có wikidata
        if (wikidata || categorySlug === 'diem-tham-quan' || categorySlug === 'di-tich-lich-su' || insertedCount % 10 === 0) {
          const enrichment = await enrichWithWikimedia(name, wikidata);
          if (enrichment.photos.length > 0 || enrichment.summary) {
            if (enrichment.summary) {
              await client.query('UPDATE places SET description = COALESCE(description, $1) WHERE id = $2', [
                enrichment.summary,
                placeId,
              ]);
            }
            if (enrichment.photos.length > 0) {
              for (let idx = 0; idx < enrichment.photos.length; idx++) {
                await client.query(
                  `INSERT INTO place_images (place_id, image_url, display_order, is_primary, source)
                   VALUES ($1, $2, $3, $4, 'wikimedia');`,
                  [placeId, enrichment.photos[idx], idx, idx === 0]
                );
              }
              await client.query('UPDATE places SET image_count = $1 WHERE id = $2', [
                enrichment.photos.length,
                placeId,
              ]);
              enrichedCount++;
            }
          }
        }
      } catch (err: any) {
        // Skip individual problematic places without halting the loop
      }

      if (insertedCount % 50 === 0) {
        console.log(`⏳ Progress: Inserted ${insertedCount} places (Skipped duplicates: ${duplicateCount})...`);
      }
    }

    console.log(`\n🎉 CRAWL & SEED HOÀN TẤT!`);
    console.log(`- Địa điểm mới thêm: ${insertedCount}`);
    console.log(`- Trùng lặp bỏ qua: ${duplicateCount}`);
    console.log(`- Địa điểm làm giàu ảnh/thuyết minh: ${enrichedCount}`);

    // Thống kê theo category
    const stats = await client.query(`
      SELECT c.name_vi, count(p.id) as total
      FROM places p
      JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
      GROUP BY c.name_vi
      ORDER BY total DESC;
    `);
    console.log('\n📊 Phân bố địa điểm theo Danh mục trong Database:');
    console.table(stats.rows);

  } catch (error) {
    console.error('❌ Error during crawl and seed:', error);
  } finally {
    await client.end();
  }
}

main();

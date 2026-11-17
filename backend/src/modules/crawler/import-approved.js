/**
 * Script nạp dữ liệu địa điểm sạch (Google Maps) đã duyệt vào Database PostgreSQL
 * Chạy lệnh: node backend/src/modules/crawler/import-approved.js
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env'),
});
const { Pool } = require('pg');
const { PROVINCES } = require('./config');

function normalizeVietnamese(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

async function importApprovedPlaces() {
  console.log('================================================================');
  console.log('🚀 NẠP DỮ LIỆU ĐỊA ĐIỂM SẠCH (GOOGLE MAPS) VÀO DATABASE');
  console.log('================================================================\n');

  // 1. Đọc file dữ liệu
  const approvedPath = path.join(__dirname, 'data', 'approved-places.json');
  const stagedPath = path.join(__dirname, 'data', 'staged-google-places.json');

  let placesToImport = [];
  if (fs.existsSync(approvedPath)) {
    console.log(`📄 Tìm thấy file danh sách đã duyệt: ${approvedPath}`);
    placesToImport = JSON.parse(fs.readFileSync(approvedPath, 'utf-8'));
  } else if (fs.existsSync(stagedPath)) {
    console.log(`ℹ️ Chưa xuất file approved-places.json, lấy các quán đã tick 'approved: true' từ: ${stagedPath}`);
    const allStaged = JSON.parse(fs.readFileSync(stagedPath, 'utf-8'));
    placesToImport = allStaged.filter((p) => p.approved !== false);
  } else {
    console.error('❌ Không tìm thấy file dữ liệu nào trong backend/src/modules/crawler/data/');
    return;
  }

  if (placesToImport.length === 0) {
    console.warn('⚠️ Không có địa điểm nào được đánh dấu duyệt để nạp.');
    return;
  }

  console.log(`📦 Chuẩn bị nạp ${placesToImport.length} địa điểm vào PostgreSQL...`);

  // Hỗ trợ truyền URL DB qua flag --db="..." hoặc biến môi trường DATABASE_URL
  const dbArg = process.argv.find((a) => a.startsWith('--db='));
  const connectionString = dbArg ? dbArg.slice('--db='.length) : process.env.DATABASE_URL;
  const isCleanMode = process.argv.includes('--clean');
  if (!connectionString) throw new Error('Thiếu DATABASE_URL hoặc tham số --db.');

  // 2. Kết nối PostgreSQL (Pool 8 luồng song song giúp nạp 3.550 quán lên Render chỉ trong ~1 phút)
  const pool = new Pool({
    connectionString,
    max: 8,
    ssl: connectionString && connectionString.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  });

  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    const areas = await pool.query('SELECT id,slug FROM travel_areas');
    const categories = await pool.query('SELECT id,slug FROM categories');
    const areaIds = new Map(areas.rows.map(row => [row.slug, row.id]));
    const categoryIds = new Map(categories.rows.map(row => [row.slug, row.id]));

    if (isCleanMode) {
      console.log('🧹 Chế độ --clean: Đang dọn sạch dữ liệu địa điểm cũ trong DB...');
      await pool.query('UPDATE crawl_jobs SET place_id = NULL WHERE place_id IS NOT NULL');
      await pool.query('DELETE FROM places');
      await pool.query('UPDATE itineraries SET total_places = 0');
      console.log('✅ Đã xóa sạch toàn bộ địa điểm cũ (Tài khoản, Tỉnh thành, Danh mục giữ nguyên 100%).\n');
    }

    // Nạp sẵn danh sách tên đã tồn tại vào RAM (tránh query SELECT lặp lại 3.550 lần)
    const existingSet = new Set();
    if (!isCleanMode) {
      const existingRows = await pool.query('SELECT name_normalized, name FROM places');
      for (const r of existingRows.rows) {
        if (r.name_normalized) existingSet.add(r.name_normalized);
        if (r.name) existingSet.add(normalizeVietnamese(r.name));
      }
    }

    // Lọc trước các quán chưa trùng để worker chạy song song không bị race
    const workQueue = [];
    for (const item of placesToImport) {
      const name = item.name.trim();
      const nameNorm = normalizeVietnamese(name);
      if (existingSet.has(nameNorm)) {
        skippedCount++;
        continue;
      }
      existingSet.add(nameNorm);
      workQueue.push({ item, name, nameNorm });
    }

    let cursor = 0;
    const workerCount = Math.min(8, Math.max(1, workQueue.length));

    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= workQueue.length) break;

        const { item, name, nameNorm } = workQueue[idx];
        try {
          // Older staged files identify the province by areaName; new crawls include areaSlug.
          const province = Object.values(PROVINCES).find(province => province.areaName === item.areaName);
          const areaSlug = item.areaSlug || province?.slug;
          const areaId = areaSlug ? areaIds.get(areaSlug) : item.areaId;
          const categoryId = item.categorySlug ? categoryIds.get(item.categorySlug) : item.categoryId;
          if (!areaId || !categoryId) {
            throw new Error(`Chưa có tỉnh hoặc danh mục tương ứng trong database: ${areaSlug || item.areaId}, ${item.categorySlug || item.categoryId}`);
          }

          const attributesJson = JSON.stringify({
            tagline: item.tagline || null,
            whyGo: item.whyGo || [],
            tips: item.tips || [],
            suggestedDuration: item.suggestedDuration || '1.5 - 2 giờ',
            suitableFor: item.suitableFor || ['family', 'friends', 'solo'],
            styles: item.styles || ['foodie', 'checkin', 'chill'],
            priceRangeText: item.priceRangeText || '50.000đ - 150.000đ',
            openingHoursText: item.openingHoursText || 'Mở cả ngày',
          });

          const priceRangeJson = JSON.stringify({
            text: item.priceRangeText || '50.000đ - 150.000đ',
            currency: 'VND',
          });

          const openingHoursJson = JSON.stringify({
            rawText: item.openingHoursText || 'Mở cả ngày',
          });

          const urls = Array.isArray(item.photos) ? item.photos : [];
          const orders = urls.map((_, i) => i);
          const primaries = urls.map((_, i) => i === 0);

          let externalId = null;
          if (item.googleMapsUrl) {
            const idMatch = item.googleMapsUrl.match(/!1s([^!&]+)/);
            externalId = (idMatch ? idMatch[1] : (item.id || item.slug || item.googleMapsUrl)).slice(0, 250);
          }

          await pool.query(
            `WITH p AS (
              INSERT INTO places (
                name, name_normalized, description, address, latitude, longitude,
                category_id, area_id, phone, website, rating_avg, review_count,
                image_count, tags, status, price_range, opening_hours, attributes
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'ACTIVE',
                $15, $16, $17
              ) RETURNING id
            ), imgs AS (
              INSERT INTO place_images (
                place_id, image_url, thumbnail_url, display_order, is_primary, source
              )
              SELECT p.id, u.url, u.url, u.ord, u.prim, 'google_maps'
              FROM p, UNNEST($18::text[], $19::int[], $20::boolean[]) AS u(url, ord, prim)
              RETURNING 1
            )
            INSERT INTO place_sources (
              place_id, provider, external_id, external_url, source_rating, source_review_count, sync_status
            )
            SELECT p.id, 'google_maps', $21::varchar, $22, $23, $24, 'OK'
            FROM p
            WHERE $21::varchar IS NOT NULL
            ON CONFLICT (provider, external_id) DO NOTHING`,
            [
              name.slice(0, 255),
              nameNorm.slice(0, 255),
              item.description || null,
              item.address || 'Đang cập nhật',
              item.latitude,
              item.longitude,
              categoryId,
              areaId,
              item.phone ? String(item.phone).slice(0, 30) : null,
              item.website || null,
              item.ratingAvg || 0,
              item.reviewCount || 0,
              urls.length,
              [item.categoryName || 'Ẩm thực', item.areaName || 'Việt Nam'],
              priceRangeJson,
              openingHoursJson,
              attributesJson,
              urls,
              orders,
              primaries,
              externalId,
              item.googleMapsUrl || null,
              item.ratingAvg || null,
              item.reviewCount || null,
            ]
          );

          insertedCount++;
          if (insertedCount % 100 === 0 || insertedCount === workQueue.length) {
            console.log(`  ⏳ Tiến độ: đã nạp ${insertedCount}/${workQueue.length} địa điểm...`);
          }
        } catch (itemErr) {
          errorCount++;
          console.warn(`  ⚠️ Bỏ qua lỗi tại "${name}": ${itemErr.message}`);
        }
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    if (errorCount > 0) process.exitCode = 1;

    console.log('\n----------------------------------------------------------------');
    console.log(`🎉 HOÀN THÀNH: Đã thêm mới ${insertedCount} địa điểm | Bỏ qua trùng: ${skippedCount} | Lỗi: ${errorCount}`);
    console.log('Bạn có thể mở http://localhost:3000/explore để thấy ngay các địa điểm mới!');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Lỗi kết nối / nạp dữ liệu:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

importApprovedPlaces().catch(error => {
  console.error('❌ Lỗi nạp dữ liệu:', error.message);
  process.exitCode = 1;
});

/**
 * Khởi tạo Schema (init.sql + migrations), Seed dữ liệu gốc (34 tỉnh thành, danh mục)
 * trên Database PostgreSQL (Render hoặc Local). Import địa điểm bằng import-approved.js.
 *
 * Cách dùng:
 *   node backend/src/modules/crawler/setup-render-db.js --db="postgresql://..."
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env'),
});
const { Client } = require('pg');
const { seedGeoJson } = require('../../../prisma/seed_geojson');

async function runSqlFile(client, filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file SQL bắt buộc: ${filePath}`);
  }
  console.log(`  ▶ Đang chạy ${label}...`);
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
}

async function setupDatabase() {
  const dbArg = process.argv.find((a) => a.startsWith('--db='));
  const connectionString = dbArg ? dbArg.slice('--db='.length) : process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Thiếu chuỗi kết nối DB! Hãy truyền --db="postgresql://..."');
    process.exit(1);
  }

  const isRender = connectionString.includes('render.com');
  const isCheckOnly = process.argv.includes('--check');
  const client = new Client({
    connectionString,
    ssl: isRender ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    if (isCheckOnly) {
      const host = new URL(connectionString).hostname;
      const tbls = await client.query("SELECT count(*) FROM pg_tables WHERE schemaname = 'public'");
      const hasPlaces = await client.query("SELECT to_regclass('public.places') AS tbl");
      let placesCount = 0, imgsCount = 0, catsCount = 0, areasCount = 0;
      if (hasPlaces.rows[0].tbl) {
        placesCount = (await client.query('SELECT count(*) FROM places')).rows[0].count;
        imgsCount = (await client.query('SELECT count(*) FROM place_images')).rows[0].count;
        catsCount = (await client.query('SELECT count(*) FROM categories')).rows[0].count;
        areasCount = (await client.query('SELECT count(*) FROM travel_areas')).rows[0].count;
      }
      console.log(`🔍 Kiểm tra DB tại host: ${host}`);
      console.log(`   • Số bảng      : ${tbls.rows[0].count}`);
      console.log(`   • Danh mục     : ${catsCount}`);
      console.log(`   • Khu vực      : ${areasCount}`);
      console.log(`   • Địa điểm     : ${placesCount}`);
      console.log(`   • Ảnh địa điểm : ${imgsCount}`);
      return;
    }

    console.log('================================================================');
    console.log('🛠️  KHỞI TẠO SCHEMA & SEED DỮ LIỆU NỀN POSTGRESQL');
    console.log('================================================================\n');

    // 1. Kiểm tra xem bảng cốt lõi (users/places) đã tồn tại chưa (tránh sót spatial_ref_sys của PostGIS)
    const coreCheck = await client.query("SELECT to_regclass('public.users') AS tbl");

    if (!coreCheck.rows[0].tbl) {
      const initSqlPath = path.resolve(__dirname, '../../../docker/postgres/init.sql');
      await runSqlFile(client, initSqlPath, 'init.sql (Extensions, Tables, Triggers, Views)');
    } else {
      console.log('  ℹ️ DB đã có sẵn bảng cốt lõi, bỏ qua init.sql.');
    }

    // 2. Chạy các Prisma migrations còn thiếu (kiểm tra idempotent trước khi chạy)
    const migrationsDir = path.resolve(__dirname, '../../../prisma/migrations');
    if (fs.existsSync(migrationsDir)) {
      const dirs = fs.readdirSync(migrationsDir).sort();
      const hasBreadcrumbsRes = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_chunks' AND column_name = 'breadcrumbs'
      `);
      const skipSimplifyKnowledge = hasBreadcrumbsRes.rows.length > 0;

      const hasEditedAtRes = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'community_posts' AND column_name = 'edited_at'
      `);
      const skipEditedAt = hasEditedAtRes.rows.length > 0;

      for (const dir of dirs) {
        if (dir === '20261020140000_simplify_knowledge_tables' && skipSimplifyKnowledge) {
          console.log(`  ⏭️ Bỏ qua ${dir} (đã tích hợp sẵn trong init.sql)`);
          continue;
        }
        if (dir === '20261028160500_community_post_edited_at' && skipEditedAt) {
          console.log(`  ⏭️ Bỏ qua ${dir} (cột edited_at đã tồn tại)`);
          continue;
        }
        if (dir === '20261103150000_community_notifications') {
          const notifCheck = await client.query("SELECT to_regclass('public.notifications') AS tbl");
          if (notifCheck.rows[0].tbl) {
            console.log(`  ⏭️ Bỏ qua ${dir} (bảng notifications đã tồn tại)`);
            continue;
          }
        }
        if (dir === '20261103163000_trip_companion_invitations') {
          const invCheck = await client.query("SELECT to_regclass('public.trip_invitations') AS tbl");
          if (invCheck.rows[0].tbl) {
            console.log(`  ⏭️ Bỏ qua ${dir} (bảng trip_invitations đã tồn tại)`);
            continue;
          }
        }

        const migPath = path.join(migrationsDir, dir, 'migration.sql');
        if (fs.existsSync(migPath)) {
          await runSqlFile(client, migPath, `migration: ${dir}`);
        }
      }
    }

    // 3. Seed dữ liệu nền bằng cùng bộ seed đang dùng trong backend.
    // Đảm bảo bảng transit_hubs tồn tại (chỉ khai báo trong schema.prisma)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transit_hubs (
        id TEXT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        hub_type VARCHAR(50) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        area_id INT NOT NULL REFERENCES travel_areas(id) ON DELETE CASCADE,
        is_active BOOLEAN NOT NULL DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS transit_hubs_area_id_idx ON transit_hubs(area_id);
      CREATE INDEX IF NOT EXISTS transit_hubs_hub_type_idx ON transit_hubs(hub_type);
    `);

    await seedGeoJson(client);

    const hubsPath = path.resolve(__dirname, '../../../prisma/seeds/transit-hubs.seed.sql');
    await runSqlFile(client, hubsPath, 'seeds/transit-hubs.seed.sql');

    // 4. Thống kê nhanh
    const cats = await client.query('SELECT count(*) FROM categories');
    const areas = await client.query('SELECT count(*) FROM travel_areas');
    const tbls = await client.query("SELECT count(*) FROM pg_tables WHERE schemaname = 'public'");
    console.log('\n----------------------------------------------------------------');
    console.log(`✅ Khởi tạo hoàn tất! Tổng số bảng: ${tbls.rows[0].count} | Danh mục: ${cats.rows[0].count} | Khu vực: ${areas.rows[0].count}`);
    console.log('================================================================\n');
  } finally {
    await client.end();
  }
}

setupDatabase().catch((err) => {
  console.error('❌ Lỗi khi khởi tạo DB:', err.message);
  process.exit(1);
});

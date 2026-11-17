const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('../../backend/node_modules/pg');

const backendDir = path.resolve(__dirname, '../../backend');
const adminUrl = process.env.CRAWLER_TEST_DATABASE_URL;
assert.ok(adminUrl, 'Set CRAWLER_TEST_DATABASE_URL to a PostgreSQL test server with CREATE DATABASE permission.');
const databaseName = `crawler_check_${crypto.randomUUID().replaceAll('-', '')}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new Client({ connectionString: adminUrl });
const client = new Client({ connectionString: testUrl.toString() });

function runSetup(...args) {
  const result = spawnSync(process.execPath, ['src/modules/crawler/setup-render-db.js', ...args], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

async function check() {
  await admin.connect();
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await client.connect();
    runSetup();
    const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='group_place_proposals'");
    for (const column of ['status', 'destination_id', 'day_number', 'proposed_start_time', 'notes']) {
      assert.ok(columns.rows.some(row => row.column_name === column), column);
    }
    const { rows: [counts] } = await client.query(`
      SELECT (SELECT count(*)::int FROM travel_areas WHERE type IN ('PROVINCE','CITY')) AS provinces,
        (SELECT count(*)::int FROM categories) AS categories,
        (SELECT count(*)::int FROM transit_hubs) AS hubs
    `);
    assert.equal(counts.provinces, 34);
    assert.ok(counts.categories > 0);
    assert.ok(counts.hubs > 0);
    await client.query("INSERT INTO users(full_name,email) VALUES ('Crawler migration regression','crawler-check@example.invalid')");
    const before = await client.query('SELECT id,slug FROM travel_areas ORDER BY id');
    runSetup();
    assert.deepEqual((await client.query('SELECT id,slug FROM travel_areas ORDER BY id')).rows, before.rows);
    assert.equal((await client.query('SELECT count(*)::int AS total FROM users')).rows[0].total, 1);
    runSetup('--check');
    const crawlerDir = path.join(backendDir, 'src/modules/crawler');
    const areas = [
      ['Thành phố Đà Nẵng', 'da-nang'],
      ['Thành phố Hồ Chí Minh', 'ho-chi-minh'],
      ['Tỉnh Lâm Đồng', 'lam-dong'],
      ['Tỉnh An Giang', 'an-giang'],
    ];
    const sample = areas.map(([areaName, slug]) => ({
      name: `Crawler regression ${slug}`,
      areaName,
      areaId: -1,
      categoryId: -1,
      categorySlug: 'ca-phe',
      latitude: 16,
      longitude: 108,
      photos: ['https://example.invalid/crawler-regression.jpg'],
      googleMapsUrl: `https://example.invalid/maps/place/${slug}`,
    }));
    // Substitute only the input file in the child; database writes use real PostgreSQL.
    const importCode = `
      const fs = require('node:fs');
      const path = require('node:path');
      const root = ${JSON.stringify(crawlerDir)};
      const input = path.join(root, 'data/approved-places.json');
      const exists = fs.existsSync;
      const read = fs.readFileSync;
      fs.existsSync = function(file) { return String(file) === input || exists.apply(this, arguments); };
      fs.readFileSync = function(file) {
        if (String(file) === input) return ${JSON.stringify(JSON.stringify(sample))};
        return read.apply(this, arguments);
      };
      require(path.join(root, 'import-approved.js'));
    `;
    for (let run = 0; run < 2; run++) {
      const result = spawnSync(process.execPath, ['-e', importCode], {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: testUrl.toString() },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /Lỗi: 0/, result.stdout + result.stderr);
      const imported = await client.query('SELECT p.name,a.slug,c.slug AS category_slug FROM places p JOIN travel_areas a ON a.id=p.area_id JOIN categories c ON c.id=p.category_id');
      assert.equal(imported.rows.length, sample.length);
      for (let i = 0; i < sample.length; i++) {
        assert.equal(imported.rows.find(place => place.name === sample[i].name)?.slug, areas[i][1]);
        assert.equal(imported.rows.find(place => place.name === sample[i].name)?.category_slug, sample[i].categorySlug);
      }
    }
    // Reproduce a database left at the old missing-status schema, keeping imported data.
    await client.query('ALTER TABLE group_place_proposals DROP COLUMN status CASCADE, DROP COLUMN destination_id');
    await client.query('DROP TYPE proposal_status_enum');
    runSetup();
    assert.equal((await client.query("SELECT count(*)::int AS total FROM information_schema.columns WHERE table_schema='public' AND table_name='group_place_proposals' AND column_name IN ('status','destination_id')")).rows[0].total, 2);
    assert.equal((await client.query('SELECT count(*)::int AS total FROM places')).rows[0].total, sample.length);
    assert.equal((await client.query('SELECT count(*)::int AS total FROM users')).rows[0].total, 1);
    console.log('Crawler database checks passed: fresh/repeated setup, legacy recovery, proposal schema, 34 provinces, hubs, data preservation and repeated multi-province import.');
  } finally {
    await client.end();
    if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
  }
}

check().catch(error => { console.error(error.message); process.exitCode = 1; });

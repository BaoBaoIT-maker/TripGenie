/**
 * Self-check script for Places search indexes (pg_trgm, GiST, GIN)
 * Run: node test/backend/places-indexes.check.js
 */
const assert = require('assert');
const path = require('path');
require('../../backend/node_modules/dotenv').config({
  path: path.resolve(__dirname, '../../backend/.env'),
});
const { Client } = require('../../backend/node_modules/pg');

const REQUIRED_INDEXES = [
  'idx_places_name_trgm',
  'idx_places_name_norm_trgm',
  'idx_places_address_trgm',
  'idx_places_desc_trgm',
  'idx_places_tags_gin',
  'idx_places_location_gist',
];

async function checkPlacesIndexes() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must be configured in backend/.env');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // 1. Verify all 6 performance indexes exist
    const idxRes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'places'
    `);
    const indexNames = new Set(idxRes.rows.map((r) => r.indexname));

    for (const reqIdx of REQUIRED_INDEXES) {
      assert.ok(
        indexNames.has(reqIdx),
        `Required index ${reqIdx} must exist on table 'places'`,
      );
    }
    console.log('✓ All 6 required GIN Trigram & GiST indexes exist on places table.');

    // 2. Verify keyword search utilizes all 5 GIN indexes via BitmapOr
    await client.query('SET enable_seqscan = off');
    const kwPlanRes = await client.query(`
      EXPLAIN (FORMAT JSON)
      SELECT id, name
      FROM places p
      WHERE p.deleted_at IS NULL
        AND p.status = 'ACTIVE'
        AND (
          p.name ILIKE '%linh ung%'
          OR p.name_normalized ILIKE '%linh ung%'
          OR p.address ILIKE '%linh ung%'
          OR p.description ILIKE '%linh ung%'
          OR p.tags @> ARRAY['linh_ung']::text[]
        )
    `);
    const kwPlanText = JSON.stringify(kwPlanRes.rows[0]['QUERY PLAN'][0]);

    for (const ginIdx of [
      'idx_places_name_trgm',
      'idx_places_name_norm_trgm',
      'idx_places_address_trgm',
      'idx_places_desc_trgm',
      'idx_places_tags_gin',
    ]) {
      assert.ok(
        kwPlanText.includes(ginIdx),
        `Keyword search plan must include GIN index ${ginIdx}`,
      );
    }
    console.log('✓ Keyword search plan utilizes all 5 GIN indexes via BitmapOr.');

    // 3. Verify amenity tag + description filter utilizes idx_places_tags_gin & idx_places_desc_trgm
    const amenityPlanRes = await client.query(`
      EXPLAIN (FORMAT JSON)
      SELECT id
      FROM places p
      WHERE p.deleted_at IS NULL
        AND (p.tags @> ARRAY['wifi']::text[] OR p.description ILIKE '%wifi%')
    `);
    const amenityPlanText = JSON.stringify(amenityPlanRes.rows[0]['QUERY PLAN'][0]);
    assert.ok(
      amenityPlanText.includes('idx_places_tags_gin') &&
        amenityPlanText.includes('idx_places_desc_trgm'),
      'Amenity filter must utilize both idx_places_tags_gin and idx_places_desc_trgm',
    );
    console.log('✓ Amenity filter plan utilizes idx_places_tags_gin + idx_places_desc_trgm.');

    // 4. Verify spatial bounding radius utilizes idx_places_location_gist
    const spatialPlanRes = await client.query(`
      EXPLAIN (FORMAT JSON)
      SELECT id
      FROM places p
      WHERE p.deleted_at IS NULL
        AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(108.24, 16.07), 4326), 5000)
    `);
    const spatialPlanText = JSON.stringify(spatialPlanRes.rows[0]['QUERY PLAN'][0]);
    assert.ok(
      spatialPlanText.includes('idx_places_location_gist'),
      'Spatial ST_DWithin query must utilize idx_places_location_gist',
    );
    console.log('✓ Spatial ST_DWithin plan utilizes idx_places_location_gist.');
  } finally {
    await client.query('SET enable_seqscan = on');
    await client.end();
  }
}

checkPlacesIndexes()
  .then(() => {
    console.log('ALL CHECKS PASSED!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Check failed:', err);
    process.exit(1);
  });

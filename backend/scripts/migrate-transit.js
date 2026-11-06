const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/travel_db?schema=public',
  });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS transit_hubs (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      hub_type VARCHAR(50) NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      area_id INT NOT NULL REFERENCES travel_areas(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT true
    );
    CREATE INDEX IF NOT EXISTS idx_transit_hubs_area ON transit_hubs(area_id);
    CREATE INDEX IF NOT EXISTS idx_transit_hubs_type ON transit_hubs(hub_type);

    CREATE TABLE IF NOT EXISTS transit_partner_mappings (
      id SERIAL PRIMARY KEY,
      provider VARCHAR(50) NOT NULL,
      hub_type VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      area_id INT NOT NULL REFERENCES travel_areas(id) ON DELETE CASCADE,
      external_code VARCHAR(50),
      search_url_template TEXT,
      deep_link_template TEXT,
      is_active BOOLEAN DEFAULT true
    );
  `);
  console.log('Tables transit_hubs & transit_partner_mappings created successfully.');

  const seedPath = path.join(__dirname, '../prisma/seeds/transit-hubs.seed.sql');
  if (fs.existsSync(seedPath)) {
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);
    console.log('Transit hubs seeded successfully.');
  }

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

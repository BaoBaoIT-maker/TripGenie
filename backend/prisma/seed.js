const fs = require('fs');
const path = require('path');
const { seedGeoJson, createDbClient } = require('./seed_geojson');

async function seed() {
  const client = createDbClient();

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    // 1. Seed categories, root country, 34 post-merger provinces (GeoJSON + bbox) & tourist zones
    await seedGeoJson(client);

    // 2. Seed transit hubs (resolves area_id dynamically via travel_areas.slug)
    const hubsPath = path.join(__dirname, 'seeds', 'transit-hubs.seed.sql');
    if (fs.existsSync(hubsPath)) {
      console.log('Executing transit-hubs.seed.sql...');
      await client.query(fs.readFileSync(hubsPath, 'utf8'));
    }

    console.log('Seed executed successfully.');

    const resAreas = await client.query('SELECT type, count(*) as count FROM travel_areas GROUP BY type ORDER BY count DESC;');
    console.log('\nTravel Areas count by type:');
    console.table(resAreas.rows);

    const resCats = await client.query('SELECT count(*) as total_categories FROM categories;');
    console.log('Total categories:', resCats.rows[0].total_categories);

    const resHubs = await client.query('SELECT count(*) as total_transit_hubs FROM transit_hubs;');
    console.log('Total transit hubs:', resHubs.rows[0].total_transit_hubs);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();

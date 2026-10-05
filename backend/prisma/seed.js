const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/travel_db?schema=public',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    const sqlPath = path.join(__dirname, 'seed.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing seed.sql...');
    await client.query(sql);

    const hubsPath = path.join(__dirname, 'seeds', 'transit-hubs.seed.sql');
    if (fs.existsSync(hubsPath)) {
      console.log('Executing transit-hubs.seed.sql...');
      await client.query(fs.readFileSync(hubsPath, 'utf8'));
    }

    const partnerPath = path.join(__dirname, 'seeds', 'transit-partner-mappings.seed.sql');
    if (fs.existsSync(partnerPath)) {
      console.log('Executing transit-partner-mappings.seed.sql...');
      await client.query(fs.readFileSync(partnerPath, 'utf8'));
    }
    console.log('Seed executed successfully.');

    // Kiểm tra kết quả
    const resAreas = await client.query('SELECT type, count(*) as count FROM travel_areas GROUP BY type ORDER BY count DESC;');
    console.log('\nTravel Areas count by type:');
    console.table(resAreas.rows);

    const resCats = await client.query('SELECT count(*) as total_categories FROM categories;');
    console.log('Total categories:', resCats.rows[0].total_categories);

    const resHubs = await client.query('SELECT count(*) as total_transit_hubs FROM transit_hubs;');
    console.log('Total transit hubs:', resHubs.rows[0].total_transit_hubs);

    const resPartners = await client.query('SELECT count(*) as total_partner_mappings FROM transit_partner_mappings;');
    console.log('Total partner mappings:', resPartners.rows[0].total_partner_mappings);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();

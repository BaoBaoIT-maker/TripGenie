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
    console.log('Seed executed successfully.');

    // Kiểm tra kết quả
    const resAreas = await client.query('SELECT type, count(*) as count FROM travel_areas GROUP BY type ORDER BY count DESC;');
    console.log('\nTravel Areas count by type:');
    console.table(resAreas.rows);

    const resCats = await client.query('SELECT count(*) as total_categories FROM categories;');
    console.log('Total categories:', resCats.rows[0].total_categories);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();

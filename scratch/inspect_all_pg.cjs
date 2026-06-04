const pg = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspectAll() {
  const client = await pool.connect();
  try {
    const tables = ['areas', 'persons', 'shifts', 'targets', 'attendance', 'demand'];
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`Table: ${table} - Count: ${res.rows[0].count}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

inspectAll();

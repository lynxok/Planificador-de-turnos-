const pg = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  const client = await pool.connect();
  try {
    console.log('=== DETALLES DE TURNOS PARA EL 2026-06-01 ===');
    
    const res = await client.query("SELECT s.*, p.name FROM shifts s JOIN persons p ON s.person_id = p.id WHERE s.date = '2026-06-01'");
    console.log(`Total turnos encontrados para 2026-06-01: ${res.rows.length}`);
    console.table(res.rows.map(r => ({ id: r.id, name: r.name, start: r.start_hour, duration: r.duration, area: r.area })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

inspect();

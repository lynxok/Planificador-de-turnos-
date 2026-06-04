import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: DATABASE_URL is not set in your .env file!');
  process.exit(1);
}

const DB_FILE = path.resolve(__dirname, '../data/database.json');

async function migrate() {
  console.log('--- INICIANDO MIGRACION A NEON POSTGRES ---');
  
  // 1. Read local JSON database
  let localData: any;
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    localData = JSON.parse(raw);
    console.log('Lectura de database.json exitosa.');
  } catch (err) {
    console.error('Error leyendo database.json. Asegurese que el archivo exista en data/database.json.', err);
    process.exit(1);
  }

  // 2. Connect to Postgres
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Creando estructura de tablas en Neon Postgres si no existe...');
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS persons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        area TEXT NOT NULL,
        max_daily_hours NUMERIC NOT NULL,
        availability_start NUMERIC NOT NULL,
        availability_end NUMERIC NOT NULL,
        color TEXT NOT NULL,
        legajo TEXT,
        possible_shifts JSONB
      );

      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        start_hour NUMERIC NOT NULL,
        duration NUMERIC NOT NULL,
        area TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS targets (
        area TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        hourly_targets INTEGER[] NOT NULL,
        PRIMARY KEY (area, day_of_week)
      );

      CREATE TABLE IF NOT EXISTS areas (
        name TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS demand (
        date_string TEXT NOT NULL,
        area TEXT NOT NULL,
        hourly_requirements INTEGER[] NOT NULL,
        PRIMARY KEY (date_string, area)
      );

      CREATE TABLE IF NOT EXISTS attendance (
        shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        date_string TEXT NOT NULL,
        status TEXT NOT NULL,
        PRIMARY KEY (shift_id, date_string)
      );
    `);

    // Clean existing tables in safe order
    console.log('Limpiando datos existentes en Neon Postgres...');
    await client.query('DELETE FROM attendance');
    await client.query('DELETE FROM demand');
    await client.query('DELETE FROM shifts');
    await client.query('DELETE FROM targets');
    await client.query('DELETE FROM persons');
    await client.query('DELETE FROM areas');

    // 3. Migrate areas
    const areas = localData.areas || ['Atención', 'Soporte', 'Ventas', 'Administración'];
    console.log(`Migrando ${areas.length} areas...`);
    for (const a of areas) {
      await client.query('INSERT INTO areas (name) VALUES ($1) ON CONFLICT DO NOTHING', [a]);
    }

    // 4. Migrate persons
    const persons = localData.persons || [];
    console.log(`Migrando ${persons.length} colaboradores...`);
    for (const p of persons) {
      await client.query(
        `INSERT INTO persons (id, name, area, max_daily_hours, availability_start, availability_end, color, legajo, possible_shifts) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          p.id,
          p.name,
          p.area,
          p.maxDailyHours,
          p.availabilityStart,
          p.availabilityEnd,
          p.color,
          p.legajo || null,
          p.possibleShifts ? JSON.stringify(p.possibleShifts) : null
        ]
      );
    }

    // 5. Migrate targets
    const targets = localData.targets || [];
    console.log(`Migrando ${targets.length} objetivos de cobertura...`);
    for (const t of targets) {
      await client.query(
        `INSERT INTO targets (area, day_of_week, hourly_targets) 
         VALUES ($1, $2, $3)`,
        [t.area, t.dayOfWeek, t.hourlyTargets]
      );
    }

    // 6. Migrate shifts (with runtime check for dayOfWeek legacy shifts)
    const shifts = localData.shifts || [];
    console.log(`Migrando ${shifts.length} turnos asignados...`);
    for (const s of shifts) {
      let shiftDate = s.date;
      if (s.dayOfWeek !== undefined && !s.date) {
        const baseDates = [
          '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21',
          '2026-05-22', '2026-05-23', '2026-05-24'
        ];
        shiftDate = baseDates[s.dayOfWeek - 1] || '2026-05-18';
      }
      await client.query(
        `INSERT INTO shifts (id, person_id, date, start_hour, duration, area) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [s.id, s.personId, shiftDate, s.startHour, s.duration, s.area]
      );
    }

    // 7. Migrate demand
    const demand = localData.demand || [];
    console.log(`Migrando ${demand.length} registros de demanda...`);
    for (const d of demand) {
      await client.query(
        `INSERT INTO demand (date_string, area, hourly_requirements) 
         VALUES ($1, $2, $3)`,
        [d.dateString, d.area, d.hourlyRequirements]
      );
    }

    // 8. Migrate attendance
    const attendance = localData.attendance || [];
    console.log(`Migrating ${attendance.length} registros de asistencia...`);
    for (const a of attendance) {
      await client.query(
        `INSERT INTO attendance (shift_id, date_string, status) 
         VALUES ($1, $2, $3)`,
        [a.shiftId, a.dateString, a.status]
      );
    }

    await client.query('COMMIT');
    console.log('\n🎉 ¡MIGRACION COMPLETADA CON EXITO Y CERO ERRORES EN NEON POSTGRES! 🎉');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error fatal durante la migracion, transaccion revertida:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

const pg = require('pg');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = 'https://fwsnaasfxfzacchsyijx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3c25hYXNmeGZ6YWNjaHN5aWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzkxMzksImV4cCI6MjA5MDExNTEzOX0.I9QYbMGbk53SnkfZW7ixICNW9xnUahaRxAKDPK9Vo90';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const pgClient = await pool.connect();
  try {
    console.log("Fetching data from Neon Postgres...");
    const areasRes = await pgClient.query('SELECT * FROM areas');
    const personsRes = await pgClient.query('SELECT * FROM persons');
    const shiftsRes = await pgClient.query('SELECT * FROM shifts');
    const targetsRes = await pgClient.query('SELECT * FROM targets');
    const attendanceRes = await pgClient.query('SELECT * FROM attendance');

    console.log(`Loaded: ${areasRes.rows.length} areas, ${personsRes.rows.length} persons, ${shiftsRes.rows.length} shifts, ${targetsRes.rows.length} targets, ${attendanceRes.rows.length} attendance.`);

    // 1. Insert Areas
    console.log("Inserting areas into Supabase...");
    if (areasRes.rows.length > 0) {
      const { error } = await supabase.from('planning_areas').upsert(
        areasRes.rows.map(a => ({ name: a.name })),
        { onConflict: 'name' }
      );
      if (error) console.error("Error inserting areas:", error);
      else console.log("✓ Areas migrated successfully.");
    }

    // 2. Insert Employees (planning_employees)
    console.log("Inserting employees into Supabase...");
    if (personsRes.rows.length > 0) {
      const mappedPersons = personsRes.rows.map(p => ({
        id: p.id,
        name: p.name,
        area: p.area,
        max_daily_hours: Number(p.max_daily_hours),
        availability_start: Number(p.availability_start),
        availability_end: Number(p.availability_end),
        color: p.color,
        legajo: p.legajo || "",
        possible_shifts: p.possible_shifts || []
      }));
      const { error } = await supabase.from('planning_employees').upsert(mappedPersons, { onConflict: 'id' });
      if (error) console.error("Error inserting employees:", error);
      else console.log("✓ Employees migrated successfully.");
    }

    // 3. Insert Shifts (planning_shifts)
    console.log("Inserting shifts into Supabase...");
    if (shiftsRes.rows.length > 0) {
      const mappedShifts = shiftsRes.rows.map(s => ({
        id: s.id,
        person_id: s.person_id,
        date: s.date,
        start_hour: Number(s.start_hour),
        duration: Number(s.duration),
        area: s.area
      }));
      const { error } = await supabase.from('planning_shifts').upsert(mappedShifts, { onConflict: 'id' });
      if (error) console.error("Error inserting shifts:", error);
      else console.log("✓ Shifts migrated successfully.");
    }

    // 4. Insert Targets (planning_targets)
    console.log("Inserting targets into Supabase...");
    if (targetsRes.rows.length > 0) {
      const mappedTargets = targetsRes.rows.map(t => ({
        area: t.area,
        day_of_week: Number(t.day_of_week),
        hourly_targets: t.hourly_targets || []
      }));
      const { error } = await supabase.from('planning_targets').upsert(mappedTargets, { onConflict: 'area,day_of_week' });
      if (error) console.error("Error inserting targets:", error);
      else console.log("✓ Targets migrated successfully.");
    }

    // 5. Insert Attendance (planning_attendance)
    console.log("Inserting attendance into Supabase...");
    if (attendanceRes.rows.length > 0) {
      const mappedAttendance = attendanceRes.rows.map(a => ({
        shift_id: a.shift_id,
        date_string: a.date_string,
        status: a.status
      }));
      const { error } = await supabase.from('planning_attendance').upsert(mappedAttendance, { onConflict: 'shift_id' });
      if (error) console.error("Error inserting attendance:", error);
      else console.log("✓ Attendance migrated successfully.");
    }

    console.log("========================================");
    console.log("Migration to Supabase completed successfully!");
    console.log("========================================");

  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    pgClient.release();
    await pool.end();
  }
}

run();

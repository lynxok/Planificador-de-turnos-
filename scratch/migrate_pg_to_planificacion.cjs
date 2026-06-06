const pg = require('pg');
const ftp = require('basic-ftp');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = new ftp.Client();
  const localExcelPath = path.join(__dirname, "Planificacion.xlsx");
  let pgClient;

  try {
    pgClient = await pool.connect();
    // 1. Fetch data from Postgres
    console.log("Fetching planning data from Neon Postgres...");
    
    const areasRes = await pgClient.query('SELECT * FROM areas');
    const personsRes = await pgClient.query('SELECT * FROM persons');
    const shiftsRes = await pgClient.query('SELECT * FROM shifts');
    const targetsRes = await pgClient.query('SELECT * FROM targets');
    const attendanceRes = await pgClient.query('SELECT * FROM attendance');

    const areasData = areasRes.rows.map(a => ({ name: a.name }));
    
    const personsData = personsRes.rows.map(p => ({
      id: p.id,
      name: p.name,
      area: p.area,
      maxDailyHours: Number(p.max_daily_hours),
      availabilityStart: Number(p.availability_start),
      availabilityEnd: Number(p.availability_end),
      color: p.color,
      legajo: p.legajo || "",
      possibleShifts: p.possible_shifts ? JSON.stringify(p.possible_shifts) : ""
    }));

    const shiftsData = shiftsRes.rows.map(s => ({
      id: s.id,
      personId: s.person_id,
      date: s.date,
      startHour: Number(s.start_hour),
      duration: Number(s.duration),
      area: s.area
    }));

    const targetsData = targetsRes.rows.map(t => ({
      area: t.area,
      dayOfWeek: Number(t.day_of_week),
      hourlyTargets: t.hourly_targets ? JSON.stringify(t.hourly_targets) : ""
    }));

    const attendanceData = attendanceRes.rows.map(a => ({
      shiftId: a.shift_id,
      dateString: a.date_string,
      status: a.status
    }));

    console.log(`Loaded from PG: ${areasData.length} areas, ${personsData.length} persons, ${shiftsData.length} shifts, ${targetsData.length} targets, ${attendanceData.length} attendance.`);

    // 2. Create local Planificacion.xlsx workbook
    console.log("Creating new Planificacion.xlsx workbook locally...");
    const workbook = XLSX.utils.book_new();

    const sheetsMap = {
      "areas": areasData,
      "persons": personsData,
      "shifts": shiftsData,
      "targets": targetsData,
      "attendance": attendanceData
    };

    Object.entries(sheetsMap).forEach(([sheetName, data]) => {
      console.log(`Adding sheet "${sheetName}" with ${data.length} rows...`);
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    });

    console.log("Writing Excel workbook locally...");
    XLSX.writeFile(workbook, localExcelPath);

    // 3. Connect to FTP and upload
    console.log("Connecting to FTP...");
    await client.access({
      host: process.env.FTP_HOST || "turnera-040626z.iteosrl.com.ar",
      user: process.env.FTP_USER || "ip000541",
      password: process.env.FTP_PASSWORD || "JM8Pog2SR*2a7oU",
      secure: false
    });

    const FTP_DIR = process.env.FTP_DIR || "/public_html/turnera-040626z";
    await client.cd(FTP_DIR);

    console.log("Uploading Planificacion.xlsx to FTP...");
    await client.uploadFrom(localExcelPath, "Planificacion.xlsx");
    console.log("Upload complete and successful!");

  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    if (pgClient) pgClient.release();
    await pool.end();
    client.close();
    if (fs.existsSync(localExcelPath)) {
      fs.unlinkSync(localExcelPath);
      console.log("Temporary local file cleaned up.");
    }
  }
}

runMigration();

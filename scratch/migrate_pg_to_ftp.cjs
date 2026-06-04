const pg = require('pg');
const ftp = require('basic-ftp');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = new ftp.Client();
  const localExcelPath = path.join(__dirname, "Turnos_migration.xlsx");
  const pgClient = await pool.connect();

  try {
    // 1. Fetch data from Postgres
    console.log("Fetching data from Postgres...");
    
    const areasRes = await pgClient.query('SELECT * FROM areas');
    const personsRes = await pgClient.query('SELECT * FROM persons');
    const shiftsRes = await pgClient.query('SELECT * FROM shifts');
    const targetsRes = await pgClient.query('SELECT * FROM targets');
    const attendanceRes = await pgClient.query('SELECT * FROM attendance');

    // Map to camelCase immediately for Excel storage
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

    // 2. Connect to FTP and download current Turnos.xlsx
    console.log("Connecting to FTP...");
    await client.access({
      host: "turnera-040626z.iteosrl.com.ar",
      user: "ip000541",
      password: "JM8Pog2SR*2a7oU",
      secure: false
    });

    await client.cd("/public_html/turnera-040626z");
    console.log("Downloading current Turnos.xlsx from FTP...");
    await client.downloadTo(localExcelPath, "Turnos.xlsx");
    console.log("Download complete.");

    // 3. Read workbook
    const workbook = XLSX.readFile(localExcelPath);
    console.log("Original sheets:", workbook.SheetNames);

    // Ensure Sheet1 is present
    if (!workbook.SheetNames.includes("Sheet1")) {
      throw new Error("Sheet1 (appointments sheet) is missing from the downloaded Excel file!");
    }

    // 4. Overwrite/Create planning sheets in the workbook
    const sheetsMap = {
      "areas": areasData,
      "persons": personsData,
      "shifts": shiftsData,
      "targets": targetsData,
      "attendance": attendanceData
    };

    // Remove any existing sheets with these names to prevent duplicates
    Object.keys(sheetsMap).forEach(sheetName => {
      if (workbook.SheetNames.includes(sheetName)) {
        console.log(`Removing existing sheet "${sheetName}" from workbook to overwrite it.`);
        const sheetIndex = workbook.SheetNames.indexOf(sheetName);
        workbook.SheetNames.splice(sheetIndex, 1);
        delete workbook.Sheets[sheetName];
      }
    });

    // Append new sheets
    Object.entries(sheetsMap).forEach(([sheetName, data]) => {
      console.log(`Appending sheet "${sheetName}" with ${data.length} rows...`);
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    });

    // 5. Write workbook back to the local file
    console.log("Writing modified Excel workbook locally...");
    XLSX.writeFile(workbook, localExcelPath);

    // 6. Upload back to FTP
    console.log("Uploading Turnos.xlsx back to FTP...");
    await client.uploadFrom(localExcelPath, "Turnos.xlsx");
    console.log("Upload complete and successful!");

  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    pgClient.release();
    await pool.end();
    client.close();
    if (fs.existsSync(localExcelPath)) {
      fs.unlinkSync(localExcelPath);
      console.log("Temporary file cleaned up.");
    }
  }
}

runMigration();

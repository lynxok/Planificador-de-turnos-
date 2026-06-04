import express from 'express';
import * as ftp from 'basic-ftp';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the .env file in the root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FTP_CONFIG = {
  host: process.env.FTP_HOST || "turnera-040626z.iteosrl.com.ar",
  user: process.env.FTP_USER || "ip000541",
  password: process.env.FTP_PASSWORD || "JM8Pog2SR*2a7oU",
  secure: false
};
const FTP_DIR = process.env.FTP_DIR || "/public_html/turnera-040626z";

const app = express();
app.use(express.json({ limit: '50mb' }));

// In-Memory cache variables
let personsCache: any[] = [];
let shiftsCache: any[] = [];
let targetsCache: any[] = [];
let areasCache: string[] = ['Atención', 'Soporte', 'Ventas', 'Administración'];
let attendanceCache: any[] = [];
let demandCache: any[] = [];

// Helper to convert Excel serial datetime to YYYY-MM-DD and integer hour (0-23)
function parseExcelDateTime(serial: number) {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400 * 1000;
  const dateObj = new Date(utc_value);

  const fractional_day = serial - Math.floor(serial);
  const total_seconds = Math.round(fractional_day * 24 * 60 * 60);
  const hours = Math.floor(total_seconds / 3600);
  
  const yyyy = dateObj.getUTCFullYear();
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  
  return {
    dateString: `${yyyy}-${mm}-${dd}`,
    hour: hours
  };
}

// Queue system to serialize all FTP operations and prevent race conditions
class TaskQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = false;

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.runNext();
    });
  }

  private async runNext() {
    if (this.running || this.queue.length === 0) return;
    this.running = true;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } catch (e) {
        console.error("Queue task execution error:", e);
      }
    }
    this.running = false;
    this.runNext();
  }
}

const ftpQueue = new TaskQueue();

async function syncFromFtpInternal() {
  const client = new ftp.Client();
  const localExcelPath = path.join(__dirname, `Turnos_temp_sync_${Date.now()}.xlsx`);
  try {
    console.log("Connecting to FTP to sync...");
    await client.access(FTP_CONFIG);
    await client.cd(FTP_DIR);
    console.log("Downloading Turnos.xlsx...");
    await client.downloadTo(localExcelPath, "Turnos.xlsx");
    
    console.log("Reading workbook...");
    const workbook = XLSX.readFile(localExcelPath);
    
    // Parse Sheet1 (Demand aggregation)
    if (workbook.Sheets["Sheet1"]) {
      const sheet = workbook.Sheets["Sheet1"];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];
      
      const demandMap: Record<string, { dateString: string; area: string; hourlyArtPatients: number[]; hourlyOsPatients: number[] }> = {};
      rows.forEach((row: any) => {
        const serialDate = row["Turno"];
        if (!serialDate || typeof serialDate !== "number") return;
        
        const { dateString, hour } = parseExcelDateTime(serialDate);
        const cobertura = row["Cobertura"] ? String(row["Cobertura"]).toUpperCase() : "";
        const isArt = cobertura.includes("ART");
        
        if (!demandMap[dateString]) {
          demandMap[dateString] = {
            dateString,
            area: 'Admision',
            hourlyArtPatients: Array(24).fill(0),
            hourlyOsPatients: Array(24).fill(0)
          };
        }
        
        if (hour >= 0 && hour < 24) {
          if (isArt) {
            demandMap[dateString].hourlyArtPatients[hour]++;
          } else {
            demandMap[dateString].hourlyOsPatients[hour]++;
          }
        }
      });

      demandCache = Object.values(demandMap).map(d => ({
        dateString: d.dateString,
        area: d.area,
        hourlyRequirements: Array(24).fill(0),
        hourlyArtPatients: d.hourlyArtPatients,
        hourlyOsPatients: d.hourlyOsPatients
      }));
    }

    // Parse persons
    if (workbook.Sheets["persons"]) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets["persons"]) as any[];
      personsCache = rows.map(p => ({
        id: String(p.id),
        name: String(p.name),
        area: String(p.area),
        maxDailyHours: Number(p.maxDailyHours),
        availabilityStart: Number(p.availabilityStart),
        availabilityEnd: Number(p.availabilityEnd),
        color: String(p.color),
        legajo: p.legajo ? String(p.legajo) : undefined,
        possibleShifts: p.possibleShifts ? JSON.parse(String(p.possibleShifts)) : undefined
      }));
    } else {
      personsCache = [];
    }

    // Parse shifts
    if (workbook.Sheets["shifts"]) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets["shifts"]) as any[];
      shiftsCache = rows.map(s => ({
        id: String(s.id),
        personId: String(s.personId),
        date: String(s.date),
        startHour: Number(s.startHour),
        duration: Number(s.duration),
        area: String(s.area)
      }));
    } else {
      shiftsCache = [];
    }

    // Parse targets
    if (workbook.Sheets["targets"]) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets["targets"]) as any[];
      targetsCache = rows.map(t => ({
        area: String(t.area),
        dayOfWeek: Number(t.dayOfWeek),
        hourlyTargets: t.hourlyTargets ? JSON.parse(String(t.hourlyTargets)) : Array(24).fill(0)
      }));
    } else {
      targetsCache = [];
    }

    // Parse areas
    if (workbook.Sheets["areas"]) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets["areas"]) as any[];
      areasCache = rows.map(a => String(a.name));
    } else {
      areasCache = ['Atención', 'Soporte', 'Ventas', 'Administración'];
    }

    // Parse attendance
    if (workbook.Sheets["attendance"]) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets["attendance"]) as any[];
      attendanceCache = rows.map(a => ({
        shiftId: String(a.shiftId),
        dateString: String(a.dateString),
        status: String(a.status)
      }));
    } else {
      attendanceCache = [];
    }

    console.log(`Sync from FTP successful. Demand dates: ${demandCache.length}, Persons: ${personsCache.length}, Shifts: ${shiftsCache.length}`);
  } catch (error) {
    console.error("Error in syncFromFtpInternal:", error);
    throw error;
  } finally {
    client.close();
    if (fs.existsSync(localExcelPath)) {
      try {
        fs.unlinkSync(localExcelPath);
      } catch (e) {}
    }
  }
}

async function uploadToFtpInternal(data: any) {
  const client = new ftp.Client();
  const localExcelPath = path.join(__dirname, `Turnos_temp_upload_${Date.now()}.xlsx`);
  try {
    // 1. Download current file from FTP to local to preserve Sheet1 and get current sheets
    console.log("Downloading current Turnos.xlsx from FTP to prepare upload...");
    await client.access(FTP_CONFIG);
    await client.cd(FTP_DIR);
    await client.downloadTo(localExcelPath, "Turnos.xlsx");

    const workbook = XLSX.readFile(localExcelPath);

    // Update in-memory caches
    if (data.persons) personsCache = data.persons;
    if (data.shifts) shiftsCache = data.shifts;
    if (data.targets) targetsCache = data.targets;
    if (data.areas) areasCache = data.areas;
    if (data.attendance) attendanceCache = data.attendance;

    const areasData = areasCache.map(name => ({ name }));
    const personsData = personsCache.map(p => ({
      id: p.id,
      name: p.name,
      area: p.area,
      maxDailyHours: p.maxDailyHours,
      availabilityStart: p.availabilityStart,
      availabilityEnd: p.availabilityEnd,
      color: p.color,
      legajo: p.legajo || "",
      possibleShifts: p.possibleShifts ? JSON.stringify(p.possibleShifts) : ""
    }));
    const shiftsData = shiftsCache.map(s => ({
      id: s.id,
      personId: s.personId,
      date: s.date,
      startHour: s.startHour,
      duration: s.duration,
      area: s.area
    }));
    const targetsData = targetsCache.map(t => ({
      area: t.area,
      dayOfWeek: t.dayOfWeek,
      hourlyTargets: t.hourlyTargets ? JSON.stringify(t.hourlyTargets) : ""
    }));
    const attendanceData = attendanceCache.map(a => ({
      shiftId: a.shiftId,
      dateString: a.dateString,
      status: a.status
    }));

    const sheetsMap: Record<string, any[]> = {
      "areas": areasData,
      "persons": personsData,
      "shifts": shiftsData,
      "targets": targetsData,
      "attendance": attendanceData
    };

    // Remove existing sheets from workbook
    Object.keys(sheetsMap).forEach(sheetName => {
      if (workbook.SheetNames.includes(sheetName)) {
        const sheetIndex = workbook.SheetNames.indexOf(sheetName);
        workbook.SheetNames.splice(sheetIndex, 1);
        delete workbook.Sheets[sheetName];
      }
    });

    // Append new worksheets to workbook
    Object.entries(sheetsMap).forEach(([sheetName, rows]) => {
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    });

    // Write back workbook locally
    XLSX.writeFile(workbook, localExcelPath);

    // Upload workbook back to FTP
    console.log("Uploading updated Turnos.xlsx to FTP...");
    await client.uploadFrom(localExcelPath, "Turnos.xlsx");
    console.log("Upload successful!");

    // Also update our demandCache in case Sheet1 has any new changes
    if (workbook.Sheets["Sheet1"]) {
      const sheet = workbook.Sheets["Sheet1"];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];
      const demandMap: Record<string, { dateString: string; area: string; hourlyArtPatients: number[]; hourlyOsPatients: number[] }> = {};
      rows.forEach((row: any) => {
        const serialDate = row["Turno"];
        if (!serialDate || typeof serialDate !== "number") return;
        
        const { dateString, hour } = parseExcelDateTime(serialDate);
        const cobertura = row["Cobertura"] ? String(row["Cobertura"]).toUpperCase() : "";
        const isArt = cobertura.includes("ART");
        
        if (!demandMap[dateString]) {
          demandMap[dateString] = {
            dateString,
            area: 'Admision',
            hourlyArtPatients: Array(24).fill(0),
            hourlyOsPatients: Array(24).fill(0)
          };
        }
        
        if (hour >= 0 && hour < 24) {
          if (isArt) {
            demandMap[dateString].hourlyArtPatients[hour]++;
          } else {
            demandMap[dateString].hourlyOsPatients[hour]++;
          }
        }
      });

      demandCache = Object.values(demandMap).map(d => ({
        dateString: d.dateString,
        area: d.area,
        hourlyRequirements: Array(24).fill(0),
        hourlyArtPatients: d.hourlyArtPatients,
        hourlyOsPatients: d.hourlyOsPatients
      }));
    }
  } catch (error) {
    console.error("Error in uploadToFtpInternal:", error);
    throw error;
  } finally {
    client.close();
    if (fs.existsSync(localExcelPath)) {
      try {
        fs.unlinkSync(localExcelPath);
      } catch (e) {}
    }
  }
}

// API Endpoints
app.get('/api/db', async (req, res) => {
  try {
    console.log("GET /api/db: Queueing sync operation...");
    await ftpQueue.add(async () => {
      await syncFromFtpInternal();
    });
    res.json({
      persons: personsCache,
      shifts: shiftsCache,
      targets: targetsCache,
      areas: areasCache,
      demand: demandCache,
      attendance: attendanceCache
    });
  } catch (err) {
    console.error('Failed to read database:', err);
    res.status(500).json({ error: 'Failed to read database from FTP' });
  }
});

app.post('/api/db', async (req, res) => {
  try {
    console.log("POST /api/db: Queueing upload operation...");
    const data = req.body;
    await ftpQueue.add(async () => {
      await uploadToFtpInternal(data);
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to write database:', err);
    res.status(500).json({ error: 'Failed to write database to FTP' });
  }
});

const PORT = 3021;
app.listen(PORT, async () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log("Initializing local cache from FTP on startup...");
  try {
    await ftpQueue.add(async () => {
      await syncFromFtpInternal();
    });
    console.log("Startup cache sync complete.");
  } catch (e) {
    console.error("Warning: Startup cache sync failed.", e);
  }
});

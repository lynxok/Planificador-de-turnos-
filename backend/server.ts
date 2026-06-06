import express from 'express';
import * as ftp from 'basic-ftp';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.SUPABASE_URL || 'https://fwsnaasfxfzacchsyijx.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3c25hYXNmeGZ6YWNjaHN5aWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzkxMzksImV4cCI6MjA5MDExNTEzOX0.I9QYbMGbk53SnkfZW7ixICNW9xnUahaRxAKDPK9Vo90';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    console.log("Connecting to FTP to sync turnos...");
    await client.access(FTP_CONFIG);
    await client.cd(FTP_DIR);
    console.log("Downloading Turnos.xlsx...");
    await client.downloadTo(localExcelPath, "Turnos.xlsx");
    
    console.log("Reading Turnos workbook...");
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

    // 2. Fetch planning data from Supabase
    console.log("Fetching planning data from Supabase...");
    
    // Fetch areas
    const areasRes = await supabase.from('planning_areas').select('*');
    if (areasRes.error) throw areasRes.error;
    areasCache = areasRes.data.map(a => String(a.name));
    if (areasCache.length === 0) {
      areasCache = ['Atención', 'Soporte', 'Ventas', 'Administración'];
    }

    // Fetch employees (planning_employees)
    const personsRes = await supabase.from('planning_employees').select('*');
    if (personsRes.error) throw personsRes.error;
    personsCache = personsRes.data.map(p => ({
      id: String(p.id),
      name: String(p.name),
      area: String(p.area),
      maxDailyHours: Number(p.max_daily_hours),
      availabilityStart: Number(p.availability_start),
      availabilityEnd: Number(p.availability_end),
      color: String(p.color),
      legajo: p.legajo ? String(p.legajo) : undefined,
      possibleShifts: p.possible_shifts || []
    }));

    // Fetch shifts (planning_shifts)
    const shiftsRes = await supabase.from('planning_shifts').select('*');
    if (shiftsRes.error) throw shiftsRes.error;
    shiftsCache = shiftsRes.data.map(s => ({
      id: String(s.id),
      personId: String(s.person_id),
      date: String(s.date),
      startHour: Number(s.start_hour),
      duration: Number(s.duration),
      area: String(s.area)
    }));

    // Fetch targets (planning_targets)
    const targetsRes = await supabase.from('planning_targets').select('*');
    if (targetsRes.error) throw targetsRes.error;
    targetsCache = targetsRes.data.map(t => ({
      area: String(t.area),
      dayOfWeek: Number(t.day_of_week),
      hourlyTargets: t.hourly_targets || Array(24).fill(0)
    }));

    // Fetch attendance (planning_attendance)
    const attendanceRes = await supabase.from('planning_attendance').select('*');
    if (attendanceRes.error) throw attendanceRes.error;
    attendanceCache = attendanceRes.data.map(a => ({
      shiftId: String(a.shift_id),
      dateString: String(a.date_string),
      status: String(a.status)
    }));

    console.log(`Sync from FTP & Supabase successful. Demand dates: ${demandCache.length}, Persons: ${personsCache.length}, Shifts: ${shiftsCache.length}`);
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
  try {
    console.log("Updating in-memory caches and writing to Supabase...");
    
    // Update caches in memory if provided
    if (data.persons) personsCache = data.persons;
    if (data.shifts) shiftsCache = data.shifts;
    if (data.targets) targetsCache = data.targets;
    if (data.areas) areasCache = data.areas;
    if (data.attendance) attendanceCache = data.attendance;

    // 1. Save areas
    if (data.areas) {
      await supabase.from('planning_areas').delete().neq('name', 'dummy_delete_val_xyz');
      if (areasCache.length > 0) {
        const { error } = await supabase.from('planning_areas').insert(areasCache.map(name => ({ name })));
        if (error) throw error;
      }
    }

    // 2. Save employees
    if (data.persons) {
      await supabase.from('planning_employees').delete().neq('id', 'dummy_delete_val_xyz');
      if (personsCache.length > 0) {
        const mappedPersons = personsCache.map(p => ({
          id: p.id,
          name: p.name,
          area: p.area,
          max_daily_hours: Number(p.maxDailyHours),
          availability_start: Number(p.availabilityStart),
          availability_end: Number(p.availabilityEnd),
          color: p.color,
          legajo: p.legajo || "",
          possible_shifts: p.possibleShifts || []
        }));
        const { error } = await supabase.from('planning_employees').insert(mappedPersons);
        if (error) throw error;
      }
    }

    // 3. Save shifts
    if (data.shifts) {
      await supabase.from('planning_shifts').delete().neq('id', 'dummy_delete_val_xyz');
      if (shiftsCache.length > 0) {
        const mappedShifts = shiftsCache.map(s => ({
          id: s.id,
          person_id: s.personId,
          date: s.date,
          start_hour: Number(s.startHour),
          duration: Number(s.duration),
          area: s.area
        }));
        const { error } = await supabase.from('planning_shifts').insert(mappedShifts);
        if (error) throw error;
      }
    }

    // 4. Save targets
    if (data.targets) {
      await supabase.from('planning_targets').delete().neq('area', 'dummy_delete_val_xyz');
      if (targetsCache.length > 0) {
        const mappedTargets = targetsCache.map(t => ({
          area: t.area,
          day_of_week: Number(t.dayOfWeek),
          hourly_targets: t.hourlyTargets || []
        }));
        const { error } = await supabase.from('planning_targets').insert(mappedTargets);
        if (error) throw error;
      }
    }

    // 5. Save attendance
    if (data.attendance) {
      await supabase.from('planning_attendance').delete().neq('shift_id', 'dummy_delete_val_xyz');
      if (attendanceCache.length > 0) {
        const mappedAttendance = attendanceCache.map(a => ({
          shift_id: a.shiftId,
          date_string: a.dateString,
          status: a.status
        }));
        const { error } = await supabase.from('planning_attendance').insert(mappedAttendance);
        if (error) throw error;
      }
    }

    console.log("Supabase save complete!");
  } catch (error) {
    console.error("Error in uploadToFtpInternal:", error);
    throw error;
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
    res.status(500).json({ error: 'Failed to read database from Supabase/FTP' });
  }
});

app.post('/api/db', async (req, res) => {
  try {
    console.log("POST /api/db: Queueing upload operation...");
    const data = req.body;

    // Safety guard: prevent overwriting with empty persons list due to frontend loading issues
    if (data.persons !== undefined && (!Array.isArray(data.persons) || data.persons.length === 0)) {
      console.warn("Safety guard triggered: POST payload has empty persons array. Aborting database overwrite to prevent data loss.");
      return res.status(400).json({ error: "Safety guard: persons array cannot be empty." });
    }

    await ftpQueue.add(async () => {
      await uploadToFtpInternal(data);
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to write database:', err);
    res.status(500).json({ error: 'Failed to write database to Supabase' });
  }
});

const PORT = 3021;
app.listen(PORT, async () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log("Initializing local cache from FTP & Supabase on startup...");
  try {
    await ftpQueue.add(async () => {
      await syncFromFtpInternal();
    });
    console.log("Startup cache sync complete.");
  } catch (e) {
    console.error("Warning: Startup cache sync failed.", e);
  }
});

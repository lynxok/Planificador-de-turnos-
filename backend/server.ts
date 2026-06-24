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
  secure: true,
  secureOptions: {
    rejectUnauthorized: false
  }
};
const FTP_DIR = process.env.FTP_DIR || "/public_html/turnera-040626z";

const supabaseUrl = process.env.SUPABASE_URL || 'https://fwsnaasfxfzacchsyijx.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3c25hYXNmeGZ6YWNjaHN5aWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzkxMzksImV4cCI6MjA5MDExNTEzOX0.I9QYbMGbk53SnkfZW7ixICNW9xnUahaRxAKDPK9Vo90';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
app.use(express.json({ limit: '50mb' }));

// Serve static files from the dist directory in production
app.use(express.static(path.resolve(__dirname, '../dist')));

// In-Memory cache variables
let personsCache: any[] = [];
let shiftsCache: any[] = [];
let targetsCache: any[] = [];
let areasCache: string[] = ['Atención', 'Soporte', 'Ventas', 'Administración'];
let attendanceCache: any[] = [];
let demandCache: any[] = [];
let appointmentsCache: any[] = [];
let professionalsCache: any[] = [];
let coveragesCache: any[] = [];
let appointmentsSummaryCache: any[] = [];

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

function parseExcelDateTimeForUpsert(serial: number) {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400 * 1000;
  const dateObj = new Date(utc_value);

  const fractional_day = serial - Math.floor(serial);
  const total_seconds = Math.round(fractional_day * 24 * 60 * 60);
  const hours = Math.floor(total_seconds / 3600);
  const minutes = Math.floor((total_seconds % 3600) / 60);
  const seconds = total_seconds % 60;
  
  const yyyy = dateObj.getUTCFullYear();
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

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
      console.log(`Loaded ${rows.length} rows from Excel Sheet1.`);
      
      console.log("Mapping and deduplicating rows...");
      const uniqueMap = new Map();
      rows.forEach((r: any) => {
        const serial = r["Turno"];
        if (!serial || typeof serial !== 'number') return;
        
        const turnoTimestamp = parseExcelDateTimeForUpsert(serial);
        const key = `${String(r["Paciente"]).trim().toUpperCase()}_${String(r["Profesional"]).trim().toUpperCase()}_${turnoTimestamp}`;
        
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            paciente: r["Paciente"] ? String(r["Paciente"]).trim() : "",
            profesional: r["Profesional"] ? String(r["Profesional"]).trim() : "",
            cobertura: r["Cobertura"] ? String(r["Cobertura"]).trim() : "",
            turno: turnoTimestamp,
            asistio: r["Asistio"] !== undefined && r["Asistio"] !== null ? Number(r["Asistio"]) : 0,
            atendido: r["Atendido"] !== undefined && r["Atendido"] !== null ? Number(r["Atendido"]) : 0,
            nro_hc: r["NroHc"] !== undefined && r["NroHc"] !== null ? String(r["NroHc"]).trim() : ""
          });
        }
      });
      const mappedRows = Array.from(uniqueMap.values());
      console.log(`Mapped ${mappedRows.length} unique rows.`);
      
      // Batch upsert to Supabase
      const BATCH_SIZE = 1000;
      console.log(`Upserting to Supabase in batches of ${BATCH_SIZE}...`);
      for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
        const batch = mappedRows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('planning_patient_appointments')
          .upsert(batch, { onConflict: 'paciente,profesional,turno' });
        if (error) {
          console.error(`Error uploading batch at index ${i}:`, error.message);
          throw error;
        }
      }
      console.log("Database upsert complete.");
    }
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

async function fetchAllFromSupabase() {
  console.log("Fetching all planning data from Supabase...");
  
  // 1. Fetch areas
  const areasRes = await supabase.from('planning_areas').select('*');
  if (areasRes.error) throw areasRes.error;
  areasCache = areasRes.data.map(a => String(a.name));
  if (areasCache.length === 0) {
    areasCache = ['Atención', 'Soporte', 'Ventas', 'Administración'];
  }

  // 2. Fetch employees (planning_employees)
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

  // 3. Fetch shifts (planning_shifts)
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

  // 4. Fetch targets (planning_targets)
  const targetsRes = await supabase.from('planning_targets').select('*');
  if (targetsRes.error) throw targetsRes.error;
  targetsCache = targetsRes.data.map(t => ({
    area: String(t.area),
    dayOfWeek: Number(t.day_of_week),
    hourlyTargets: t.hourly_targets || Array(24).fill(0)
  }));

  // 5. Fetch attendance (planning_attendance)
  const attendanceRes = await supabase.from('planning_attendance').select('*');
  if (attendanceRes.error) throw attendanceRes.error;
  attendanceCache = attendanceRes.data.map(a => ({
    shiftId: String(a.shift_id),
    dateString: String(a.date_string),
    status: String(a.status)
  }));

  // 6. Fetch demand from our aggregated database view
  console.log("Fetching aggregated demand from database view...");
  let allDemandRows: any[] = [];
  let pageIndex = 0;
  const pageSize = 1000;
  while (true) {
    const demandRes = await supabase
      .from('planning_patient_demand_view')
      .select('*')
      .range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1);
    if (demandRes.error) throw demandRes.error;
    if (!demandRes.data || demandRes.data.length === 0) break;
    allDemandRows = allDemandRows.concat(demandRes.data);
    if (demandRes.data.length < pageSize) break;
    pageIndex++;
  }
  
  const demandMap: Record<string, { dateString: string; area: string; hourlyRequirements: number[]; hourlyArtPatients: number[]; hourlyOsPatients: number[] }> = {};
  allDemandRows.forEach((row: any) => {
    const dateStr = row.date_string;
    const hour = row.hour;
    const isArt = row.is_art;
    const count = row.count;
    
    if (!demandMap[dateStr]) {
      demandMap[dateStr] = {
        dateString: dateStr,
        area: 'Admision',
        hourlyRequirements: Array(24).fill(0),
        hourlyArtPatients: Array(24).fill(0),
        hourlyOsPatients: Array(24).fill(0)
      };
    }
    
    if (hour >= 0 && hour < 24) {
      if (isArt) {
        demandMap[dateStr].hourlyArtPatients[hour] += count;
      } else {
        demandMap[dateStr].hourlyOsPatients[hour] += count;
      }
    }
  });
  demandCache = Object.values(demandMap);

  // 7. Fetch professionals metadata
  console.log("Fetching professionals metadata...");
  const { data: profsData, error: profsErr } = await supabase.from('turnera_profesionales').select('*');
  if (profsErr) throw profsErr;
  professionalsCache = profsData || [];

  // 8. Fetch coverages metadata
  console.log("Fetching coverages metadata...");
  const { data: cobsData, error: cobsErr } = await supabase.from('turnera_coberturas').select('*');
  if (cobsErr) throw cobsErr;
  coveragesCache = cobsData || [];

  // 9. Fetch all appointments from Supabase (planning_patient_appointments)
  console.log("Fetching all patient appointments from Supabase...");
  let allAppts: any[] = [];
  let apptsPageIndex = 0;
  const apptsPageSize = 1000;
  while (true) {
    const { data: apptsData, error: apptsErr } = await supabase
      .from('planning_patient_appointments')
      .select('profesional, cobertura, turno, asistio, atendido')
      .range(apptsPageIndex * apptsPageSize, (apptsPageIndex + 1) * apptsPageSize - 1);
    
    if (apptsErr) throw apptsErr;
    if (!apptsData || apptsData.length === 0) break;
    allAppts = allAppts.concat(apptsData);
    if (apptsData.length < apptsPageSize) break;
    apptsPageIndex++;
  }
  appointmentsCache = allAppts;

  // 10. Build the appointments summary cache for analysis
  console.log(`Processing ${allAppts.length} appointments for analysis dashboard...`);
  appointmentsSummaryCache = allAppts.map(r => {
    let fechaLimpia = "Fecha desconocida";
    let horaLimpia = "00:00";
    if (r.turno) {
      const parts = r.turno.split('T');
      if (parts[0]) {
        const dateParts = parts[0].split('-');
        if (dateParts.length === 3) {
          fechaLimpia = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        }
      }
      if (parts[1]) {
        horaLimpia = parts[1].substring(0, 5);
      }
    }

    const prof = String(r.profesional || "").trim();
    const cob = String(r.cobertura || "").trim();

    const profObj = professionalsCache.find(p => String(p.profesional).trim().toUpperCase() === prof.toUpperCase());
    const tipoConsulta = profObj ? profObj.tipo_consulta : "Sin Clasificar";

    const cobObj = coveragesCache.find(c => String(c.cobertura).trim().toUpperCase() === cob.toUpperCase());
    const clase = cobObj ? cobObj.clase : "Sin Clasificar";

    const atendidoLabel = (r.asistio === 1 || r.atendido === 1) ? "Asistió" : "No asistió";

    return {
      FechaLimpia: fechaLimpia,
      Doctor: r.profesional || "Sin Médico",
      CoberturaLimpia: r.cobertura || "Sin Cobertura",
      HoraLimpia: horaLimpia,
      Clase: clase,
      "Tipo Consulta": tipoConsulta,
      Atendido_Label: atendidoLabel
    };
  });

  console.log(`Fetch complete. Employees: ${personsCache.length}, Shifts: ${shiftsCache.length}, Demand days: ${demandCache.length}, Total Analysis Appointments: ${appointmentsSummaryCache.length}`);
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
    // Serve instantly from cache (sub-50ms)
    res.json({
      persons: personsCache,
      shifts: shiftsCache,
      targets: targetsCache,
      areas: areasCache,
      demand: demandCache,
      attendance: attendanceCache
    });
    // Trigger background cache refresh to ensure it stays in sync
    fetchAllFromSupabase().catch(err => {
      console.error("Background Supabase fetch failed:", err);
    });
  } catch (err) {
    console.error('Failed to read database:', err);
    res.status(500).json({ error: 'Failed to read database' });
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

app.post('/api/sync-demand', async (req, res) => {
  try {
    console.log("POST /api/sync-demand: Queueing demand sync operation...");
    await ftpQueue.add(async () => {
      await syncFromFtpInternal();
      await fetchAllFromSupabase();
    });
    res.json({ success: true, demandCount: demandCache.length });
  } catch (err: any) {
    console.error('Failed to sync demand:', err);
    res.status(500).json({ error: 'Failed to sync demand from FTP', details: err.message });
  }
});

app.get('/api/appointments-summary', (req, res) => {
  res.json(appointmentsSummaryCache);
});

// Fallback route to serve index.html for SPA routing (must be placed after all API endpoints)
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../dist/index.html'));
});

const PORT = 3021;
app.listen(PORT, async () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log("Initializing local cache from Supabase on startup...");
  try {
    await fetchAllFromSupabase();
    console.log("Startup cache sync complete.");
  } catch (e) {
    console.error("Warning: Startup cache sync failed.", e);
  }
});

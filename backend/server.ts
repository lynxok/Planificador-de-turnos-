import express from 'express';
import * as ftp from 'basic-ftp';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import alasql from 'alasql';

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

const supabaseUrl = process.env.SUPABASE_URL || 'https://wbguwmbwutvhqsirtjps.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_HHSflu6QFeTOAOz32W2UdQ_wSQyiPIC';
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'control_de_horas' }
});

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
let aiQueryCache: any[] = [];

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
    
    // Fetch rehabilitation professionals to filter out bug appointments
    console.log("Fetching rehabilitation professionals list for filtering...");
    const { data: rehabProfs, error: rehabErr } = await supabase
      .from('turnera_profesionales')
      .select('profesional')
      .eq('tipo_consulta', 'REHABILITACION');
    
    if (rehabErr) throw rehabErr;
    const rehabProfsSet = new Set((rehabProfs || []).map(p => String(p.profesional).trim().toUpperCase()));
    console.log(`Loaded ${rehabProfsSet.size} rehabilitation professionals for blacklist filtering.`);

    {
      const today = new Date();
      const startRange = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const startRangeStr = `${startRange.getFullYear()}-${String(startRange.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
      
      const endRange = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      const endRangeStr = `${endRange.getFullYear()}-${String(endRange.getMonth() + 1).padStart(2, '0')}-${String(endRange.getDate()).padStart(2, '0')}T23:59:59`;
      
      console.log(`Purging ALL existing appointments in Supabase from ${startRangeStr} to ${endRangeStr} to remove canceled/ghost sessions...`);
      const { error: purgeErr } = await supabase
        .from('planning_patient_appointments')
        .delete()
        .gte('turno', startRangeStr)
        .lte('turno', endRangeStr);
        
      if (purgeErr) {
        console.error("Warning: could not purge old appointments:", purgeErr.message);
      } else {
        console.log("✓ Purged old appointments successfully.");
      }
    }

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

        // Check for rehabilitation appointments bug (administrative rows outside work hours, e.g. 22hs, 23hs, 00hs)
        const fractional_day = serial - Math.floor(serial);
        const total_seconds = Math.round(fractional_day * 24 * 60 * 60);
        const hours = Math.floor(total_seconds / 3600);

        const profName = r["Profesional"] ? String(r["Profesional"]).trim().toUpperCase() : "";
        if ((hours < 7 || hours > 21) && rehabProfsSet.has(profName)) {
          // Skip this bug row
          return;
        }
        
        const turnoTimestamp = parseExcelDateTimeForUpsert(serial);
        const key = `${String(r["Paciente"]).trim().toUpperCase()}_${String(r["Profesional"]).trim().toUpperCase()}_${turnoTimestamp}`;
        
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            id: crypto.randomUUID(),
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
          console.error("Batch upsert error:", error);
          throw error;
        }
      }

      // Automatically register missing professionals
      try {
        console.log("Checking for new professionals to add to the master table...");
        const { data: currentDocs, error: docsErr } = await supabase
          .from('turnera_profesionales')
          .select('id, profesional');
          
        if (!docsErr && currentDocs) {
          const existingNames = new Set(currentDocs.map(d => String(d.profesional).trim().toUpperCase()));
          let maxId = Math.max(...currentDocs.map(d => d.id || 0), 0);
          
          // Find unique professionals from mappedRows that aren't in existingNames
          const allExcelProfs = new Set(mappedRows.map(r => r.profesional.toUpperCase()));
          const newProfs: string[] = [];
          allExcelProfs.forEach(p => {
            if (p && !existingNames.has(p)) newProfs.push(p);
          });
          
          if (newProfs.length > 0) {
            console.log(`Found ${newProfs.length} new professionals. Registering them...`);
            const insertData = newProfs.map((name, i) => ({ id: maxId + 1 + i, profesional: name }));
            const { error: insertErr } = await supabase
              .from('turnera_profesionales')
              .insert(insertData);
              
            if (insertErr) console.error("Could not insert new professionals:", insertErr.message);
            else console.log("New professionals registered successfully.");
          } else {
            console.log("No new professionals found.");
          }
        }
      } catch (e) {
        console.error("Failed to sync new professionals:", e);
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
      .select('paciente, nro_hc, profesional, cobertura, turno, asistio, atendido')
      .range(apptsPageIndex * apptsPageSize, (apptsPageIndex + 1) * apptsPageSize - 1);
    
    if (apptsErr) throw apptsErr;
    if (!apptsData || apptsData.length === 0) break;
    allAppts = allAppts.concat(apptsData);
    if (apptsData.length < apptsPageSize) break;
    apptsPageIndex++;
  }
  appointmentsCache = allAppts;
    aiQueryCache = allAppts.map(r => {
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
      return {
        paciente: r.paciente,
        nro_hc: r.nro_hc,
        profesional: r.profesional,
        cobertura: r.cobertura,
        fecha: fechaLimpia,
        hora: horaLimpia,
        asistio: r.asistio ? 'Sí' : 'No',
        atendido: r.atendido ? 'Sí' : 'No',
        turno: r.turno
      };
    });

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

app.post('/api/bot-query', async (req, res) => {
  try {
    const { query, apiKey, history = [] } = req.body;
    if (!query || !apiKey) return res.status(400).json({ error: 'Query y apiKey son obligatorios' });
    
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    
    let historyContext = '';
    if (history && history.length > 0) {
      historyContext = "\nHistorial de la conversación:\n" + history.map((m: any) => `${m.role === 'user' ? 'Usuario' : 'Bot'}: ${m.content}`).join('\n') + "\n";
    }
    
    const nombresMedicos = professionalsCache.map(p => p.profesional).join(', ');
    const fechaHoyIso = new Date().toISOString().split('T')[0];
    
    const prompt = `Eres un asistente experto en SQL (AlaSQL / SQLite) y análisis de datos médicos.
Tienes acceso de lectura a la tabla 'planning_patient_appointments'.
La fecha de hoy es: ${fechaHoyIso}. Si el usuario pide datos de "hoy", "este mes", etc., utiliza esta fecha como referencia.
El esquema EXACTO de la tabla es el siguiente:
- paciente (text)
- nro_hc (text, número de historia clínica)
- profesional (text)
- cobertura (text, obra social)
- fecha (text, formato 'DD/MM/YYYY')
- hora (text, formato 'HH:mm')
- asistio (text, valores: 'Sí' o 'No')
- atendido (text, valores: 'Sí' o 'No')
- turno (text, formato ISO 'YYYY-MM-DDTHH:mm:ss.sssZ')

Los médicos disponibles en la base de datos son: ${nombresMedicos}.

Tu objetivo es responder a la petición del usuario de forma útil, amigable y profesional.
Considera el historial de la conversación si el usuario hace referencia a algo dicho anteriormente o responde con una confirmación.

IMPORTANTE: 
1. Escribe un mensaje de respuesta (fuera de los bloques de código) explicando qué datos estás mostrando o confirmando la acción.
2. Si la solicitud es clara, debes incluir UNA consulta SQL válida envuelta en bloques de código \`\`\`sql ... \`\`\`. 
3. Si el usuario pide un reporte para un médico cuyo nombre está mal escrito, es un apodo, o es ambiguo, NO generes la consulta SQL. En su lugar, pregúntale amablemente: "¿Te refieres a [nombre exacto del médico]?" sugiriendo el nombre correcto de la lista de médicos disponibles.
4. Solo puedes hacer SELECT. No uses UPDATE, DELETE ni INSERT.
5. Si la pregunta pide agrupaciones, cantidades o dice la palabra "totalízalos", "cuántos", o "suma", debes usar COUNT, SUM y GROUP BY obligatoriamente para devolver los totales, en lugar de un listado fila por fila. Si te piden un listado Y totalizarlo, prioriza mostrar la tabla agrupada con los totales por cada ítem.
6. El campo 'turno' es una cadena de texto (ISO). Si te piden filtrar por fechas, usa SIEMPRE el operador LIKE (ejemplo: turno LIKE '${fechaHoyIso.substring(0,7)}%'). NUNCA uses funciones como strftime() o EXTRACT() ya que no son compatibles con el motor.
7. Si el usuario te pide un filtro por hora (ej. "de 10 a 12", "despues de las 14"), usa la función SUBSTRING(turno, 12, 2) para comparar la hora. Por ejemplo: CAST(SUBSTRING(turno, 12, 2) AS INT) >= 10 AND CAST(SUBSTRING(turno, 12, 2) AS INT) <= 12.
${historyContext}
Petición actual del usuario: "${query}"`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt
    });
    
    const text = response.text || '';
    const sqlMatch = text.match(/```sql\s*([\s\S]*?)\s*```/);
    const conversationalMessage = text.replace(/```sql\s*([\s\S]*?)\s*```/, '').trim();
    
    let rows: any[] | null = null;
    
    if (sqlMatch) {
      const sql = sqlMatch[1].trim();
      if (!sql.toLowerCase().startsWith('select')) {
         return res.status(400).json({ error: 'El bot intentó ejecutar una consulta inválida (no es SELECT).' });
      }
      
      // Execute raw query using in-memory alasql on the cached data
      console.log("\n--- EJECUTANDO SQL ---\n" + sql + "\n-----------------------\n");
      
      try {
        let executableSql = sql.replace(/planning_patient_appointments/gi, '?');
        rows = alasql(executableSql, [aiQueryCache]);
      } catch (sqlError: any) {
        console.error("SQL Error in Bot Query:", sqlError.message);
        return res.json({ 
          success: false, 
          message: "Lo siento, la consulta generada fue demasiado compleja o tuvo un error de sintaxis en el motor de base de datos local. Por favor, intentá reformular la pregunta más simple.", 
          results: null,
          error: true
        });
      }
    }
    
    res.json({
      success: true,
      results: rows,
      message: conversationalMessage || 'Acá tenés los datos solicitados.'
    });
  } catch (err: any) {
    console.error('Failed to process bot query:', err);
    // Return a 200 with error=true so the UI can display it gracefully instead of breaking
    return res.json({ 
      success: false, 
      message: "Hubo un error de conexión con la Inteligencia Artificial (probablemente Google Gemini está saturado o la consulta fue muy larga). Por favor, esperá unos segundos y volvé a intentar.", 
      results: null,
      error: true
    });
  }
});

app.get('/api/appointments-summary', (req, res) => {
  res.json(appointmentsSummaryCache);
});

// Fallback route to serve index.html for SPA routing (must be placed after all API endpoints)
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../dist/index.html'));
});

const PORT = 1950;
app.listen(PORT, async () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log("Initializing local cache from Supabase on startup...");
  try {
    await fetchAllFromSupabase();
    console.log("Startup cache sync complete.");
    
    // Auto-refresh the cache every 10 minutes in the background
    setInterval(async () => {
      console.log("Background cache refresh started...");
      try {
        await fetchAllFromSupabase();
        console.log("Background cache refresh complete.");
      } catch (err) {
        console.error("Background cache refresh failed:", err);
      }
    }, 10 * 60 * 1000);
    
  } catch (e) {
    console.error("Warning: Startup cache sync failed.", e);
  }
});

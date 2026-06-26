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

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'control_de_horas' }
});

function parseExcelDateTimeForUpsert(serial) {
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

async function runSync() {
  const client = new ftp.Client();
  const localExcelPath = path.join(__dirname, `../Turnos_temp_sync_action.xlsx`);
  
  try {
    console.log("Connecting to FTP to sync turnos...");
    await client.access(FTP_CONFIG);
    await client.cd(FTP_DIR);
    console.log("Downloading Turnos.xlsx...");
    await client.downloadTo(localExcelPath, "Turnos.xlsx");
    
    console.log("Reading Turnos workbook...");
    const workbook = XLSX.readFile(localExcelPath);
    
    if (workbook.Sheets["Sheet1"]) {
      const sheet = workbook.Sheets["Sheet1"];
      const rows = XLSX.utils.sheet_to_json(sheet);
      console.log(`Loaded ${rows.length} rows from Excel Sheet1.`);
      
      console.log("Mapping and deduplicating rows...");
      const uniqueMap = new Map();
      rows.forEach((r) => {
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
      console.log("✓ Database upsert complete. Synchronization successful!");
      
      await supabase.from('planning_sync_logs').insert({
        status: 'SUCCESS',
        source: 'GITHUB_ACTIONS',
        details: { message: `Sincronizados ${mappedRows.length} turnos.` }
      });
    } else {
      console.warn("Sheet1 not found in Turnos.xlsx");
    }
  } catch (error) {
    console.error("Critical error during sync:", error);
    try {
      await supabase.from('planning_sync_logs').insert({
        status: 'ERROR',
        source: 'GITHUB_ACTIONS',
        details: { message: error.message || String(error) }
      });
    } catch (logErr) {
      console.error("Could not write error log to Supabase:", logErr);
    }
    process.exit(1);
  } finally {
    client.close();
    if (fs.existsSync(localExcelPath)) {
      try {
        fs.unlinkSync(localExcelPath);
      } catch (e) {}
    }
  }
}

runSync();

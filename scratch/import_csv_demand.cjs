const fs = require('fs');
const path = require('path');
const pg = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Configuración de base de datos
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Función factorial para Erlang C
function factorial(n) {
  if (n === 0 || n === 1) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// Algoritmo Erlang C dinámico
function calculateAgentsRequired(
  artCalls, 
  osCalls,
  artServiceTime = 6,  // minutos
  osServiceTime = 4,   // minutos
  targetWaitTime = 8,  // minutos
  slaTarget = 0.85     // SLA
) {
  if (artCalls === 0 && osCalls === 0) return 0;
  
  const lambda = artCalls + osCalls;
  const totalServiceTimeHours = (artCalls * artServiceTime + osCalls * osServiceTime) / 60;
  const Ts = totalServiceTimeHours / lambda;
  const A = lambda * Ts;
  
  let m = Math.floor(A) + 1;
  const targetWaitHrs = targetWaitTime / 60;
  const targetProbability = 1 - slaTarget;
  
  while (m < A + 100) {
    let sum = 0;
    for (let i = 0; i < m; i++) {
      sum += Math.pow(A, i) / factorial(i);
    }
    const term2 = (Math.pow(A, m) / factorial(m)) * (m / (m - A));
    const Pw = term2 / (sum + term2);
    const pWaitTarget = Pw * Math.exp(-(m - A) * (targetWaitHrs / Ts));
    
    if (pWaitTarget < targetProbability) {
      break;
    }
    m++;
  }
  
  return m;
}

async function importCsv() {
  const csvPath = path.join(__dirname, '..', 'Reporte_ART_OS.csv');
  console.log('Leyendo archivo CSV en:', csvPath);
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ El archivo CSV no existe en la ruta especificada.');
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  if (lines.length <= 1) {
    console.error('❌ El archivo CSV no tiene registros.');
    process.exit(1);
  }

  // Estructura para agrupar por fecha
  // dateString => { art: number[], os: number[] }
  const dataByDate = {};

  lines.slice(1).forEach((line, index) => {
    const parts = line.split(';');
    if (parts.length < 4) return;

    const rawDate = parts[0].trim();
    const rawHour = parts[1].trim();
    const rawArt = parts[2].trim();
    const rawOs = parts[3].trim();

    if (!rawDate || rawDate.toLowerCase().includes('desconocida') || rawHour.toLowerCase() === 'n/a') {
      return;
    }

    // Convertir fecha DD/MM/YYYY a YYYY-MM-DD
    let dateStr = '';
    if (rawDate.includes('/')) {
      const p = rawDate.split('/');
      if (p.length === 3) {
        const dd = p[0].padStart(2, '0');
        const mm = p[1].padStart(2, '0');
        const yyyy = p[2];
        dateStr = `${yyyy}-${mm}-${dd}`;
      }
    } else {
      dateStr = rawDate;
    }

    const hour = parseInt(rawHour, 10);
    const art = parseInt(rawArt, 10) || 0;
    const os = parseInt(rawOs, 10) || 0;

    if (dateStr && !isNaN(hour) && hour >= 0 && hour <= 23) {
      if (!dataByDate[dateStr]) {
        dataByDate[dateStr] = {
          art: Array(24).fill(0),
          os: Array(24).fill(0)
        };
      }
      dataByDate[dateStr].art[hour] = art;
      dataByDate[dateStr].os[hour] = os;
    }
  });

  const dates = Object.keys(dataByDate);
  console.log(`📅 Se detectaron ${dates.length} fechas con registros de demanda en el CSV.`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Eliminamos los registros previos de Admision para evitar incoherencias y duplicados
    await client.query("DELETE FROM demand WHERE area = 'Admision'");
    console.log('🧹 Limpieza de registros previos de demanda para Admision completada.');

    let insertedCount = 0;

    for (const dateStr of dates) {
      const artPatients = dataByDate[dateStr].art;
      const osPatients = dataByDate[dateStr].os;
      
      // Calcular requisitos por hora con Erlang C
      const requirements = Array(24).fill(0).map((_, h) => {
        return calculateAgentsRequired(artPatients[h], osPatients[h], 6, 4, 8, 0.85);
      });

      await client.query(
        `INSERT INTO demand (date_string, area, hourly_requirements, hourly_art_patients, hourly_os_patients) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (date_string, area) 
         DO UPDATE SET hourly_requirements = $3, hourly_art_patients = $4, hourly_os_patients = $5`,
        [dateStr, 'Admision', requirements, artPatients, osPatients]
      );
      
      insertedCount++;
    }

    await client.query('COMMIT');
    console.log(`⚡ ¡Inyección Exitosa! Se insertaron/actualizaron ${insertedCount} fechas con sus curvas de pacientes y dotaciones en Neon Postgres.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error al insertar datos en la base de datos:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

importCsv();

const ftp = require("basic-ftp");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

// Helper para convertir fecha serial de Excel a string YYYY-MM-DD y hora (0-23)
function parseExcelDateTime(serial) {
  // Las fechas de Excel comienzan el 1 de enero de 1900.
  // El error bisiesto de Excel (1900 es tratado como bisiesto) suma 1 día de desfase.
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400 * 1000;
  const dateObj = new Date(utc_value);

  // Ajustar zona horaria local (Argentina, UTC-3 por ejemplo, o simplemente formatear directo)
  // Dado que el serial incluye la fracción del día para la hora:
  const fractional_day = serial - Math.floor(serial);
  let total_seconds = Math.round(fractional_day * 24 * 60 * 60);
  const hours = Math.floor(total_seconds / 3600);
  
  // Obtener año, mes, día
  const yyyy = dateObj.getUTCFullYear();
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  
  return {
    dateString: `${yyyy}-${mm}-${dd}`,
    hour: hours
  };
}

async function aggregateDemand() {
  const client = new ftp.Client();
  const localPath = path.join(__dirname, "Turnos_remote.xlsx");
  try {
    console.log("Descargando Turnos.xlsx...");
    await client.access({
      host: "turnera-040626z.iteosrl.com.ar",
      user: "ip000541",
      password: "JM8Pog2SR*2a7oU",
      secure: false
    });
    
    await client.cd("/public_html/turnera-040626z");
    await client.downloadTo(localPath, "Turnos.xlsx");
    
    console.log("Procesando Excel...");
    const workbook = XLSX.readFile(localPath);
    const sheet = workbook.Sheets["Sheet1"];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`Se leyeron ${rows.length} registros de citas.`);
    
    // Agrupador por fecha
    const demandMap = {};

    rows.forEach((row, idx) => {
      const serialDate = row["Turno"];
      if (!serialDate || typeof serialDate !== "number") return;
      
      const { dateString, hour } = parseExcelDateTime(serialDate);
      const cobertura = row["Cobertura"] ? String(row["Cobertura"]).toUpperCase() : "";
      const isArt = cobertura.includes("ART");
      const isOs = !isArt; // Todo lo demás es obra social o particular

      if (!demandMap[dateString]) {
        demandMap[dateString] = {
          dateString,
          hourlyArt: Array(24).fill(0),
          hourlyOs: Array(24).fill(0)
        };
      }

      if (hour >= 0 && hour < 24) {
        if (isArt) {
          demandMap[dateString].hourlyArt[hour]++;
        } else {
          demandMap[dateString].hourlyOs[hour]++;
        }
      }
    });

    const uniqueDates = Object.keys(demandMap).sort();
    console.log(`\nCantidad de fechas únicas con demanda encontradas: ${uniqueDates.length}`);
    console.log("Rango de fechas detectado:", uniqueDates[0], "a", uniqueDates[uniqueDates.length - 1]);
    
    // Mostrar muestra de Junio 2026 (por ejemplo 2026-06-01)
    const sampleDate = "2026-06-01";
    if (demandMap[sampleDate]) {
      console.log(`\nDemanda agregada de muestra para el día ${sampleDate}:`);
      console.log("Horas:     ", Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).join(" "));
      console.log("Pac. ART:  ", demandMap[sampleDate].hourlyArt.map(v => String(v).padStart(2, ' ')).join(" "));
      console.log("Pac. OS:   ", demandMap[sampleDate].hourlyOs.map(v => String(v).padStart(2, ' ')).join(" "));
    } else {
      console.log(`No se encontraron registros para la fecha de muestra ${sampleDate}`);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    client.close();
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
}

aggregateDemand();

const ftp = require("basic-ftp");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

async function downloadAndInspect() {
  const client = new ftp.Client();
  const localPath = path.join(__dirname, "Turnos_remote.xlsx");
  try {
    console.log("Conectando al servidor FTP para descargar Turnos.xlsx...");
    await client.access({
      host: "turnera-040626z.iteosrl.com.ar",
      user: "ip000541",
      password: "JM8Pog2SR*2a7oU",
      secure: false
    });
    
    await client.cd("/public_html/turnera-040626z");
    console.log("Descargando Turnos.xlsx...");
    await client.downloadTo(localPath, "Turnos.xlsx");
    console.log("¡Descarga completada con éxito!");

    console.log("Abriendo archivo Excel local con xlsx...");
    const workbook = XLSX.readFile(localPath);
    console.log("Hojas encontradas en Turnos.xlsx:");
    console.log(workbook.SheetNames);

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      console.log(`\n--- Hoja: "${sheetName}" ---`);
      console.log(`Cantidad de filas: ${data.length}`);
      if (data.length > 0) {
        console.log("Columnas principales:", Object.keys(data[0]));
        console.log("Primeros 2 registros de muestra:");
        console.log(data.slice(0, 2));
      } else {
        console.log("La hoja está vacía.");
      }
    });

  } catch (err) {
    console.error("Error durante el diagnóstico:", err);
  } finally {
    client.close();
    // Limpiar archivo temporal si se descargó
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log("\nArchivo temporal local Turnos_remote.xlsx eliminado.");
    }
  }
}

downloadAndInspect();

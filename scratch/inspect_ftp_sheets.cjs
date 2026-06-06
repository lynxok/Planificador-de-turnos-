const ftp = require('basic-ftp');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const FTP_CONFIG = {
  host: "turnera-040626z.iteosrl.com.ar",
  user: "ip000541",
  password: "JM8Pog2SR*2a7oU",
  secure: false
};
const FTP_DIR = "/public_html/turnera-040626z";

async function inspect() {
  const client = new ftp.Client();
  const localPath = path.join(__dirname, 'Turnos_inspect.xlsx');
  try {
    console.log("Connecting to FTP...");
    await client.access(FTP_CONFIG);
    await client.cd(FTP_DIR);
    console.log("Downloading Turnos.xlsx...");
    await client.downloadTo(localPath, "Turnos.xlsx");
    
    console.log("File downloaded. Size:", fs.statSync(localPath).size);
    const workbook = XLSX.readFile(localPath);
    console.log("Sheets found in workbook:", workbook.SheetNames);
    
    for (let sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = sheet['!ref'];
      const rows = XLSX.utils.sheet_to_json(sheet);
      console.log(`Sheet "${sheetName}": range=${range}, row count=${rows.length}`);
    }
  } catch (err) {
    console.error("FTP inspection failed:", err.message);
  } finally {
    client.close();
    if (fs.existsSync(localPath)) {
      try { fs.unlinkSync(localPath); } catch (e) {}
    }
  }
}

inspect();

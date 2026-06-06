const ftp = require('basic-ftp');

const FTP_CONFIG = {
  host: "turnera-040626z.iteosrl.com.ar",
  user: "ip000541",
  password: "JM8Pog2SR*2a7oU",
  secure: false
};
const FTP_DIR = "/public_html/turnera-040626z";

async function listFiles() {
  const client = new ftp.Client();
  try {
    console.log("Connecting to FTP...");
    await client.access(FTP_CONFIG);
    await client.cd(FTP_DIR);
    console.log("Listing files in", FTP_DIR);
    const list = await client.list();
    for (let file of list) {
      console.log(`${file.name} - Size: ${file.size} - Modified: ${file.modifiedAt || file.rawModifiedAt}`);
    }
  } catch (err) {
    console.error("FTP listing failed:", err.message);
  } finally {
    client.close();
  }
}

listFiles();

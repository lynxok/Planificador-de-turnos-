const ftp = require("basic-ftp");
const path = require("path");

async function testConnection() {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  try {
    console.log("Conectando al servidor FTP...");
    await client.access({
      host: "turnera-040626z.iteosrl.com.ar",
      user: "ip000541",
      password: "JM8Pog2SR*2a7oU",
      secure: false // Cambiar a true/implicit si el servidor requiere TLS/SSL
    });
    console.log("¡Conexión FTP exitosa!");

    console.log("Accediendo a la carpeta destino /public_html/turnera-040626z...");
    await client.cd("/public_html/turnera-040626z");

    console.log("Listando archivos del directorio:");
    const list = await client.list();
    if (list.length === 0) {
      console.log("El directorio está vacío.");
    } else {
      list.forEach(file => {
        console.log(`- ${file.name} (${file.size} bytes) - ${file.type === 1 ? 'Archivo' : 'Carpeta'}`);
      });
    }
  } catch (err) {
    console.error("Error durante la conexión FTP:", err);
  } finally {
    client.close();
  }
}

testConnection();

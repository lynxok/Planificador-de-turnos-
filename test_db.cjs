const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const connectionString = process.env.DATABASE_URL;
console.log('DATABASE_URL cargada:', connectionString ? 'Sí (oculta)' : 'No');

if (!connectionString) {
  console.error('Error: DATABASE_URL no encontrada en el .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error fatal al intentar conectar a Neon Postgres:', err.message);
    process.exit(1);
  }
  
  console.log('⚡ Conexión exitosa a Neon Postgres.');
  
  client.query('SELECT NOW(), (SELECT COUNT(*) FROM persons) as persons_count', (err, result) => {
    release();
    if (err) {
      console.error('❌ Error al ejecutar consulta de prueba:', err.message);
      process.exit(1);
    }
    
    console.log('📅 Fecha servidor Postgres:', result.rows[0].now);
    console.log('👤 Cantidad de colaboradores en BD:', result.rows[0].persons_count);
    console.log('✅ Base de datos operando correctamente.');
    process.exit(0);
  });
});

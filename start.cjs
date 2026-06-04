const { spawn } = require('child_process');

console.log('=======================================================');
console.log('                 SFH ITEO - MOTOR NODE');
console.log('   Por favor, mantenga esta ventana abierta durante su uso.');
console.log('=======================================================');
console.log('');

console.log('Iniciando servidores locales (Vite + Backend)...');

// Inicia npm run dev a través de cmd.exe nativo de Windows (evita advertencia de seguridad)
const devProcess = spawn('cmd.exe', ['/c', 'npm run dev'], { 
  stdio: 'inherit' 
});

// Manejo de apagado limpio (Ctrl+C o cierre de terminal)
process.on('SIGINT', () => {
  console.log('\n[Apagado] Deteniendo servidores de forma segura...');
  devProcess.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  devProcess.kill();
  process.exit();
});

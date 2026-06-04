import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Start backend
const backend = spawn('cmd.exe', ['/c', 'npx tsx backend/server.ts'], {
  cwd: root,
  stdio: 'inherit'
});

// Start frontend with --open flag
const frontend = spawn('cmd.exe', ['/c', 'npx vite --port=3020 --host=0.0.0.0 --open'], {
  cwd: root,
  stdio: 'inherit'
});

const cleanup = () => {
  backend.kill();
  frontend.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

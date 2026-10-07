import fs from 'fs';
import path from 'path';

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const target = path.join('Versiones anteriores', `dist_${ts}`);

if (!fs.existsSync('Versiones anteriores')) {
  fs.mkdirSync('Versiones anteriores', { recursive: true });
}

fs.cpSync('dist', target, { recursive: true });
console.log('Successfully backed up dist to:', target);

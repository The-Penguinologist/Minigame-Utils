// Entrypoint wrapper for Pterodactyl / Node.js Host Panels
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync, fork } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bundlePath = path.join(__dirname, 'dist', 'server.cjs');

// Auto-build if dist/server.cjs does not exist
if (!fs.existsSync(bundlePath)) {
  console.log('📦 Production build (dist/server.cjs) not found. Building now...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error('⚠️ npm run build failed during startup:', err.message);
  }
}

if (fs.existsSync(bundlePath)) {
  console.log('🚀 Launching server (dist/server.cjs)...');
  const child = fork(bundlePath, [], { stdio: 'inherit', cwd: __dirname });
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
} else {
  console.log('⚡ Fallback: Launching server.ts directly with tsx...');
  const child = fork('./node_modules/tsx/dist/cli.mjs', ['server.ts'], { stdio: 'inherit', cwd: __dirname });
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

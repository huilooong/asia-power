#!/usr/bin/env node
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'server', 'half-cut-local-server.js');
const port = process.env.PORT || '8787';

function freePort() {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    if (!pids) return;
    for (const pid of pids.split(/\s+/)) {
      if (pid) {
        console.warn(`[start] stopping stale process on :${port} (pid ${pid})`);
        process.kill(Number(pid), 'SIGTERM');
      }
    }
  } catch {
    // port free
  }
}

freePort();

const child = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port },
});

child.on('exit', (code) => process.exit(code ?? 0));

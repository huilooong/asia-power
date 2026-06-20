#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'deploy', 'test-run', 'server.js');
const root = path.join(__dirname, '..', 'deploy', 'test-run');

const child = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    INVENTORY_SITE_ROOT: root,
    PORT: process.env.PORT || '8080',
  },
});

child.on('exit', (code) => process.exit(code ?? 0));

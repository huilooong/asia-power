#!/usr/bin/env node
/**
 * Build transparent logo assets from master source.
 * Run: node scripts/build-logo-assets.mjs
 */
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const py = join(root, '.venv-logo/bin/python3');
const script = join(root, 'scripts/process-logo.py');

if (!existsSync(py)) {
  console.error('Missing .venv-logo — run: python3 -m venv .venv-logo && .venv-logo/bin/pip install Pillow');
  process.exit(1);
}

const r = spawnSync(py, [script], { stdio: 'inherit', cwd: root });
process.exit(r.status ?? 1);

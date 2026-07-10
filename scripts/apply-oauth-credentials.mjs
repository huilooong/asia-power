#!/usr/bin/env node
/**
 * Apply Google / Facebook OAuth credentials to production .env via SSH.
 * Never prints secret values. Does not commit to git.
 *
 * Usage (local, with env vars set):
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
 *   FACEBOOK_APP_ID=... FACEBOOK_APP_SECRET=... \
 *   node scripts/apply-oauth-credentials.mjs
 *
 * Or pass a local file (KEY=VALUE lines, not committed):
 *   node scripts/apply-oauth-credentials.mjs --file /path/to/oauth.secrets.env
 *
 * Dry-run (no SSH write):
 *   node scripts/apply-oauth-credentials.mjs --dry-run --file ./oauth.secrets.env
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const REMOTE = process.env.DEPLOY_REMOTE || 'root@159.65.86.24';
const REMOTE_ENV = '/root/.openclaw/workspace/inventory-site/.env';
const KEYS = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'FACEBOOK_APP_ID',
  'FACEBOOK_APP_SECRET',
  'PUBLIC_BASE_URL',
  'OAUTH_DEMO',
];

function parseArgs(argv) {
  const out = { file: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--file') out.file = argv[++i];
    else if (argv[i] === '--dry-run') out.dryRun = true;
  }
  return out;
}

function loadFromFile(filePath) {
  const abs = path.resolve(filePath);
  const text = fs.readFileSync(abs, 'utf8');
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

function collectValues(args) {
  const fromFile = args.file ? loadFromFile(args.file) : {};
  const values = {};
  for (const key of KEYS) {
    const v = process.env[key] || fromFile[key];
    if (v != null && String(v).trim() !== '') values[key] = String(v).trim();
  }
  if (!values.PUBLIC_BASE_URL) values.PUBLIC_BASE_URL = 'https://asia-power.com';
  // Real OAuth: do not force demo
  if (values.OAUTH_DEMO == null) values.OAUTH_DEMO = '0';
  return values;
}

function summarize(values) {
  return KEYS.map((k) => {
    const v = values[k];
    if (v == null) return `${k}: (skip)`;
    if (k === 'PUBLIC_BASE_URL' || k === 'OAUTH_DEMO') return `${k}: ${v}`;
    return `${k}: SET(${v.length})`;
  }).join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  const values = collectValues(args);
  const hasGoogle = values.GOOGLE_OAUTH_CLIENT_ID && values.GOOGLE_OAUTH_CLIENT_SECRET;
  const hasFacebook = values.FACEBOOK_APP_ID && values.FACEBOOK_APP_SECRET;
  if (!hasGoogle && !hasFacebook) {
    console.error('Need at least Google (ID+SECRET) or Facebook (ID+SECRET).');
    console.error('See docs/ops/ops-oauth-ceo-setup.md');
    process.exit(1);
  }

  console.log('[oauth-apply] planned updates:\n' + summarize(values));
  if (args.dryRun) {
    console.log('[oauth-apply] dry-run — no remote write');
    return;
  }

  // Build a remote python snippet that upserts keys without echoing secrets
  const payload = Buffer.from(JSON.stringify(values)).toString('base64');
  const remotePy = `
import base64, json, pathlib, re, subprocess, sys
env_path = pathlib.Path(${JSON.stringify(REMOTE_ENV)})
values = json.loads(base64.b64decode(${JSON.stringify(payload)}).decode())
text = env_path.read_text() if env_path.exists() else ''
lines = text.splitlines()
keys = set(values.keys())
out = []
seen = set()
for line in lines:
    if not line.strip() or line.lstrip().startswith('#') or '=' not in line:
        out.append(line)
        continue
    k = line.split('=', 1)[0].strip()
    if k in keys:
        out.append(f"{k}={values[k]}")
        seen.add(k)
    else:
        out.append(line)
for k, v in values.items():
    if k not in seen:
        out.append(f"{k}={v}")
env_path.write_text('\\n'.join(out).rstrip() + '\\n')
env_path.chmod(0o600)
print('[oauth-apply] wrote', len(values), 'keys to', env_path)
subprocess.check_call(['systemctl', 'restart', 'inventory-site.service'])
subprocess.check_call(['systemctl', 'is-active', 'inventory-site.service'])
`;

  // Pass Python via base64 so multiline + quotes survive SSH shell parsing.
  const pyB64 = Buffer.from(remotePy, 'utf8').toString('base64');
  const result = spawnSync(
    'ssh',
    [REMOTE, `echo ${pyB64} | base64 -d | python3`],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error('[oauth-apply] failed');
    process.exit(result.status || 1);
  }
  console.log('[oauth-apply] done — verify: curl -sS https://asia-power.com/api/auth/oauth/providers');
}

main();

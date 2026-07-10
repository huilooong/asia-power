#!/usr/bin/env node
/**
 * Audit client /api/half-cuts/* fetch calls against server/lib/half-cut-api.js routes.
 * Usage: node scripts/audit-half-cut-api-routes.mjs [--root .] [--base https://asia-power.com]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { root: path.join(__dirname, '..'), base: '' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) { args.root = argv[i + 1]; i += 1; }
    else if (argv[i] === '--base' && argv[i + 1]) { args.base = argv[i + 1].replace(/\/$/, ''); i += 1; }
  }
  return args;
}

function resolveApiFile(root) {
  const candidates = [
    path.join(root, 'server', 'lib', 'half-cut-api.js'),
    path.join(root, 'lib', 'half-cut-api.js'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  throw new Error('half-cut-api.js not found');
}

function collectServerRoutes(apiSource) {
  const routes = [];
  const exact = [...apiSource.matchAll(/pathname === '([^']+)'/g)];
  exact.forEach((m) => routes.push({ kind: 'exact', pattern: m[1] }));
  const regex = [...apiSource.matchAll(/pathname\.match\(\/\^([^$]+)\$\//g)];
  regex.forEach((m) => routes.push({ kind: 'regex', pattern: m[1] }));
  return routes;
}

function collectClientCalls(root) {
  const jsDir = path.join(root, 'js');
  const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
  const calls = [];
  const re = /fetch\s*\(\s*(?:apiUrl\s*\()?['"`]\/api\/half-cuts\/([^'"`?]+)/g;
  for (const file of files) {
    const src = fs.readFileSync(path.join(jsDir, file), 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) {
      calls.push({ file: `js/${file}`, path: `/api/half-cuts/${m[1].replace(/\$\{[^}]+\}/g, ':param')}` });
    }
  }
  return calls;
}

function matchesRoute(callPath, routes) {
  return routes.some((route) => {
    if (route.kind === 'exact') return callPath === route.pattern;
    const re = new RegExp(`^${route.pattern}$`);
    return re.test(callPath.replace(/\?.*$/, ''));
  });
}

async function probeLive(base, probes) {
  if (!base) return [];
  const out = [];
  for (const probe of probes) {
    const url = `${base}${probe.path}`;
    try {
      const res = await fetch(url, { method: probe.method, redirect: 'manual' });
      const body = await res.text();
      const apiNotFound = body.includes('"API not found"') || body.includes('API not found');
      out.push({ ...probe, status: res.status, apiNotFound });
    } catch (err) {
      out.push({ ...probe, status: 'ERR', error: err.message });
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const apiFile = resolveApiFile(args.root);
  const apiSource = fs.readFileSync(apiFile, 'utf8');
  const routes = collectServerRoutes(apiSource);
  const calls = collectClientCalls(args.root);
  const missing = calls.filter((call) => !matchesRoute(call.path.split('?')[0], routes));

  console.log(`API file: ${apiFile}`);
  console.log(`Server routes: ${routes.length}`);
  console.log(`Client calls: ${calls.length}`);
  console.log('');

  if (missing.length) {
    console.log('MISSING ROUTES (client calls without server handler):');
    missing.forEach((m) => console.log(`  - ${m.path}  (${m.file})`));
  } else {
    console.log('OK: all client /api/half-cuts/* calls have server route patterns.');
  }

  const probes = [
    { name: 'approve', method: 'POST', path: '/api/half-cuts/submissions/SUB-TEST/approve' },
    { name: 'reject', method: 'POST', path: '/api/half-cuts/submissions/SUB-TEST/reject' },
    { name: 'public-item', method: 'GET', path: '/api/half-cuts/public/item?slug=isuzu-2012-4jb1-truck-cab-hc250082' },
    { name: 'public-catalog', method: 'GET', path: '/api/half-cuts/public' },
    { name: 'state', method: 'GET', path: '/api/half-cuts/state' },
    { name: 'search-trending', method: 'GET', path: '/api/search/trending?limit=5' },
    { name: 'shipping-ports', method: 'GET', path: '/api/shipping/ports?cargo=halfcut' },
    { name: 'shipping-cif', method: 'GET', path: '/api/shipping/cif-estimate?portId=lagos&cargo=halfcut&exwUsd=3200' },
    { name: 'apsales-progress', method: 'GET', path: '/api/apsales/distribution-progress' },
  ];

  if (args.base) {
    console.log('');
    console.log(`Live probes: ${args.base}`);
    const live = await probeLive(args.base, probes);
    live.forEach((row) => {
      const flag = row.apiNotFound ? 'API NOT FOUND' : 'routed';
      console.log(`  ${row.name}: HTTP ${row.status} — ${flag}`);
    });
  }

  process.exit(missing.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(2);
});

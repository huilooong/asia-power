#!/usr/bin/env node
/**
 * Generate WebP full + thumb variants for approved inventory photos.
 * Usage: node scripts/optimize-inventory-photos.mjs [--root PATH] [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadDotEnv(rootDir) {
  const envFile = path.join(rootDir, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const args = process.argv.slice(2);
let root = path.join(__dirname, '..');
let dryRun = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root' && args[i + 1]) root = path.resolve(args[++i]);
  if (args[i] === '--dry-run') dryRun = true;
}
loadDotEnv(root);

const libDir = [path.join(root, 'lib'), path.join(root, 'server/lib')]
  .find((dir) => fs.existsSync(path.join(dir, 'media-optimize.js')));
if (!libDir) {
  console.error('[optimize-photos] media-optimize.js not found under', root);
  process.exit(1);
}

const mediaOptimize = require(path.join(libDir, 'media-optimize.js'));
if (!mediaOptimize.loadSharp?.()) {
  console.error('[optimize-photos] sharp is required — run npm install in project root');
  process.exit(1);
}

const approvedFile = path.join(root, 'data/half-cut-approved.json');
if (!fs.existsSync(approvedFile)) {
  console.error('[optimize-photos] missing', approvedFile);
  process.exit(1);
}

const approved = JSON.parse(fs.readFileSync(approvedFile, 'utf8'));
let updated = 0;
let skipped = 0;
let failed = 0;

async function run() {
  for (const item of approved) {
    if (!Array.isArray(item.photos)) continue;
    for (let i = 0; i < item.photos.length; i++) {
      const photo = item.photos[i];
      const url = typeof photo === 'string' ? photo : photo?.url;
      if (!url || /-thumb\.webp/i.test(url)) {
        skipped += 1;
        continue;
      }
      if (typeof photo === 'object' && photo.thumbUrl) {
        skipped += 1;
        continue;
      }
      try {
        if (dryRun) {
          console.log('[dry-run]', item.stockId, url);
          updated += 1;
          continue;
        }
        const result = await mediaOptimize.optimizePublicPhoto(root, url);
        if (!result?.url) {
          failed += 1;
          console.warn('[optimize-photos] skip', item.stockId, url);
          continue;
        }
        const label = typeof photo === 'object' ? photo.label : '';
        item.photos[i] = label
          ? { label, url: result.url, thumbUrl: result.thumbUrl }
          : { url: result.url, thumbUrl: result.thumbUrl };
        updated += 1;
        console.log('[optimize-photos]', item.stockId, path.basename(url), '->', path.basename(result.url));
      } catch (err) {
        failed += 1;
        console.error('[optimize-photos]', item.stockId, url, err.message);
      }
    }
  }

  if (!dryRun && updated > 0) {
    const latest = JSON.parse(fs.readFileSync(approvedFile, 'utf8'));
    const photoByStock = new Map(
      approved
        .filter((item) => item?.stockId && Array.isArray(item.photos))
        .map((item) => [String(item.stockId).toUpperCase(), item.photos]),
    );
    const merged = latest.map((item) => {
      const photos = photoByStock.get(String(item.stockId).toUpperCase());
      return photos ? { ...item, photos } : item;
    });
    fs.writeFileSync(approvedFile, `${JSON.stringify(merged, null, 2)}\n`);
  }
  console.log(`[optimize-photos] done updated=${updated} skipped=${skipped} failed=${failed}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

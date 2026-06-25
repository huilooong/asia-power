#!/usr/bin/env node
/**
 * Bump styles.css cache query on all HTML pages (emergency cache bust).
 * Usage: node scripts/bump-css-cache.mjs [version]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const VERSION = process.argv[2] || `fix${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

const pat = /styles\.css(\?v=[^"']+)?/g;
const replacement = `styles.css?v=${VERSION}`;

let count = 0;
for (const dir of [ROOT, path.join(ROOT, 'brands'), path.join(ROOT, 'engines'), path.join(ROOT, 'half-cuts'), path.join(ROOT, 'admin'), path.join(ROOT, 'supplier-portal'), path.join(ROOT, 'gearboxes'), path.join(ROOT, 'chassis-parts'), path.join(ROOT, 'trucks'), path.join(ROOT, 'motorcycles'), path.join(ROOT, 'machinery'), path.join(ROOT, 'pages')]) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.html')) continue;
    const filePath = path.join(dir, name);
    const text = fs.readFileSync(filePath, 'utf8');
    if (!text.includes('styles.css')) continue;
    const next = text.replace(pat, replacement);
    if (next !== text) {
      fs.writeFileSync(filePath, next);
      count += 1;
      console.log(path.relative(ROOT, filePath));
    }
  }
}

console.log(`\nBumped ${count} file(s) → styles.css?v=${VERSION}`);
console.log('Run: node scripts/deploy-production.mjs');

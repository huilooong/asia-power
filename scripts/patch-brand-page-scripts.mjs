#!/usr/bin/env node
/**
 * Normalize half-cut script tags on all brands/*.html pages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandsDir = path.join(__dirname, '..', 'brands');

const HALF_CUT_BLOCK = `  <script src="../js/half-cut-vin.js?v=inventory-v1"></script>
  <script src="../js/half-cut-upload-layer.js?v=inventory-v1"></script>
  <script src="../js/half-cut-review-layer.js?v=inventory-v1"></script>
  <script src="../js/half-cut-inventory-layer.js?v=inventory-v1"></script>
  <script src="../js/half-cut-directory.js?v=inventory-v1"></script>
  <script src="../js/half-cut-media-api.js?v=security-v1"></script>
  <script src="../js/half-cut-inventory-store.js?v=inventory-v1"></script>
  <script src="../js/half-cut-gallery-lightbox.js?v=gallery-v3"></script>
  <script src="../js/half-cut-catalog.js?v=gallery-v3"></script>
  <script src="../js/powertrain-labels.js?v=powertrain-v5"></script>
  <script src="../js/brand-catalog.js?v=powertrain-v5" defer></script>
  <script src="../js/gearbox-directory.js?v=powertrain-v5" defer></script>
  <script src="../js/chassis-directory.js?v=powertrain-v5" defer></script>
  <script src="../js/powertrain-catalog.js?v=powertrain-v5" defer></script>
  <script src="../js/brand-page.js?v=powertrain-v5" defer></script>
`;

const halfCutPattern = /[\s]*<script src="\.\.\/js\/half-cut-vin\.js[^"]*"><\/script>[\s\S]*?<script src="\.\.\/js\/brand-page\.js[^"]*" defer><\/script>\s*/;

const vehicleCatalogTag = '  <script src="../js/vehicle-catalog.js?v=1"></script>\n';

let updated = 0;

for (const file of fs.readdirSync(brandsDir).filter((f) => f.endsWith('.html')).sort()) {
  const filePath = path.join(brandsDir, file);
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;

  if (!halfCutPattern.test(html)) {
    console.warn(`skip (no half-cut block): ${file}`);
    continue;
  }

  html = html.replace(halfCutPattern, `\n${HALF_CUT_BLOCK}\n`);

  if (!html.includes('vehicle-catalog.js')) {
    html = html.replace(
      /(<script src="\.\.\/js\/config\.js"><\/script>\s*\n)/,
      `$1${vehicleCatalogTag}`
    );
  }

  if (html !== original) {
    fs.writeFileSync(filePath, html);
    updated += 1;
    console.log(`updated: ${file}`);
  }
}

console.log(`\nDone. ${updated} file(s) updated.`);

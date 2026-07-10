#!/usr/bin/env node
/**
 * Sync shared JS/CSS cache keys across public HTML pages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const EBAY_LAYOUT_VER = '56';
const COMPONENTS_VER = 'detail-layout-v4';
const PATH_UTILS_VER = 'listing-layout-v1';
const HALF_CUT_DIRECTORY_VER = 'catalog-trucks-v1';
const HALF_CUT_TITLE_VER = 'qxb-title-v1';
const CONTACT_REDACT_VER = 'contact-redact-v1';
const INVENTORY_LAYER_VER = 'qxb-title-v1';
const VEHICLE_TITLE_LEXICON_VER = 'lexicon-v2';
const VEHICLE_TITLE_I18N_VER = 'vehicle-title-i18n-v2';
const HALF_CUT_DETAIL_VER = 'detail-layout-v5';
const CIF_CALCULATOR_VER = 'cif-calc-v1';
const LIST_LEAD_MODAL_VER = 'list-lead-modal-v1';
const SITE_FEEDBACK_VER = 'list-lead-modal-v1';
const EBAY_CATALOG_HUB_VER = 'catalog-exw-badge-v1';
const BRAND_PAGE_VER = 'catalog-paging-v1';
const HOME_HUB_VER = 'catalog-exw-badge-v1';
const GALLERY_VER = 'gallery-v7';

const SKIP_DIRS = new Set([
  'docs', 'reports', 'work', 'pages', 'admin', '.venv-faces', 'node_modules', '.git',
]);

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const rel = path.relative(root, full);
    const top = rel.split(path.sep)[0];
    if (SKIP_DIRS.has(top)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

let updated = 0;

for (const filePath of walkHtml(root)) {
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;

  html = html.replace(/ebay-layout\.css\?v=[^"']+/g, `ebay-layout.css?v=${EBAY_LAYOUT_VER}`);
  // Must stay on a cache key that ships AsiaPowerAuthNav (Cloudflare immutable). Do not reuse stale keys like v4-chrome-sync-v1.
  html = html.replace(/components\.js\?v=[^"']+/g, `components.js?v=auth-nav-once-v2
  html = html.replace(/path-utils\.js\?v=[^"']+/g, `path-utils.js?v=${PATH_UTILS_VER}`);
  html = html.replace(/half-cut-directory\.js\?v=[^"']+/g, `half-cut-directory.js?v=${HALF_CUT_DIRECTORY_VER}`);
  html = html.replace(/half-cut-title\.js\?v=[^"']+/g, `half-cut-title.js?v=${HALF_CUT_TITLE_VER}`);
  html = html.replace(/contact-redact\.js\?v=[^"']+/g, `contact-redact.js?v=${CONTACT_REDACT_VER}`);
  html = html.replace(/half-cut-inventory-layer\.js\?v=[^"']+/g, `half-cut-inventory-layer.js?v=${INVENTORY_LAYER_VER}`);
  html = html.replace(/site-feedback\.js\?v=[^"']+/g, `site-feedback.js?v=${SITE_FEEDBACK_VER}`);
  html = html.replace(/half-cut-leads\.js\?v=[^"']+/g, `half-cut-leads.js?v=${LIST_LEAD_MODAL_VER}`);
  html = html.replace(/vehicle-title-lexicon\.bundle\.js\?v=[^"']+/g, `vehicle-title-lexicon.bundle.js?v=${VEHICLE_TITLE_LEXICON_VER}`);
  html = html.replace(/half-cut-vehicle-title-i18n\.js\?v=[^"']+/g, `half-cut-vehicle-title-i18n.js?v=${VEHICLE_TITLE_I18N_VER}`);
  html = html.replace(/half-cut-detail\.js\?v=[^"']+/g, `half-cut-detail.js?v=${HALF_CUT_DETAIL_VER}`);
  html = html.replace(/cif-calculator\.js\?v=[^"']+/g, `cif-calculator.js?v=${CIF_CALCULATOR_VER}`);
  html = html.replace(/half-cut-gallery-lightbox\.js\?v=[^"']+/g, `half-cut-gallery-lightbox.js?v=${GALLERY_VER}`);
  html = html.replace(/ebay-catalog-hub\.js\?v=[^"']+/g, `ebay-catalog-hub.js?v=${EBAY_CATALOG_HUB_VER}`);
  html = html.replace(/brand-page\.js\?v=[^"']+/g, `brand-page.js?v=${BRAND_PAGE_VER}`);
  html = html.replace(/home-hub\.js\?v=[^"']+/g, `home-hub.js?v=${HOME_HUB_VER}`);
  if (html.includes('half-cut-title.js') && !html.includes('contact-redact.js')) {
    html = html.replace(
      /(<script src="([^"]*)half-cut-title\.js[^"]*"><\/script>)/,
      (match, _full, prefix) => `${match}\n<script src="${prefix}contact-redact.js?v=${CONTACT_REDACT_VER}"></script>`
    );
  }
  if (html.includes('half-cut-directory.js') && !html.includes('half-cut-title.js')) {
    html = html.replace(
      /(<script src="([^"]*)half-cut-directory\.js[^"]*"><\/script>)/,
      (match, _full, prefix) => `  <script src="${prefix}vehicle-title-lexicon.bundle.js?v=${VEHICLE_TITLE_LEXICON_VER}"></script>\n  <script src="${prefix}half-cut-vehicle-title-i18n.js?v=${VEHICLE_TITLE_I18N_VER}"></script>\n  <script src="${prefix}half-cut-title.js?v=${HALF_CUT_TITLE_VER}"></script>\n${match}`
    );
  }
  if (html.includes('half-cut-title.js') && !html.includes('vehicle-title-lexicon.bundle.js')) {
    html = html.replace(
      /(<script src="([^"]*)half-cut-title\.js[^"]*"><\/script>)/,
      (match, _full, prefix) => `  <script src="${prefix}vehicle-title-lexicon.bundle.js?v=${VEHICLE_TITLE_LEXICON_VER}"></script>\n  <script src="${prefix}half-cut-vehicle-title-i18n.js?v=${VEHICLE_TITLE_I18N_VER}"></script>\n${match}`
    );
  }

  if (html !== original) {
    fs.writeFileSync(filePath, html);
    updated += 1;
    console.log(`updated: ${path.relative(root, filePath)}`);
  }
}

const componentsPath = path.join(root, 'js', 'components.js');
let componentsJs = fs.readFileSync(componentsPath, 'utf8');
const nextComponents = componentsJs.replace(
  /const SITE_EBAY_LAYOUT_VER = '[^']+';/,
  `const SITE_EBAY_LAYOUT_VER = '${EBAY_LAYOUT_VER}';`
);
if (nextComponents !== componentsJs) {
  fs.writeFileSync(componentsPath, nextComponents);
  console.log(`updated: js/components.js (SITE_EBAY_LAYOUT_VER=${EBAY_LAYOUT_VER})`);
}

console.log(`\nDone. ${updated} HTML file(s) synced.`);

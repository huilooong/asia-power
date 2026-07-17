/**
 * Cache-bust dependency check — scan HTML for js/css?v= refs (no handwritten table).
 * Warn when a changed shared asset is referenced with inconsistent ?v= across pages.
 */
import fs from 'fs';
import path from 'path';

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'backups',
  'releases',
  'work',
  'data',
  'docs',
  'audit',
  'AsiaPower-Brain',
  '.venv',
  '.venv-qxb',
  'coverage',
  'tmp',
  'reports',
]);

/** Match src/href … .(js|css)?v=… */
const REF_RE = /(?:href|src)=["']([^"']+\.(?:js|css)\?v=[^"'#]+)["']/gi;

/**
 * Normalize a referenced asset path to repo-relative form like `js/components.js`.
 * @param {string} raw
 * @param {string} htmlRelPath
 */
export function normalizeAssetPath(raw, htmlRelPath = '') {
  let s = String(raw || '').trim();
  const q = s.indexOf('?');
  if (q >= 0) s = s.slice(0, q);
  s = s.replace(/\\/g, '/').replace(/^\/+/, '');
  while (s.startsWith('./')) s = s.slice(2);

  // Resolve ../ relative to the HTML file's directory
  if (s.includes('../') || s.startsWith('../')) {
    const baseDir = path.posix.dirname(htmlRelPath.replace(/\\/g, '/'));
    s = path.posix.normalize(path.posix.join(baseDir, s));
  }
  s = s.replace(/^(\.\.\/)+/, '');
  return s;
}

/**
 * Extract cache-bust refs from HTML text.
 * @returns {{ asset: string, version: string }[]}
 */
export function extractCacheBustRefs(htmlText, htmlRelPath = '') {
  const out = [];
  const text = String(htmlText || '');
  REF_RE.lastIndex = 0;
  let m;
  while ((m = REF_RE.exec(text))) {
    const full = m[1];
    const qi = full.indexOf('?v=');
    if (qi < 0) continue;
    const version = full.slice(qi + 3).split('&')[0].trim();
    if (!version) continue;
    const asset = normalizeAssetPath(full.slice(0, qi), htmlRelPath);
    if (!asset.endsWith('.js') && !asset.endsWith('.css')) continue;
    out.push({ asset, version });
  }
  return out;
}

/**
 * Walk repo HTML (skip heavy/non-site dirs) and build asset → [{ page, version }].
 * @param {string} root
 * @returns {Map<string, { page: string, version: string }[]>}
 */
export function scanCacheBustRefs(root) {
  /** @type {Map<string, { page: string, version: string }[]>} */
  const map = new Map();

  function walk(absDir, relDir) {
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        walk(path.join(absDir, ent.name), relDir ? `${relDir}/${ent.name}` : ent.name);
        continue;
      }
      if (!ent.name.endsWith('.html')) continue;
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      const abs = path.join(absDir, ent.name);
      let text;
      try {
        text = fs.readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      for (const { asset, version } of extractCacheBustRefs(text, rel)) {
        if (!map.has(asset)) map.set(asset, []);
        map.get(asset).push({ page: rel, version });
      }
    }
  }

  walk(root, '');
  return map;
}

/**
 * @param {Map<string, { page: string, version: string }[]>|Record<string, { page: string, version: string }[]>} refMap
 * @param {string[]} changedFiles - git-relative paths that changed in this deploy
 * @returns {{ status: 'pass'|'warn', detail: string, inconsistencies: object[] }}
 */
export function findInconsistentSharedAssets(refMap, changedFiles = []) {
  const map = refMap instanceof Map ? refMap : new Map(Object.entries(refMap || {}));
  const changed = new Set(
    (changedFiles || [])
      .map((f) => String(f || '').replace(/\\/g, '/').replace(/^\.\//, ''))
      .filter(Boolean),
  );

  /** @type {object[]} */
  const inconsistencies = [];

  for (const asset of changed) {
    if (!asset.endsWith('.js') && !asset.endsWith('.css')) continue;
    const refs = map.get(asset);
    if (!refs || refs.length < 2) continue;

    const byVersion = new Map();
    for (const r of refs) {
      if (!byVersion.has(r.version)) byVersion.set(r.version, []);
      byVersion.get(r.version).push(r.page);
    }
    if (byVersion.size <= 1) continue;

    const versions = [...byVersion.entries()]
      .map(([version, pages]) => ({
        version,
        count: pages.length,
        samplePages: pages.slice(0, 5),
      }))
      .sort((a, b) => b.count - a.count);

    inconsistencies.push({
      asset,
      refCount: refs.length,
      versionCount: byVersion.size,
      versions,
    });
  }

  if (!inconsistencies.length) {
    return {
      status: 'pass',
      detail: 'no inconsistent ?v= on changed shared js/css',
      inconsistencies: [],
    };
  }

  const summary = inconsistencies
    .map((i) => `${i.asset} (${i.versionCount} versions across ${i.refCount} refs)`)
    .join('; ');

  return {
    status: 'warn',
    detail: `cache-bust inconsistency: ${summary}`,
    inconsistencies,
  };
}

/**
 * Full check: scan root HTML + compare against changed files.
 * @param {{ root: string, changedFiles?: string[] }} opts
 */
export function checkCacheBustConsistency({ root, changedFiles = [] }) {
  const refMap = scanCacheBustRefs(root);
  return findInconsistentSharedAssets(refMap, changedFiles);
}

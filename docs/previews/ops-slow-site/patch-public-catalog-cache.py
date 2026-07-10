#!/usr/bin/env python3
from pathlib import Path

p = Path("/root/.openclaw/workspace/inventory-site/lib/half-cut-api.js")
text = p.read_text()

old_import = "const { toPublicList } = require('./half-cut-public');"
new_import = "const { toPublicList, toPublicCatalogList } = require('./half-cut-public');"
if old_import in text and new_import not in text:
    text = text.replace(old_import, new_import, 1)

old_fn = """  async function getPublicCatalog() {
    const raw = loadJson(APPROVED_FILE, []);
    const submissions = loadJson(SUBMISSIONS_FILE, []);
    const { state, changed } = nameNorm.normalizeState({ submissions, approved: raw }, rootDir);
    if (changed) {
      saveJson(APPROVED_FILE, state.approved);
      console.log('[half-cut] auto-corrected brand/model spellings in approved catalog');
    }
    return { approved: toPublicList(state.approved) };
  }"""

new_fn = """  let publicCatalogCache = null;
  let publicCatalogMtime = 0;

  async function getPublicCatalog() {
    let mtime = 0;
    try {
      mtime = fs.statSync(APPROVED_FILE).mtimeMs;
    } catch {
      return { approved: [] };
    }
    if (publicCatalogCache && mtime === publicCatalogMtime) {
      return publicCatalogCache;
    }
    const raw = loadJson(APPROVED_FILE, []);
    publicCatalogCache = { approved: toPublicCatalogList(raw, 4) };
    publicCatalogMtime = mtime;
    return publicCatalogCache;
  }"""

if old_fn not in text:
    raise SystemExit("getPublicCatalog block not found — already patched?")
text = text.replace(old_fn, new_fn, 1)
p.write_text(text)
print("patched ok")

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Load JSON from disk. On parse failure, attempt recovery from `.bak` sibling.
 */
function loadJson(file, fallback, options = {}) {
  const createIfMissing = options.createIfMissing !== false;
  if (!fs.existsSync(file)) {
    if (createIfMissing && fallback !== undefined) {
      saveJsonAtomic(file, fallback);
      return fallback;
    }
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    const bak = `${file}.bak`;
    if (fs.existsSync(bak)) {
      try {
        const recovered = JSON.parse(fs.readFileSync(bak, 'utf8'));
        saveJsonAtomic(file, recovered);
        console.warn(`[json-store] recovered ${file} from backup`);
        return recovered;
      } catch {
        // fall through
      }
    }
    throw new Error(`Corrupt JSON (${file}): ${err.message}`);
  }
}

/**
 * Atomic write: temp file → rename. Previous version kept as `.bak`.
 */
function saveJsonAtomic(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const content = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(tmp, content, 'utf8');
  if (fs.existsSync(file)) {
    try {
      fs.copyFileSync(file, `${file}.bak`);
    } catch {
      // non-fatal
    }
  }
  fs.renameSync(tmp, file);
}

module.exports = {
  loadJson,
  saveJsonAtomic,
  saveJson: saveJsonAtomic,
};

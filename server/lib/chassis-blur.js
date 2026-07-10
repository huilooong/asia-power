'use strict';

/**
 * Precisely mask the last 7 VIN characters on chassis plate photos (upload-time hook).
 * Delegates to inventory_core/chassis_blur.py via scripts/chassis-blur-one.py.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const VIN_LABEL_RE = /vin.*plate|chassis.*plate|底盘|铭牌/i;
const ROOT = path.join(__dirname, '..', '..');
const BLUR_SCRIPT = path.join(ROOT, 'scripts', 'chassis-blur-one.py');

function isVinPlateLabel(label) {
  const text = String(label || '').trim();
  if (text === 'VIN Plate') return true;
  return VIN_LABEL_RE.test(text);
}

function pythonCandidates() {
  const list = [
    path.join(ROOT, '.venv-qxb', 'bin', 'python3'),
    path.join(ROOT, '.venv', 'bin', 'python3'),
    'python3',
  ];
  return list.filter((item, idx) => list.indexOf(item) === idx);
}

async function resolvePython() {
  for (const candidate of pythonCandidates()) {
    if (candidate.includes(path.sep) && !fs.existsSync(candidate)) continue;
    try {
      await execFileAsync(candidate, ['--version']);
      return candidate;
    } catch {
      // try next
    }
  }
  return 'python3';
}

async function blurVinSuffixBuffer(buffer, mimeType = 'image/webp', knownVin = '') {
  if (!buffer?.length || !fs.existsSync(BLUR_SCRIPT)) return buffer;

  const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? '.jpg' : '.webp';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chassis-blur-'));
  const src = path.join(tmpDir, `in${ext}`);
  const dst = path.join(tmpDir, `out${ext}`);

  try {
    fs.writeFileSync(src, buffer);
    const python = await resolvePython();
    const args = [BLUR_SCRIPT, src, dst, '--known-vin', String(knownVin || ''), '--json'];
    const { stdout } = await execFileAsync(python, args, {
      cwd: ROOT,
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
    });

    let meta = {};
    try {
      meta = JSON.parse(String(stdout || '').trim().split('\n').pop() || '{}');
    } catch {
      meta = {};
    }

    if (meta.needsReview || !fs.existsSync(dst)) {
      return buffer;
    }
    return fs.readFileSync(dst);
  } catch {
    return buffer;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = {
  isVinPlateLabel,
  blurVinSuffixBuffer,
};

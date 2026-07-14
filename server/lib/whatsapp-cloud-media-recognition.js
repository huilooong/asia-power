'use strict';

/**
 * Cloud API inbound media → OCR / STT (Phase 1b).
 * Merge results into normalized.text via applyRecognitionToNormalized / sandbox hook.
 * Never throws to caller for business path; returns { error } on failure.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { downloadWhatsAppMedia } = require('./whatsapp-cloud-media');
const { retainOrDiscardPhoto } = require('./customer-photo-archive');

function envFlag(name, defaultOn = true) {
  const raw = String(process.env[name] ?? (defaultOn ? 'true' : 'false')).trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(raw)) return false;
  if (['1', 'true', 'on', 'yes'].includes(raw)) return true;
  return defaultOn;
}

function asiapowerRoot() {
  const fromEnv = String(process.env.ASIAPOWER_ROOT || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidates = [
    path.resolve(__dirname, '..', '..'),
    '/root/.openclaw/workspace/AsiaPower',
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'scripts', 'apsales-media-vin-ocr.py'))) return c;
  }
  return candidates[0];
}

function resolvePython(workspace) {
  const venvPy = path.join(workspace, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPy)) return venvPy;
  return 'python3';
}

function runPython(payload, scriptPath, workspace) {
  const python = resolvePython(workspace);
  return new Promise((resolve, reject) => {
    const child = spawn(python, [scriptPath], { cwd: workspace });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (out.trim()) {
        try {
          resolve(JSON.parse(out.trim()));
          return;
        } catch (parseErr) {
          reject(new Error(`bad JSON from script: ${parseErr.message}; stdout=${out.slice(0, 500)}`));
          return;
        }
      }
      reject(new Error(`python exited ${code}: ${err.slice(0, 500)}`));
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function customerIdFromNormalized(normalized) {
  const digits = String(normalized?.wa_id || '').replace(/\D/g, '');
  return digits ? `wa:${digits}` : 'wa:unknown';
}

/**
 * @param {object} normalized
 * @param {object} [deps] injectable for tests
 */
async function recognizeInboundMedia(normalized, deps = {}) {
  const workspace = deps.workspace || asiapowerRoot();
  const download = deps.downloadWhatsAppMedia || downloadWhatsAppMedia;
  const runPy = deps.runPython || ((payload, scriptPath) => runPython(payload, scriptPath, workspace));
  const retain = deps.retainOrDiscardPhoto || retainOrDiscardPhoto;
  const mediaVinEnabled = deps.mediaVinEnabled ?? envFlag('APSALES_MEDIA_VIN_ENABLED', true);
  const voiceSttEnabled = deps.voiceSttEnabled ?? envFlag('APSALES_VOICE_STT_ENABLED', true);
  const mediaDir = deps.mediaDir || path.join(workspace, 'memory', 'customer_gateway', 'whatsapp_inbound_media');
  const ocrScript = deps.ocrScript || path.join(workspace, 'scripts', 'apsales-media-vin-ocr.py');
  const sttScript = deps.sttScript || path.join(workspace, 'scripts', 'apsales-media-stt.py');

  try {
    const mediaId = normalized?.media?.id;
    if (!mediaId) return null;

    if (normalized.message_type === 'image' && mediaVinEnabled) {
      try {
        const file = await download(mediaId);
        await fsp.mkdir(mediaDir, { recursive: true });
        const safeName = String(file.filename || 'image.jpg').replace(/[^\w.-]/g, '_');
        const tmpPath = path.join(mediaDir, `cloud-${Date.now()}-${safeName}`);
        await fsp.writeFile(tmpPath, file.buffer);
        const ocr = await runPy({ path: tmpPath }, ocrScript).catch((err) => ({
          status: 'failed',
          error: String(err?.message || err),
        }));
        const bestVin =
          ocr?.best_vin
          || (ocr?.vin_candidates || []).find((c) => c.valid_format)?.vin
          || null;
        const ext = (file.mimeType || '').includes('png') ? 'png' : 'jpg';
        await retain({
          workspace,
          customerId: customerIdFromNormalized(normalized),
          tmpPath,
          hasVin: Boolean(bestVin),
          vin: bestVin,
          sourceLine: '+86',
          ext,
        }).catch(async () => {
          await fsp.unlink(tmpPath).catch(() => {});
        });
        if (ocr?.status === 'failed' && !bestVin) {
          return { kind: 'image', vin: null, error: ocr.error || 'ocr_failed', plate_facts: null };
        }
        return {
          kind: 'image',
          vin: bestVin,
          plate_facts: ocr?.plate_facts || null,
          error: bestVin ? null : (ocr?.error || null),
        };
      } catch (err) {
        return { kind: 'image', error: String(err?.message || err) };
      }
    }

    // Only voice notes — not arbitrary audio attachments.
    if (
      normalized.message_type === 'audio'
      && normalized.media?.voice === true
      && voiceSttEnabled
    ) {
      try {
        const file = await download(mediaId);
        await fsp.mkdir(mediaDir, { recursive: true });
        const safeName = String(file.filename || 'voice.ogg').replace(/[^\w.-]/g, '_');
        const tmpPath = path.join(mediaDir, `cloud-${Date.now()}-${safeName}`);
        await fsp.writeFile(tmpPath, file.buffer);
        const stt = await runPy({ path: tmpPath }, sttScript).catch((err) => ({
          status: 'failed',
          error: String(err?.message || err),
        }));
        await fsp.unlink(tmpPath).catch(() => {});
        const transcript = String(stt?.text || '').trim();
        if (stt?.status !== 'success' || !transcript) {
          return {
            kind: 'voice',
            transcript: '',
            status: stt?.status || 'failed',
            error: stt?.error || 'stt_failed',
          };
        }
        return {
          kind: 'voice',
          transcript,
          status: 'success',
        };
      } catch (err) {
        return { kind: 'voice', error: String(err?.message || err) };
      }
    }

    if (normalized.message_type === 'audio' && normalized.media?.voice !== true) {
      return { kind: 'audio', skipped: true, reason: 'audio_not_voice' };
    }

    return null;
  } catch (err) {
    return { error: String(err?.message || err) };
  }
}

function applyRecognitionToNormalized(normalized, recognition) {
  if (!normalized || !recognition) return normalized;
  if (recognition.kind === 'image' && recognition.vin) {
    normalized.text = `${normalized.text || ''}\nVIN: ${recognition.vin}`.trim();
  } else if (recognition.kind === 'voice' && recognition.transcript) {
    normalized.text = recognition.transcript;
  }
  return normalized;
}

module.exports = {
  recognizeInboundMedia,
  applyRecognitionToNormalized,
  runPython,
  asiapowerRoot,
};

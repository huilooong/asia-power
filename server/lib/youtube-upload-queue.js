/**
 * Durable queue: approved self-hosted videos → YouTube upload worker.
 * Node enqueues; Python scripts/youtube_inventory_upload.py --process-queue drains.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { loadJson, saveJsonAtomic } = require('./json-store');

const DEFAULT_QUEUE_REL = path.join('reports', 'youtube-upload-queue.json');
const EMPTY_QUEUE = { version: 1, items: [] };

function selfHostedPublicVideoUrl(item) {
  const url = String(item?.video?.url || item?.videoUrl || '').trim().split('?')[0];
  if (!url) return '';
  if (/youtube\.com|youtu\.be/i.test(url)) return '';
  if (url.includes('/uploads/pending/')) return '';
  if (url.startsWith('/uploads/videos/') || url.includes('/uploads/videos/')) {
    const idx = url.indexOf('/uploads/videos/');
    return idx >= 0 ? url.slice(idx) : url;
  }
  return '';
}

function hasYoutubeId(item) {
  const direct = String(item?.youtubeVideoId || item?.video?.youtubeId || '').trim();
  if (direct) return true;
  const url = String(item?.video?.url || item?.videoUrl || '');
  return /youtube\.com|youtu\.be/i.test(url);
}

function needsYoutubeSync(item) {
  return Boolean(item?.stockId && selfHostedPublicVideoUrl(item) && !hasYoutubeId(item));
}

function createYoutubeUploadQueue(rootDir, options = {}) {
  const queueFile = options.queueFile || path.join(rootDir, DEFAULT_QUEUE_REL);

  function load() {
    return loadJson(queueFile, { ...EMPTY_QUEUE, items: [] }, { createIfMissing: true });
  }

  function save(data) {
    saveJsonAtomic(queueFile, data);
  }

  function enqueue(itemOrStock) {
    const stockId = String(itemOrStock?.stockId || itemOrStock || '').trim().toUpperCase();
    if (!stockId) return { queued: false, reason: 'missing_stockId' };

    const localVideoUrl = typeof itemOrStock === 'object'
      ? (itemOrStock.localVideoUrl || selfHostedPublicVideoUrl(itemOrStock) || '')
      : '';

    if (typeof itemOrStock === 'object' && hasYoutubeId(itemOrStock)) {
      return { queued: false, reason: 'already_youtube' };
    }
    if (typeof itemOrStock === 'object' && !localVideoUrl) {
      return { queued: false, reason: 'no_self_hosted_video' };
    }

    const queue = load();
    queue.items = Array.isArray(queue.items) ? queue.items : [];

    const active = queue.items.find(
      (row) => String(row.stockId || '').toUpperCase() === stockId
        && ['pending', 'processing'].includes(row.status)
    );
    if (active) {
      if (localVideoUrl && !active.localVideoUrl) {
        active.localVideoUrl = localVideoUrl;
        save(queue);
      }
      return { queued: true, already: true, item: active };
    }

    const done = queue.items.find(
      (row) => String(row.stockId || '').toUpperCase() === stockId
        && row.status === 'done'
        && row.youtubeId
    );
    if (done) {
      return { queued: false, reason: 'already_done', item: done };
    }

    const failed = queue.items.find(
      (row) => String(row.stockId || '').toUpperCase() === stockId
        && row.status === 'failed'
    );
    if (failed) {
      failed.status = 'pending';
      failed.localVideoUrl = localVideoUrl || failed.localVideoUrl || '';
      failed.nextRetryAt = null;
      failed.lastError = '';
      failed.requeuedAt = new Date().toISOString();
      save(queue);
      console.log('[youtube-queue] requeued failed', stockId);
      return { queued: true, already: false, item: failed };
    }

    const row = {
      stockId,
      localVideoUrl: localVideoUrl || '',
      status: 'pending',
      attempts: 0,
      enqueuedAt: new Date().toISOString(),
      nextRetryAt: null,
      lastError: '',
      youtubeId: null,
      youtubeUrl: null,
    };
    queue.items.push(row);
    save(queue);
    console.log('[youtube-queue] enqueued', stockId, localVideoUrl || '(resolve later)');
    return { queued: true, already: false, item: row };
  }

  function enqueueIfNeeded(item) {
    if (!needsYoutubeSync(item)) {
      return { queued: false, reason: 'not_needed' };
    }
    return enqueue(item);
  }

  function pendingCount() {
    const now = Date.now();
    return (load().items || []).filter((row) => {
      if (row.status !== 'pending') return false;
      if (row.nextRetryAt) {
        const t = Date.parse(row.nextRetryAt);
        if (Number.isFinite(t) && t > now) return false;
      }
      return true;
    }).length;
  }

  function resolvePython() {
    if (options.pythonPath) return options.pythonPath;
    const envPy = String(process.env.YOUTUBE_PYTHON || '').trim();
    if (envPy) return envPy;
    const candidates = [
      path.join(rootDir, '.venv', 'bin', 'python3'),
      path.join(rootDir, '.venv-qxb', 'bin', 'python3'),
      'python3',
    ];
    for (const c of candidates) {
      if (c === 'python3') return c;
      if (fs.existsSync(c)) return c;
    }
    return 'python3';
  }

  function tokenReady() {
    const token = path.join(rootDir, 'work', 'youtube-inventory-migrate', 'youtube-oauth-token.json');
    return fs.existsSync(token);
  }

  let tickRunning = false;
  let timer = null;

  function tick() {
    if (tickRunning) return;
    if (String(process.env.YOUTUBE_SYNC_ENABLED || '1') === '0') return;
    if (!tokenReady()) return;
    if (pendingCount() < 1) return;

    const python = resolvePython();
    const script = path.join(rootDir, 'scripts', 'youtube_inventory_upload.py');
    if (!fs.existsSync(script)) {
      console.error('[youtube-queue] missing script', script);
      return;
    }

    tickRunning = true;
    const batch = String(process.env.YOUTUBE_UPLOAD_BATCH || '1');
    const child = spawn(python, [script, '--process-queue', '--batch', batch], {
      cwd: rootDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (buf) => {
      stderr += buf.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.stdout.on('data', (buf) => {
      const line = buf.toString().trim();
      if (line) console.log('[youtube-queue]', line);
    });
    child.on('error', (err) => {
      console.error('[youtube-queue] spawn failed:', err.message);
      tickRunning = false;
    });
    child.on('close', (code) => {
      if (code !== 0) {
        console.error('[youtube-queue] worker exit', code, stderr.slice(-500));
      }
      tickRunning = false;
    });
  }

  function startWorker() {
    if (timer) return;
    if (String(process.env.YOUTUBE_SYNC_ENABLED || '1') === '0') {
      console.log('[youtube-queue] worker disabled (YOUTUBE_SYNC_ENABLED=0)');
      return;
    }
    const pollMs = Math.max(15_000, Number(process.env.YOUTUBE_UPLOAD_QUEUE_POLL_MS || 120_000));
    const ready = tokenReady();
    console.log(
      `[youtube-queue] worker poll ${pollMs}ms token=${ready ? 'ready' : 'missing'}`
    );
    setTimeout(tick, 5_000);
    timer = setInterval(tick, pollMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  return {
    queueFile,
    enqueue,
    enqueueIfNeeded,
    needsYoutubeSync,
    selfHostedPublicVideoUrl,
    hasYoutubeId,
    pendingCount,
    startWorker,
    tick,
  };
}

module.exports = {
  createYoutubeUploadQueue,
  needsYoutubeSync,
  selfHostedPublicVideoUrl,
  hasYoutubeId,
};

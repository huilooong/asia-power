#!/usr/bin/env node
/**
 * QXB CEO review — Codex UI + 子龙 training + live upload
 * http://127.0.0.1:8789/review
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const STATIC = path.join(__dirname, 'static');

function resolvePython() {
  if (process.env.PYTHON) return process.env.PYTHON;
  for (const rel of ['.venv-qxb/bin/python3', '.venv/bin/python3']) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return 'python3';
}
const API_PY = path.join(__dirname, 'qxb_review_api.py');
const PORT = Number(process.env.QXB_REVIEW_PORT || 8789);
const BIND = process.env.BIND_HOST || '127.0.0.1';

function json(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { text += c; });
    req.on('end', () => {
      try { resolve(text ? JSON.parse(text) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function runPython(args, stdin = '') {
  return new Promise((resolve, reject) => {
    const py = resolvePython();
    const child = spawn(py, [API_PY, ...args], {
      cwd: ROOT,
      env: { ...process.env, PYTHONPATH: ROOT },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || out.trim() || `python exit ${code}`));
        return;
      }
      try { resolve(JSON.parse(out)); } catch {
        reject(new Error(`Invalid JSON: ${out.slice(0, 300)}`));
      }
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

function serveFile(res, absPath) {
  const rootResolved = path.resolve(ROOT);
  const fileResolved = path.resolve(absPath);
  if (!fileResolved.startsWith(rootResolved) && !fileResolved.startsWith(path.resolve(STATIC))) {
    return json(res, 403, { ok: false, error: 'forbidden' });
  }
  fs.readFile(fileResolved, (err, data) => {
    if (err) return json(res, 404, { ok: false, error: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fileResolved).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if (p === '/' || p === '/review' || p === '/review/') {
      return serveFile(res, path.join(STATIC, 'review.html'));
    }
    if (p.startsWith('/static/')) {
      return serveFile(res, path.join(STATIC, p.slice('/static/'.length)));
    }
    if (p.startsWith('/media/')) {
      const parts = p.slice('/media/'.length).split('/').map((seg) => decodeURIComponent(seg));
      return serveFile(res, path.join(ROOT, ...parts));
    }
    if (p.startsWith('/images/')) {
      const rel = decodeURIComponent(p.slice('/images/'.length));
      return serveFile(res, path.isAbsolute(rel) ? rel : path.resolve(ROOT, rel));
    }
    if (p === '/api/unuploaded' && req.method === 'GET') {
      const page = url.searchParams.get('page') || '0';
      const size = url.searchParams.get('size') || '10';
      const exclude = url.searchParams.get('exclude') || '';
      const filter = url.searchParams.get('filter') || 'all';
      const data = await runPython(['unuploaded', page, size, exclude, filter]);
      return json(res, 200, data);
    }
    if (p === '/api/memory' && req.method === 'GET') {
      const data = await runPython(['memory']);
      return json(res, 200, data);
    }
    if (p === '/api/qxb-status' && req.method === 'GET') {
      const data = await runPython(['server-status']);
      return json(res, 200, data);
    }
    if (p === '/api/decision' && req.method === 'POST') {
      const body = await readBody(req);
      const data = await runPython(['decide'], JSON.stringify(body));
      const code = data.ok === false ? (data.error === 'blocked_missing_slots' ? 400 : 409) : 200;
      if (data.ok && data.queued) tickUploadQueue();
      return json(res, code, data);
    }
    if (p === '/api/upload-queue' && req.method === 'GET') {
      const data = await runPython(['upload-queue']);
      return json(res, 200, data);
    }
    json(res, 404, { error: 'not_found' });
  } catch (err) {
    json(res, 500, { ok: false, error: err.message || String(err) });
  }
});

const QUEUE_POLL_MS = Number(process.env.QXB_UPLOAD_QUEUE_POLL_MS || 4000);

function tickUploadQueue() {
  runPython(['process-upload-queue', '1']).catch(() => {});
}

server.listen(PORT, BIND, () => {
  console.log(`QXB review UI (子龙训练+上传) → http://${BIND}:${PORT}/review`);
  console.log(`Repo: ${ROOT}`);
  runPython(['memory']).catch(() => {});
  setTimeout(tickUploadQueue, 1500);
  setInterval(tickUploadQueue, QUEUE_POLL_MS);
});

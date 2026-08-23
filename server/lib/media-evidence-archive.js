'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadJson, saveJsonAtomic } = require('./json-store');
const media = require('./media-storage');
const r2 = require('./r2-storage');

function mediaPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try { return raw.startsWith('http') ? new URL(raw).pathname : media.stripAccessQuery(raw); } catch { return media.stripAccessQuery(raw); }
}

function mediaIdentity(value) {
  return mediaPath(value).toLowerCase();
}

function flattenRecordMedia(record) {
  const assets = [];
  for (const photo of record?.photos || []) {
    if (typeof photo === 'string') {
      if (photo) assets.push({ kind: 'photo', url: photo, thumbUrl: '', label: '' });
      continue;
    }
    if (photo?.url) assets.push({ kind: 'photo', url: photo.url, thumbUrl: photo.thumbUrl || '', label: photo.label || '' });
  }
  const videoUrl = record?.video?.url || record?.videoUrl || '';
  if (videoUrl) assets.push({ kind: 'video', url: videoUrl, thumbUrl: '', label: record?.video?.fileName || 'video' });
  return assets;
}

function removedMedia(before, after) {
  const afterIds = new Set(flattenRecordMedia(after).map((asset) => mediaIdentity(asset.url)).filter(Boolean));
  return flattenRecordMedia(before).filter((asset) => {
    const id = mediaIdentity(asset.url);
    return id && !afterIds.has(id);
  });
}

function createMediaEvidenceArchive(rootDir) {
  const dataDir = path.join(rootDir, 'data');
  const file = path.join(dataDir, 'half-cut-media-evidence.json');
  const privateDir = path.join(dataDir, 'private-media-evidence');

  function load() {
    const rows = loadJson(file, []);
    return Array.isArray(rows) ? rows : [];
  }

  function save(rows) {
    saveJsonAtomic(file, rows);
    try { fs.chmodSync(file, 0o600); } catch {}
  }

  function referencedElsewhere(url, stockId, approved) {
    const target = mediaIdentity(url);
    if (!target) return false;
    return (approved || []).some((item) => String(item.stockId || '') !== String(stockId || '')
      && flattenRecordMedia(item).some((asset) => mediaIdentity(asset.url) === target));
  }

  async function archiveOne(stockId, asset, actor, approved) {
    const id = `EVD-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const sourcePath = mediaPath(asset.url);
    const filename = path.basename(sourcePath || `${asset.kind}.bin`);
    const entryDir = path.join(privateDir, String(stockId || 'unknown'), id);
    const diskArchive = path.join(entryDir, filename);
    const r2ArchiveKey = `private-evidence/${String(stockId || 'unknown')}/${id}/${filename}`;
    const shared = referencedElsewhere(asset.url, stockId, approved);
    let storage = 'reference-only';

    if (sourcePath.startsWith('/uploads/')) {
      const diskSource = path.join(rootDir, sourcePath.replace(/^\/+/, ''));
      if (fs.existsSync(diskSource) && fs.statSync(diskSource).isFile()) {
        fs.mkdirSync(entryDir, { recursive: true });
        fs.copyFileSync(diskSource, diskArchive);
        storage = 'disk-private';
      }
      if (r2.isEnabled()) {
        try {
          await r2.copyObject(r2.objectKeyFromUploadsPath(sourcePath), r2ArchiveKey);
          storage = 'r2-private';
        } catch (err) {
          if (storage === 'reference-only') console.warn('[evidence] R2 archive copy failed:', err.message);
        }
      }
    }

    return {
      id,
      stockId,
      kind: asset.kind,
      label: asset.label || '',
      originalUrl: asset.url,
      originalThumbUrl: asset.thumbUrl || '',
      sourcePath,
      storage,
      diskArchive: storage === 'disk-private' ? diskArchive : '',
      r2ArchiveKey: storage === 'r2-private' ? r2ArchiveKey : '',
      sharedReference: shared,
      archivedAt: new Date().toISOString(),
      archivedBy: actor?.id || '',
      archivedByName: actor?.supplierName || actor?.username || '',
    };
  }

  async function prepare({ stockId, removed, actor, approved }) {
    const entries = [];
    for (const asset of removed || []) entries.push(await archiveOne(stockId, asset, actor, approved));
    if (entries.length) save([...entries, ...load()]);
    return entries;
  }

  async function finalize(entries) {
    for (const entry of entries || []) {
      if (entry.sharedReference || entry.storage === 'reference-only') continue;
      const sourcePath = entry.sourcePath || '';
      if (!sourcePath.startsWith('/uploads/')) continue;
      const diskSource = path.join(rootDir, sourcePath.replace(/^\/+/, ''));
      if (fs.existsSync(diskSource) && fs.statSync(diskSource).isFile()) {
        try { fs.unlinkSync(diskSource); } catch (err) { console.warn('[evidence] disk public removal failed:', err.message); }
      }
      if (r2.isEnabled()) {
        try { await r2.deleteObject(r2.objectKeyFromUploadsPath(sourcePath)); } catch (err) { console.warn('[evidence] R2 public removal failed:', err.message); }
      }
    }
  }

  function listForStock(stockId) {
    const target = String(stockId || '').toUpperCase();
    return load().filter((entry) => String(entry.stockId || '').toUpperCase() === target).map((entry) => ({
      id: entry.id,
      stockId: entry.stockId,
      kind: entry.kind,
      label: entry.label,
      archivedAt: entry.archivedAt,
      archivedByName: entry.archivedByName,
      available: entry.storage !== 'reference-only',
    }));
  }

  async function readEvidence(stockId, evidenceId) {
    const entry = load().find((row) => row.id === evidenceId && String(row.stockId || '') === String(stockId || ''));
    if (!entry) return null;
    let buffer = null;
    if (entry.storage === 'r2-private' && entry.r2ArchiveKey && r2.isEnabled()) buffer = await r2.getObjectBuffer(entry.r2ArchiveKey);
    if (!buffer && entry.diskArchive && fs.existsSync(entry.diskArchive)) buffer = fs.readFileSync(entry.diskArchive);
    if (!buffer) return null;
    const ext = path.extname(entry.sourcePath || '').toLowerCase();
    const mime = ({ '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.mp4':'video/mp4', '.webm':'video/webm', '.mov':'video/quicktime' })[ext] || 'application/octet-stream';
    return { buffer, mime, entry };
  }

  return { file, removedMedia, prepare, finalize, listForStock, readEvidence };
}

module.exports = { createMediaEvidenceArchive, removedMedia, mediaIdentity, flattenRecordMedia };

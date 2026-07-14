'use strict';

/**
 * WhatsApp Cloud API media download (Graph).
 * Tokens never logged.
 */

const { accessToken, graphVersion } = require('./whatsapp-cloud-send');

const MAX_BYTES = Number.parseInt(process.env.WHATSAPP_TELEGRAM_MEDIA_MAX_BYTES || String(8 * 1024 * 1024), 10);

async function graphGetJson(url) {
  const token = accessToken();
  if (!token) {
    const err = new Error('WHATSAPP_ACCESS_TOKEN not configured');
    err.code = 'NO_TOKEN';
    throw err;
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    const err = new Error(`Graph media meta ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function downloadUrl(url, { maxBytes = MAX_BYTES } = {}) {
  const token = accessToken();
  if (!token) {
    const err = new Error('WHATSAPP_ACCESS_TOKEN not configured');
    err.code = 'NO_TOKEN';
    throw err;
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(`Graph media download ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) {
    const err = new Error(`media too large (${buf.length} > ${maxBytes})`);
    err.code = 'TOO_LARGE';
    throw err;
  }
  return {
    buffer: buf,
    contentType: res.headers.get('content-type') || '',
  };
}

/**
 * @param {string} mediaId WhatsApp media id from inbound message
 * @returns {Promise<{ buffer: Buffer, mimeType: string, filename: string, sha256?: string }>}
 */
async function downloadWhatsAppMedia(mediaId) {
  const id = String(mediaId || '').trim();
  if (!id) {
    const err = new Error('media id required');
    err.code = 'NO_MEDIA_ID';
    throw err;
  }
  const meta = await graphGetJson(
    `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(id)}`,
  );
  const url = meta.url || meta.download_url || '';
  if (!url) {
    const err = new Error('media url missing');
    err.code = 'NO_MEDIA_URL';
    err.data = { id: id.slice(0, 12) };
    throw err;
  }
  const file = await downloadUrl(url);
  const mimeType = meta.mime_type || file.contentType || 'application/octet-stream';
  let ext = 'bin';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('mp4')) ext = 'mp4';
  else if (mimeType.includes('ogg') || mimeType.includes('opus')) ext = 'ogg';
  else if (mimeType.includes('pdf')) ext = 'pdf';
  return {
    buffer: file.buffer,
    mimeType,
    filename: `${id.slice(0, 16)}.${ext}`,
    sha256: meta.sha256 || '',
  };
}

module.exports = {
  downloadWhatsAppMedia,
  MAX_BYTES,
};

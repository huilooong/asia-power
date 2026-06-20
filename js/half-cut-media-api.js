/**
 * AsiaPower — Half-cut media upload API (server-side files, URL-only records)
 */
(function () {
  'use strict';

  let serverMode = false;
  let initPromise = null;
  let uploadToken = null;
  let uploadTokenExpiresAt = 0;

  function apiUrl(path) {
    const base = window.location.origin;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async function probeServer() {
    try {
      const res = await fetch(apiUrl('/api/half-cuts/health'), { method: 'GET' });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.ok;
    } catch {
      return false;
    }
  }

  function init() {
    if (!initPromise) {
      initPromise = probeServer().then((ok) => {
        serverMode = ok;
        return ok;
      });
    }
    return initPromise;
  }

  function isServerMode() {
    return serverMode;
  }

  function requireServer() {
    if (!serverMode) {
      throw new Error('Media uploads require the local half-cut server. Run: node server/half-cut-local-server.js');
    }
  }

  function supplierHeaders() {
    const headers = {};
    if (window.SUPPLIER_UPLOAD_KEY) headers['X-Supplier-Key'] = window.SUPPLIER_UPLOAD_KEY;
    return headers;
  }

  function clearUploadToken() {
    uploadToken = null;
    uploadTokenExpiresAt = 0;
  }

  function isUploadTokenError(status, data) {
    if (status !== 401) return false;
    const msg = String(data?.error || '').toLowerCase();
    return msg.includes('upload token');
  }

  async function ensureUploadToken(options = {}) {
    const force = options.force === true;
    if (!force && uploadToken && Date.now() < uploadTokenExpiresAt - 60000) {
      return uploadToken;
    }
    if (!window.SUPPLIER_UPLOAD_KEY) {
      throw new Error('Upload key missing — refresh the page or contact AsiaPower support.');
    }
    const res = await fetch(apiUrl('/api/half-cuts/upload-token'), {
      method: 'POST',
      headers: supplierHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to obtain upload token');
    uploadToken = data.token;
    uploadTokenExpiresAt = data.expiresAt ? Date.parse(data.expiresAt) : Date.now() + 30 * 60 * 1000;
    return uploadToken;
  }

  async function uploadPhoto(file, label) {
    requireServer();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await ensureUploadToken({ force: attempt > 0 });
      const form = new FormData();
      form.append('file', file);
      if (label) form.append('label', label);
      const res = await fetch(apiUrl('/api/half-cuts/upload/photo'), {
        method: 'POST',
        headers: { 'X-Upload-Token': token, ...supplierHeaders() },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (isUploadTokenError(res.status, data) && attempt === 0) {
        clearUploadToken();
        continue;
      }
      if (!res.ok) throw new Error(data.error || 'Photo upload failed');
      return data;
    }
    throw new Error('Upload token required — please refresh the page and try again.');
  }

  async function uploadVideo(file) {
    requireServer();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await ensureUploadToken({ force: attempt > 0 });
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(apiUrl('/api/half-cuts/upload/video'), {
        method: 'POST',
        headers: { 'X-Upload-Token': token, ...supplierHeaders() },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (isUploadTokenError(res.status, data) && attempt === 0) {
        clearUploadToken();
        continue;
      }
      if (!res.ok) throw new Error(data.error || 'Video upload failed');
      return data;
    }
    throw new Error('Upload token required — please refresh the page and try again.');
  }

  async function fetchPublic() {
    requireServer();
    const res = await fetch(apiUrl('/api/half-cuts/public'));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load catalog');
    return data;
  }

  async function fetchState() {
    requireServer();
    const res = await fetch(apiUrl('/api/half-cuts/state'), { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load state');
    return data;
  }

  async function saveState(state) {
    requireServer();
    const res = await fetch(apiUrl('/api/half-cuts/state'), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save state');
    return data;
  }

  async function postSubmission(submission) {
    requireServer();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await ensureUploadToken({ force: attempt > 0 });
      const res = await fetch(apiUrl('/api/half-cuts/submissions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Upload-Token': token,
          ...supplierHeaders(),
        },
        body: JSON.stringify(submission),
      });
      const data = await res.json().catch(() => ({}));
      if (isUploadTokenError(res.status, data) && attempt === 0) {
        clearUploadToken();
        continue;
      }
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      clearUploadToken();
      return data;
    }
    throw new Error('Upload token required — please refresh the page and try again.');
  }

  window.HalfCutMediaApi = {
    init,
    isServerMode,
    requireServer,
    uploadPhoto,
    uploadVideo,
    fetchPublic,
    fetchState,
    saveState,
    postSubmission,
    ensureUploadToken,
    clearUploadToken,
  };

  init();
})();

/**
 * AsiaPower — Half-cut media upload API (server-side files, URL-only records)
 */
(function () {
  'use strict';

  let serverMode = false;
  let initPromise = null;

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

  async function uploadPhoto(file, label) {
    requireServer();
    const form = new FormData();
    form.append('file', file);
    if (label) form.append('label', label);
    const res = await fetch(apiUrl('/api/half-cuts/upload/photo'), { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Photo upload failed');
    return data;
  }

  async function uploadVideo(file) {
    requireServer();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(apiUrl('/api/half-cuts/upload/video'), { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Video upload failed');
    return data;
  }

  async function fetchState() {
    requireServer();
    const res = await fetch(apiUrl('/api/half-cuts/state'));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load state');
    return data;
  }

  async function saveState(state) {
    requireServer();
    const res = await fetch(apiUrl('/api/half-cuts/state'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save state');
    return data;
  }

  window.HalfCutMediaApi = {
    init,
    isServerMode,
    requireServer,
    uploadPhoto,
    uploadVideo,
    fetchState,
    saveState,
  };

  init();
})();

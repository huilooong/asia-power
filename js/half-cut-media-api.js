/**
 * AsiaPower — Half-cut media upload API (server-side files, URL-only records)
 */
(function () {
  'use strict';

  let serverMode = false;
  let initPromise = null;
  let uploadToken = null;
  let uploadTokenExpiresAt = 0;
  let uploadConfig = { r2: false };

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

  async function loadUploadConfig() {
    try {
      const res = await fetch(apiUrl('/api/half-cuts/upload/config'));
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && typeof data === 'object') uploadConfig = data;
    } catch {
      uploadConfig = { r2: false };
    }
    return uploadConfig;
  }

  function init() {
    if (!initPromise) {
      initPromise = probeServer().then(async (ok) => {
        serverMode = ok;
        if (ok) await loadUploadConfig();
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

  function uploadError(status, data, fallback) {
    const msg = String(data?.error || fallback || 'Upload failed');
    if (status === 403) {
      return 'Upload access denied — please refresh the page. If this continues, contact AsiaPower support.\n上传权限被拒绝 — 请刷新页面重试，若仍失败请联系 AsiaPower。';
    }
    if (status === 401 && /upload token/i.test(msg)) {
      return 'Upload session expired — please refresh the page and try again.\n上传会话已过期 — 请刷新页面后重试。';
    }
    if (status === 429) {
      return 'Too many uploads — wait a minute and try again.\n上传过于频繁 — 请稍后再试。';
    }
    if (status === 503) {
      return 'Upload server busy — wait a few seconds and try again.\n服务器繁忙 — 请稍等几秒后重试。';
    }
    return msg;
  }

  async function checkUploadReady() {
    requireServer();
    if (!window.SUPPLIER_UPLOAD_KEY) {
      throw new Error('Upload key missing — refresh the page or contact AsiaPower support.\n上传密钥未加载 — 请刷新页面或联系 AsiaPower。');
    }
    const healthRes = await fetch(apiUrl('/api/half-cuts/health'));
    const health = await healthRes.json().catch(() => ({}));
    if (!healthRes.ok || !health.ok) {
      throw new Error('Upload server unavailable — try again shortly.\n上传服务暂不可用 — 请稍后再试。');
    }
    if (health.supplierGate === false) {
      throw new Error('Supplier upload is not configured on the server — contact AsiaPower support.\n服务器未配置供应商上传 — 请联系 AsiaPower。');
    }
    await ensureUploadToken();
    return health;
  }

  async function ensureUploadToken(options = {}) {
    const force = options.force === true;
    if (!force && uploadToken && Date.now() < uploadTokenExpiresAt - 60000) {
      return uploadToken;
    }
    if (!window.SUPPLIER_UPLOAD_KEY) {
      throw new Error('Upload key missing — refresh the page or contact AsiaPower support.\n上传密钥未加载 — 请刷新页面或联系 AsiaPower。');
    }
    const res = await fetch(apiUrl('/api/half-cuts/upload-token'), {
      method: 'POST',
      headers: supplierHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(uploadError(res.status, data, 'Failed to obtain upload token'));
    uploadToken = data.token;
    uploadTokenExpiresAt = data.expiresAt ? Date.parse(data.expiresAt) : Date.now() + 30 * 60 * 1000;
    return uploadToken;
  }

  function isDirectUploadEnabled() {
    return uploadConfig.r2 === true && uploadConfig.directUpload !== false;
  }

  function shouldFallbackToServer(err) {
    if (uploadConfig.serverFallback === false) return false;
    const msg = String(err?.message || err || '').toLowerCase();
    return /direct upload|failed to fetch|network error|storage failed|cors|load failed|parse url|invalid url|null/i.test(msg);
  }

  function resolveUploadMime(file, kind) {
    if (kind === 'video') {
      return window.HalfCutUploadLayer?.resolveVideoMime?.(file) || file.type || 'video/mp4';
    }
    return file.type || 'image/jpeg';
  }

  async function uploadViaR2(file, kind, label) {
    const token = await ensureUploadToken();
    const mimeType = resolveUploadMime(file, kind);
    const presignRes = await fetch(apiUrl('/api/half-cuts/upload/presign'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Token': token,
        ...supplierHeaders(),
      },
      body: JSON.stringify({
        kind,
        mimeType,
        filename: file.name,
        size: file.size,
        label,
      }),
    });
    const presign = await presignRes.json().catch(() => ({}));
    if (!presignRes.ok) throw new Error(presign.error || 'Upload presign failed');
    const putRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': presign.mimeType || mimeType },
      body: file,
    });
    if (!putRes.ok) throw new Error('Direct upload to storage failed');
    return presign;
  }

  async function uploadViaServerMultipart(file, endpoint, label) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await ensureUploadToken({ force: attempt > 0 });
      const form = new FormData();
      form.append('file', file);
      if (label) form.append('label', label);
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'X-Upload-Token': token, ...supplierHeaders() },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (isUploadTokenError(res.status, data) && attempt === 0) {
        clearUploadToken();
        continue;
      }
      if (!res.ok) throw new Error(uploadError(res.status, data, 'Upload failed'));
      return data;
    }
    throw new Error('Upload token required — please refresh the page and try again.');
  }

  async function uploadPhoto(file, label) {
    requireServer();
    if (isDirectUploadEnabled()) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await uploadViaR2(file, 'photo', label);
        } catch (err) {
          if (/upload token/i.test(String(err.message || '')) && attempt === 0) {
            clearUploadToken();
            continue;
          }
          if (shouldFallbackToServer(err)) {
            console.warn('[HalfCutMediaApi] direct R2 photo upload failed, using server fallback');
            return uploadViaServerMultipart(file, '/api/half-cuts/upload/photo', label);
          }
          throw err;
        }
      }
    }
    return uploadViaServerMultipart(file, '/api/half-cuts/upload/photo', label);
  }

  async function uploadVideo(file) {
    requireServer();
    if (isDirectUploadEnabled()) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await uploadViaR2(file, 'video');
        } catch (err) {
          if (/upload token/i.test(String(err.message || '')) && attempt === 0) {
            clearUploadToken();
            continue;
          }
          if (shouldFallbackToServer(err)) {
            console.warn('[HalfCutMediaApi] direct R2 video upload failed, using server fallback');
            return uploadViaServerMultipart(file, '/api/half-cuts/upload/video');
          }
          throw err;
        }
      }
    }
    return uploadViaServerMultipart(file, '/api/half-cuts/upload/video');
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

  async function approveSubmission(submissionId, payload) {
    requireServer();
    const res = await fetch(apiUrl(`/api/half-cuts/submissions/${encodeURIComponent(submissionId)}/approve`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to approve submission');
    return data;
  }

  async function rejectSubmission(submissionId, payload) {
    requireServer();
    const res = await fetch(apiUrl(`/api/half-cuts/submissions/${encodeURIComponent(submissionId)}/reject`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to reject submission');
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

  async function patchInventory(stockId, edits) {
    requireServer();
    const res = await fetch(apiUrl(`/api/half-cuts/inventory/${encodeURIComponent(stockId)}`), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edits || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update inventory');
    return data;
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
    approveSubmission,
    rejectSubmission,
    patchInventory,
    postSubmission,
    ensureUploadToken,
    clearUploadToken,
    checkUploadReady,
  };

  init();
})();

/**
 * AsiaPower — Shared admin UI helpers (auth check, top feedback banner, Google admin login)
 */
(function () {
  'use strict';

  async function ensureAdminSession() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.user?.role === 'admin' ? data.user : null;
    } catch {
      return null;
    }
  }

  function isAuthError(err) {
    const msg = String(err?.message || err || '');
    return /authentication required|unauthorized|invalid credentials|sign in/i.test(msg);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Ensure a sticky feedback bar exists at the top of root (returns the element). */
  function ensureFeedbackBar(root, id) {
    const barId = id || 'admin-page-feedback';
    let el = root.querySelector(`#${barId}`);
    if (!el) {
      el = document.createElement('div');
      el.id = barId;
      el.className = 'admin-page-feedback';
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'polite');
      el.hidden = true;
      root.prepend(el);
    } else if (el.parentElement === root && root.firstElementChild !== el) {
      root.prepend(el);
    }
    return el;
  }

  function showFeedback(el, message, type) {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'admin-page-feedback';
      return;
    }
    el.hidden = false;
    el.className = `admin-page-feedback admin-page-feedback--${type || 'info'}`;
    el.innerHTML = typeof message === 'string' ? escapeHtml(message) : message;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function authExpiredMessage() {
    return `
      <strong>Session expired — please sign in again.</strong>
      <span class="admin-page-feedback__sub">登录已过期，请重新登录后再保存。</span>
      <button type="button" class="btn btn-navy btn-sm admin-page-feedback__action" data-admin-relogin>Sign in / 登录</button>`;
  }

  function handleAuthFailure(root, feedbackEl, onRelogin) {
    showFeedback(feedbackEl, authExpiredMessage(), 'error');
    window.HalfCutInventoryStore?.resetReady?.();
    feedbackEl.querySelector('[data-admin-relogin]')?.addEventListener('click', () => {
      if (typeof onRelogin === 'function') onRelogin();
      else window.location.reload();
    }, { once: true });
  }

  /** Start Google OAuth and return to this admin page (allowlisted emails become admin). */
  async function startGoogleAdminLogin(nextPath) {
    const next = nextPath || (window.location.pathname + window.location.search) || '/admin/inventory.html';
    const res = await fetch(`/api/auth/oauth/start?provider=google&next=${encodeURIComponent(next)}`, {
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Google login unavailable');
    }
    window.location.href = data.url;
  }

  function bindGoogleAdminButton(root, feedbackEl) {
    const btn = root.querySelector('[data-admin-google-login]');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        if (feedbackEl) showFeedback(feedbackEl, 'Redirecting to Google…', 'info');
        await startGoogleAdminLogin();
      } catch (err) {
        if (feedbackEl) showFeedback(feedbackEl, err.message || 'Google login failed', 'error');
      }
    });
  }

  function googleLoginBlockHtml() {
    return `
      <div class="admin-review-login__oauth">
        <button type="button" class="btn btn-outline-navy" data-admin-google-login>
          Continue with Google · 用 Google 登录
        </button>
        <p class="admin-review-login__hint admin-review-login__hint--oauth">
          CEO 白名单邮箱可直接进入管理后台（无需记住 admin 密码）。
        </p>
        <p class="admin-review-login__divider"><span>or password</span></p>
      </div>`;
  }

  window.AdminCommon = {
    ensureAdminSession,
    isAuthError,
    ensureFeedbackBar,
    showFeedback,
    handleAuthFailure,
    escapeHtml,
    startGoogleAdminLogin,
    bindGoogleAdminButton,
    googleLoginBlockHtml,
  };
})();

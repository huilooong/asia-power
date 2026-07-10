/**
 * AsiaPower — Admin inventory hub page (review + approved editor)
 */
(function () {
  'use strict';

  const Admin = () => window.AdminCommon;
  const Hub = () => window.AdminInventoryHub;

  const FEEDBACK_ID = 'admin-inventory-feedback';
  const VALID_TABS = new Set(['pending', 'approved', 'rejected']);

  function parseTab() {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (VALID_TABS.has(fromUrl)) return fromUrl;
    const hash = window.location.hash.replace(/^#/, '');
    if (VALID_TABS.has(hash)) return hash;
    return null;
  }

  function setTab(tab, replace) {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    url.hash = '';
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ tab }, '', url.pathname + url.search);
  }

  function renderLogin(root) {
    root.innerHTML = `
      <div class="admin-review-login">
        <h2>管理员登录</h2>
        <p class="admin-review-login__hint">库存审核与编辑需要管理员身份。</p>
        ${Admin().googleLoginBlockHtml?.() || ''}
        <form id="admin-login-form" class="admin-review-login__form">
          <label>
            <span>用户名</span>
            <input type="text" name="username" autocomplete="username" required>
          </label>
          <label>
            <span>密码</span>
            <input type="password" name="password" autocomplete="current-password" required>
          </label>
          <button type="submit" class="btn btn--primary">登录</button>
        </form>
      </div>`;
    Admin().ensureFeedbackBar(root, FEEDBACK_ID);
    Admin().bindGoogleAdminButton?.(root, Admin().ensureFeedbackBar(root, FEEDBACK_ID));

    document.getElementById('admin-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const bar = Admin().ensureFeedbackBar(root, FEEDBACK_ID);
      Admin().showFeedback(bar, '正在登录…', 'info');
      const body = Object.fromEntries(new FormData(event.target));
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Login failed');
        if (data.role !== 'admin') throw new Error('需要管理员权限');
        window.HalfCutInventoryStore?.resetReady?.();
        boot();
      } catch (err) {
        Admin().showFeedback(bar, err.message || '登录失败', 'error');
      }
    });
  }

  let hubApi = null;

  async function boot() {
    const root = document.getElementById('admin-inventory-root');
    const hub = Hub();
    const admin = Admin();
    if (!root || !hub || !admin) return;

    root.innerHTML = '<p class="admin-review-empty">Loading…</p>';

    try {
      let activeTab = parseTab();
      hubApi = await hub.mount(root, {
        activeTab: activeTab || 'pending',
        feedbackId: FEEDBACK_ID,
        toolbarTitle: '库存审核',
        navLinksHtml: '',
        onTabChange: (tab) => setTab(tab),
        onAuthRequired: () => renderLogin(root),
      });

      if (!activeTab) {
        const lists = hubApi.refreshLists();
        activeTab = lists.pending.length ? 'pending' : 'approved';
        setTab(activeTab, true);
        hubApi.setActiveTab(activeTab);
      }

      if (!window.__adminInventoryPopstate__) {
        window.__adminInventoryPopstate__ = true;
        window.addEventListener('popstate', () => {
          const next = parseTab();
          if (next && hubApi) hubApi.setActiveTab(next);
        });
      }
    } catch (err) {
      if (admin.isAuthError(err)) {
        admin.handleAuthFailure(root, Admin().ensureFeedbackBar(root, FEEDBACK_ID), () => renderLogin(root));
      } else {
        Admin().showFeedback(Admin().ensureFeedbackBar(root, FEEDBACK_ID), err.message || 'Failed to load inventory', 'error');
      }
    }
  }

  function initAdminInventory() {
    const root = document.getElementById('admin-inventory-root');
    if (!root) return;
    if (!window.HalfCutInventoryStore || !Admin() || !Hub()) {
      root.innerHTML = '<p class="admin-review-empty">Inventory scripts failed to load. Hard-refresh the page (Cmd+Shift+R).</p>';
      return;
    }
    Admin().ensureAdminSession().then((user) => {
      if (user) boot();
      else renderLogin(root);
    }).catch((err) => {
      Admin().showFeedback(Admin().ensureFeedbackBar(root, FEEDBACK_ID), err.message || 'Failed to start', 'error');
    });
  }

  document.addEventListener('DOMContentLoaded', initAdminInventory);
})();

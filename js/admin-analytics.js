/**
 * AsiaPower — Admin traffic analytics + inventory review
 */
(function () {
  'use strict';

  const Admin = () => window.AdminCommon;
  const Hub = () => window.AdminInventoryHub;

  const FEEDBACK_ID = 'admin-analytics-feedback';
  const REVIEW_TABS = new Set(['pending', 'approved', 'rejected']);

  function escapeHtml(str) {
    return Admin()?.escapeHtml?.(str) ?? String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseView() {
    const view = new URLSearchParams(window.location.search).get('view');
    if (view === 'traffic' || REVIEW_TABS.has(view)) return view;
    const legacyTab = new URLSearchParams(window.location.search).get('tab');
    if (REVIEW_TABS.has(legacyTab)) return legacyTab;
    return 'traffic';
  }

  function setView(view, replace) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    url.searchParams.delete('tab');
    url.hash = '';
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ view }, '', url.pathname + url.search);
  }

  function adminNav() {
    return [
      ['leads.html', 'Lead Inbox'],
      ['inventory.html?tab=pending', 'Inventory Hub (standalone)'],
    ].map(([href, label]) =>
      `<a href="${href}" class="btn btn-outline-navy btn-sm">${label}</a>`
    ).join('\n');
  }

  function renderLogin(root) {
    root.innerHTML = `
      <div class="admin-review-login">
        <h2>Admin Login</h2>
        <p class="admin-review-login__hint">Analytics and inventory review require administrator authentication.</p>
        <form id="admin-login-form" class="admin-review-login__form">
          <label>Username<input type="text" name="username" required autocomplete="username"></label>
          <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
          <button type="submit" class="btn btn-accent">Sign In</button>
        </form>
      </div>`;
    Admin().ensureFeedbackBar(root, FEEDBACK_ID);

    document.getElementById('admin-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const bar = Admin().ensureFeedbackBar(root, FEEDBACK_ID);
      Admin().showFeedback(bar, 'Signing in…', 'info');
      const body = Object.fromEntries(new FormData(event.target));
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Login failed');
        if (data.role !== 'admin') throw new Error('Admin access required');
        window.HalfCutInventoryStore?.resetReady?.();
        boot();
      } catch (err) {
        Admin().showFeedback(bar, err.message || 'Login failed', 'error');
      }
    });
  }

  function renderDayDetail(day) {
    if (!day) return '<p class="admin-review-empty">No data for this day.</p>';

    const topPaths = (day.topPaths || []).map(([page, count]) =>
      `<tr><td>${escapeHtml(page)}</td><td>${count}</td></tr>`
    ).join('') || '<tr><td colspan="2">—</td></tr>';

    const topCountries = (day.topCountries || []).map(([country, count]) =>
      `<tr><td>${escapeHtml(country)}</td><td>${count}</td></tr>`
    ).join('') || '<tr><td colspan="2">—</td></tr>';

    const ips = (day.ips || []).slice(0, 100).map((entry) => {
      const place = [entry.city, entry.region, entry.country].filter(Boolean).join(', ');
      return `<tr>
        <td><code>${escapeHtml(entry.ip)}</code></td>
        <td>${entry.hits}</td>
        <td>${escapeHtml(place || '—')}</td>
        <td>${escapeHtml(entry.lastPath || '—')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="4">—</td></tr>';

    return `
      <section class="admin-analytics-detail">
        <h3>${escapeHtml(day.day)}</h3>
        <div class="admin-analytics-metrics">
          <div class="admin-analytics-metric"><span>Page views</span><strong>${day.pageviews || 0}</strong></div>
          <div class="admin-analytics-metric"><span>Unique IPs</span><strong>${day.uniqueIpCount || 0}</strong></div>
          <div class="admin-analytics-metric"><span>WhatsApp clicks</span><strong>${day.whatsappClicks || 0}</strong></div>
        </div>
        <div class="admin-analytics-grid">
          <div>
            <h4>Top pages</h4>
            <table class="admin-analytics-table"><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>${topPaths}</tbody></table>
          </div>
          <div>
            <h4>Top countries</h4>
            <table class="admin-analytics-table"><thead><tr><th>Country</th><th>Hits</th></tr></thead><tbody>${topCountries}</tbody></table>
          </div>
        </div>
        <h4>IP breakdown</h4>
        <table class="admin-analytics-table admin-analytics-table--ips">
          <thead><tr><th>IP</th><th>Hits</th><th>Location</th><th>Last page</th></tr></thead>
          <tbody>${ips}</tbody>
        </table>
      </section>`;
  }

  function renderTabs(activeView, counts) {
    const pending = counts?.pending?.length ?? 0;
    const live = counts?.inventory?.length ?? 0;
    const rejected = counts?.rejected?.length ?? 0;
    return `
      <div class="admin-review-tabs supplier-bilingual" role="tablist">
        <button type="button" class="admin-review-tab ${activeView === 'traffic' ? 'active' : ''}" data-view="traffic">
          Traffic Analytics / 访问统计
        </button>
        <button type="button" class="admin-review-tab ${activeView === 'pending' ? 'active' : ''}" data-view="pending">
          Pending Review / 待审核 ${pending ? `<span class="admin-review-tab__count">${pending}</span>` : ''}
        </button>
        <button type="button" class="admin-review-tab ${activeView === 'approved' ? 'active' : ''}" data-view="approved">
          Live Inventory / 已上架 (${live})
        </button>
        <button type="button" class="admin-review-tab ${activeView === 'rejected' ? 'active' : ''}" data-view="rejected">
          Rejected / 已拒绝 (${rejected})
        </button>
      </div>`;
  }

  let hubApi = null;
  let activeView = 'traffic';
  let sessionUser = null;

  async function renderTrafficPane(pane) {
    pane.innerHTML = '<p class="admin-review-empty">Loading analytics…</p>';
    const res = await fetch('/api/analytics/summary?days=14', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load analytics');
    const data = await res.json();
    const days = Array.isArray(data.days) ? data.days : [];
    const latest = days[0];

    pane.innerHTML = `
      <table class="admin-analytics-table">
        <thead>
          <tr><th>Date</th><th>Page views</th><th>Unique IPs</th><th>WhatsApp clicks</th></tr>
        </thead>
        <tbody>
          ${days.length ? days.map((day) => `
            <tr>
              <td>${escapeHtml(day.day)}</td>
              <td>${day.pageviews || 0}</td>
              <td>${day.uniqueIpCount || 0}</td>
              <td>${day.whatsappClicks || 0}</td>
            </tr>`).join('') : '<tr><td colspan="4">No traffic recorded yet.</td></tr>'}
        </tbody>
      </table>
      ${renderDayDetail(latest)}
      <p class="admin-analytics-note">Timezone: ${escapeHtml(data.timeZone || '—')} · Bots excluded. Daily summary also sent via Telegram when scheduled.</p>`;
  }

  async function renderReviewPane(pane, tab) {
    pane.innerHTML = '<p class="admin-review-empty">Loading inventory…</p>';
    const hub = Hub();
    if (!hub) throw new Error('Review module failed to load');
    hubApi = await hub.mount(pane, {
      activeTab: tab,
      embedded: true,
      feedbackId: FEEDBACK_ID,
      feedbackRoot: document.getElementById('admin-analytics-root'),
      onTabChange: (next) => {
        activeView = next;
        setView(next);
        renderShell();
      },
      onAuthRequired: () => renderLogin(document.getElementById('admin-analytics-root')),
      onCountsChange: () => renderShell(),
    });
  }

  async function renderPane() {
    const pane = document.getElementById('admin-analytics-pane');
    if (!pane) return;
    try {
      if (activeView === 'traffic') {
        hubApi = null;
        await renderTrafficPane(pane);
      } else {
        await renderReviewPane(pane, activeView);
      }
    } catch (err) {
      pane.innerHTML = `<p class="admin-review-empty">${escapeHtml(err.message || 'Failed to load')}</p>`;
    }
  }

  function bindTabs(root) {
    root.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.view;
        if (!next || next === activeView) return;
        activeView = next;
        setView(next);
        renderShell();
      });
    });
  }

  async function renderShell() {
    const root = document.getElementById('admin-analytics-root');
    if (!root) return;

    let counts = { pending: [], inventory: [], rejected: [] };
    if (window.HalfCutInventoryStore) {
      try {
        await window.HalfCutInventoryStore.whenReady();
        counts = {
          pending: window.HalfCutInventoryStore.getSubmissionsByStatus('pending'),
          inventory: window.HalfCutInventoryStore.getApprovedInventory(),
          rejected: window.HalfCutInventoryStore.getSubmissionsByStatus('rejected'),
        };
      } catch {
        // counts stay empty until store loads in review pane
      }
    }

    const existingBar = root.querySelector(`#${FEEDBACK_ID}`);
    root.innerHTML = `
      <div class="admin-leads-toolbar supplier-bilingual">
        <div>
          <h2>Admin Dashboard · 管理后台</h2>
          <p>
            Traffic analytics and half-cut inventory review in one place.
            ${sessionUser?.username ? `<span class="admin-review-meta">Signed in as <strong>${escapeHtml(sessionUser.username)}</strong></span>` : ''}
          </p>
          <p class="admin-review-counts">
            <strong>${counts.pending.length}</strong> pending ·
            <strong>${counts.inventory.length}</strong> live ·
            <strong>${counts.rejected.length}</strong> rejected
          </p>
        </div>
        <div class="admin-leads-toolbar__links">
          ${adminNav()}
          <button type="button" class="btn btn-outline-navy btn-sm" id="admin-analytics-refresh">Refresh</button>
        </div>
      </div>
      ${renderTabs(activeView, counts)}
      <div id="admin-analytics-pane" class="admin-review-panel"></div>`;

    if (existingBar) root.prepend(existingBar);
    else Admin().ensureFeedbackBar(root, FEEDBACK_ID);

    bindTabs(root);
    document.getElementById('admin-analytics-refresh')?.addEventListener('click', async () => {
      window.HalfCutInventoryStore?.resetReady?.();
      await renderShell();
    });

    await renderPane();
  }

  async function boot() {
    const root = document.getElementById('admin-analytics-root');
    const admin = Admin();
    if (!root || !admin) return;

    activeView = parseView();
    sessionUser = await admin.ensureAdminSession();
    if (!sessionUser) {
      renderLogin(root);
      return;
    }

    if (!window.__adminAnalyticsPopstate__) {
      window.__adminAnalyticsPopstate__ = true;
      window.addEventListener('popstate', () => {
        const next = parseView();
        if (next !== activeView) {
          activeView = next;
          renderShell();
        }
      });
    }

    await renderShell();
  }

  function initAdminAnalytics() {
    const root = document.getElementById('admin-analytics-root');
    if (!root) return;
    if (!Admin()) {
      root.innerHTML = '<p class="admin-review-empty">Admin scripts failed to load. Hard-refresh the page.</p>';
      return;
    }
    Admin().ensureAdminSession().then((user) => {
      if (user) boot();
      else renderLogin(root);
    });
  }

  document.addEventListener('DOMContentLoaded', initAdminAnalytics);
})();

/**
 * AsiaPower — Admin traffic analytics
 */
(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function ensureAdminSession() {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.role === 'admin' ? data : null;
  }

  function renderLogin(root) {
    root.innerHTML = `
      <div class="admin-review-login">
        <h2>Admin Login</h2>
        <p class="admin-review-login__hint">Traffic analytics requires administrator authentication.</p>
        <form id="admin-login-form" class="admin-review-login__form">
          <label>Username<input type="text" name="username" required autocomplete="username"></label>
          <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
          <button type="submit" class="btn btn-accent">Sign In</button>
        </form>
        <div id="admin-login-feedback" class="supplier-upload-feedback" role="status"></div>
      </div>`;

    document.getElementById('admin-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const feedback = document.getElementById('admin-login-feedback');
      feedback.textContent = 'Signing in…';
      const body = Object.fromEntries(new FormData(event.target));
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        feedback.textContent = 'Login failed.';
        feedback.className = 'supplier-upload-feedback supplier-upload-feedback--error';
        return;
      }
      boot();
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

  async function boot() {
    const root = document.getElementById('admin-analytics-root');
    if (!root) return;
    root.innerHTML = '<p class="admin-review-empty">Loading analytics…</p>';

    try {
      const res = await fetch('/api/analytics/summary?days=14', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load analytics');
      const data = await res.json();
      const days = Array.isArray(data.days) ? data.days : [];
      const latest = days[0];

      root.innerHTML = `
        <div class="admin-leads-toolbar">
          <div>
            <h2>Traffic Analytics</h2>
            <p>Timezone: ${escapeHtml(data.timeZone || '—')} · Daily page views and IP stats (bots filtered)</p>
          </div>
          <div class="admin-leads-toolbar__links">
            <a href="leads.html" class="btn btn-outline-navy btn-sm">Lead Inbox</a>
            <a href="half-cut-review.html" class="btn btn-outline-navy btn-sm">Half-Cut Review</a>
            <a href="analytics.html" class="btn btn-outline-navy btn-sm">Analytics</a>
            <button type="button" class="btn btn-outline-navy btn-sm" id="admin-analytics-refresh">Refresh</button>
          </div>
        </div>
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
        <p class="admin-analytics-note">A daily summary is also sent via Telegram when <code>telegram-daily-report.js</code> is scheduled on the server.</p>`;

      document.getElementById('admin-analytics-refresh')?.addEventListener('click', boot);
    } catch (err) {
      root.innerHTML = `<p class="admin-review-empty">${escapeHtml(err.message || 'Failed to load analytics')}</p>`;
    }
  }

  function initAdminAnalytics() {
    const root = document.getElementById('admin-analytics-root');
    if (!root) return;
    ensureAdminSession().then((user) => {
      if (user) boot();
      else renderLogin(root);
    });
  }

  document.addEventListener('DOMContentLoaded', initAdminAnalytics);
})();

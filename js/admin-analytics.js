/**
 * AsiaPower — Admin traffic analytics only (inventory review lives on inventory.html)
 * Admin IA reorg v1: 访问统计与库存审核拆开
 */
(function () {
  'use strict';

  const Admin = () => window.AdminCommon;

  const FEEDBACK_ID = 'admin-analytics-feedback';
  const REVIEW_TABS = new Set(['pending', 'approved', 'rejected']);
  const GHANA_TZ = 'Africa/Accra';

  function formatGhanaTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: GHANA_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const pick = (type) => parts.find((p) => p.type === type)?.value || '';
      return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
    } catch {
      return '—';
    }
  }

  function formatLocation(entry) {
    const lines = [
      [entry.city, entry.region].filter(Boolean).join(', '),
      entry.country || '',
    ].filter(Boolean);
    if (!lines.length) return '—';
    return lines.map((line) => escapeHtml(line)).join('<br>');
  }

  function escapeHtml(str) {
    return Admin()?.escapeHtml?.(str) ?? String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Old ?view=pending|approved|rejected → inventory hub */
  function redirectLegacyReviewViews() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const legacyTab = params.get('tab');
    const review = REVIEW_TABS.has(view) ? view : (REVIEW_TABS.has(legacyTab) ? legacyTab : null);
    if (!review) return false;
    window.location.replace(`inventory.html?tab=${review}`);
    return true;
  }

  function renderLogin(root) {
    root.innerHTML = `
      <div class="admin-review-login">
        <h2>管理员登录</h2>
        <p class="admin-review-login__hint">访问统计需要管理员身份。</p>
        ${Admin().googleLoginBlockHtml?.() || ''}
        <form id="admin-login-form" class="admin-review-login__form">
          <label>用户名<input type="text" name="username" required autocomplete="username"></label>
          <label>密码<input type="password" name="password" required autocomplete="current-password"></label>
          <button type="submit" class="btn btn-accent">登录</button>
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
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
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

  function renderDayDetail(day) {
    if (!day) return '<p class="admin-review-empty">当日暂无数据。</p>';

    const topPaths = (day.topPaths || []).map(([page, count]) =>
      `<tr><td>${escapeHtml(page)}</td><td>${count}</td></tr>`
    ).join('') || '<tr><td colspan="2">—</td></tr>';

    const topCountries = (day.topCountries || []).map(([country, count]) =>
      `<tr><td>${escapeHtml(country)}</td><td>${count}</td></tr>`
    ).join('') || '<tr><td colspan="2">—</td></tr>';

    const ips = (day.ips || []).slice(0, 100).map((entry) => {
      const internalTag = entry.internal
        ? ' <span class="admin-analytics-ip-tag">内测</span>'
        : '';
      return `<tr>
        <td class="col-ip"><code>${escapeHtml(entry.ip)}</code>${internalTag}</td>
        <td class="col-hits">${entry.hits}</td>
        <td class="col-location">${formatLocation(entry)}</td>
        <td class="col-time" title="Africa/Accra (GMT)">${formatGhanaTime(entry.firstSeen)}</td>
        <td class="col-time" title="Africa/Accra (GMT)">${formatGhanaTime(entry.lastSeen)}</td>
        <td class="col-path">${escapeHtml(entry.lastPath || '—')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">—</td></tr>';

    return `
      <section class="admin-analytics-detail">
        <h3>${escapeHtml(day.day)} <span class="admin-analytics-detail__tz">（加纳时间 GMT）</span></h3>
        <div class="admin-analytics-metrics">
          <div class="admin-analytics-metric"><span>浏览量</span><strong>${day.pageviews || 0}</strong></div>
          <div class="admin-analytics-metric"><span>独立 IP</span><strong>${day.uniqueIpCount || 0}</strong></div>
          <div class="admin-analytics-metric"><span>WhatsApp</span><strong>${day.whatsappClicks || 0}</strong></div>
        </div>
        <div class="admin-analytics-grid">
          <div>
            <h4>热门页面</h4>
            <table class="admin-analytics-table"><thead><tr><th>页面</th><th>浏览</th></tr></thead><tbody>${topPaths}</tbody></table>
          </div>
          <div>
            <h4>热门国家</h4>
            <table class="admin-analytics-table"><thead><tr><th>国家</th><th>次数</th></tr></thead><tbody>${topCountries}</tbody></table>
          </div>
        </div>
        <h4>IP 明细</h4>
        <div class="admin-analytics-table-wrap">
          <table class="admin-analytics-table admin-analytics-table--ips">
            <colgroup>
              <col class="col-ip">
              <col class="col-hits">
              <col class="col-location">
              <col class="col-time">
              <col class="col-time">
              <col class="col-path">
            </colgroup>
            <thead><tr>
              <th>IP</th>
              <th>次数</th>
              <th>地区</th>
              <th>首次</th>
              <th>最近</th>
              <th>最后页面</th>
            </tr></thead>
            <tbody>${ips}</tbody>
          </table>
        </div>
      </section>`;
  }

  let trafficViewMode = 'external';
  let sessionUser = null;

  async function renderTrafficPane(pane) {
    pane.innerHTML = '<p class="admin-review-empty">加载访问统计…</p>';
    const res = await fetch(`/api/analytics/summary?days=15&view=${encodeURIComponent(trafficViewMode)}`, { credentials: 'include' });
    if (!res.ok) throw new Error('加载访问统计失败');
    const data = await res.json();
    const days = Array.isArray(data.days) ? data.days : [];
    const latest = days[0];
    const totals = data.totals || {};
    const viewHint = trafficViewMode === 'external'
      ? '近 15 天外网真实流量（已剔除内测 IP）'
      : '近 15 天全部流量（含内测）';

    pane.innerHTML = `
      <div class="admin-analytics-view-toggle" role="group" aria-label="流量范围">
        <button type="button" class="btn btn-sm ${trafficViewMode === 'external' ? 'btn-accent' : 'btn-outline-navy'}" data-traffic-view="external">外网</button>
        <button type="button" class="btn btn-sm ${trafficViewMode === 'all' ? 'btn-accent' : 'btn-outline-navy'}" data-traffic-view="all">全部</button>
        <span class="admin-analytics-view-toggle__hint">${escapeHtml(viewHint)}</span>
      </div>
      <div class="admin-analytics-metrics admin-analytics-metrics--rollup">
        <div class="admin-analytics-metric"><span>浏览量</span><strong>${totals.pageviews || 0}</strong></div>
        <div class="admin-analytics-metric"><span>独立 IP</span><strong>${totals.uniqueIpCount || 0}</strong></div>
        <div class="admin-analytics-metric"><span>WhatsApp</span><strong>${totals.whatsappClicks || 0}</strong></div>
        ${trafficViewMode === 'external' && totals.internalHitsExcluded
          ? `<div class="admin-analytics-metric"><span>已剔除内测</span><strong>${totals.internalHitsExcluded}</strong></div>`
          : ''}
      </div>
      <table class="admin-analytics-table">
        <thead>
          <tr><th>日期</th><th>浏览</th><th>独立 IP</th><th>WhatsApp</th></tr>
        </thead>
        <tbody>
          ${days.length ? days.map((day) => `
            <tr>
              <td>${escapeHtml(day.day)}</td>
              <td>${day.pageviews || 0}</td>
              <td>${day.uniqueIpCount || 0}</td>
              <td>${day.whatsappClicks || 0}</td>
            </tr>`).join('') : '<tr><td colspan="4">暂无访问记录。</td></tr>'}
        </tbody>
      </table>
      ${renderDayDetail(latest)}
      <p class="admin-analytics-note">时间均为加纳时间（Africa/Accra, GMT）。日桶时区 ${escapeHtml(data.timeZone || GHANA_TZ)}。机器人已排除。磁盘原始 JSON 不改写——过滤仅用于展示。</p>`;

    pane.querySelectorAll('[data-traffic-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.trafficView;
        if (!next || next === trafficViewMode) return;
        trafficViewMode = next;
        renderTrafficPane(pane).catch((err) => {
          pane.innerHTML = `<p class="admin-review-empty">${escapeHtml(err.message || '加载失败')}</p>`;
        });
      });
    });
  }

  async function renderShell() {
    const root = document.getElementById('admin-analytics-root');
    if (!root) return;

    const existingBar = root.querySelector(`#${FEEDBACK_ID}`);
    const who = sessionUser?.email || sessionUser?.username || '';
    root.innerHTML = `
      <div class="admin-leads-toolbar" data-admin-ia="analytics-only-v1">
        <div>
          <h2>访问统计</h2>
          <p>只看流量，不审核库存。库存审核请用顶栏「库存」。</p>
          ${who ? `<p class="admin-review-meta">已登录 <strong>${escapeHtml(who)}</strong></p>` : ''}
        </div>
        <div class="admin-leads-toolbar__links">
          <button type="button" class="btn btn-outline-navy btn-sm" id="admin-analytics-refresh">刷新</button>
        </div>
      </div>
      <div id="admin-analytics-pane" class="admin-review-panel"></div>`;

    if (existingBar) root.prepend(existingBar);
    else Admin().ensureFeedbackBar(root, FEEDBACK_ID);

    document.getElementById('admin-analytics-refresh')?.addEventListener('click', async () => {
      await renderShell();
    });

    const pane = document.getElementById('admin-analytics-pane');
    try {
      await renderTrafficPane(pane);
    } catch (err) {
      pane.innerHTML = `<p class="admin-review-empty">${escapeHtml(err.message || '加载失败')}</p>`;
    }
  }

  async function boot() {
    const root = document.getElementById('admin-analytics-root');
    const admin = Admin();
    if (!root || !admin) return;

    sessionUser = await admin.ensureAdminSession();
    if (!sessionUser) {
      renderLogin(root);
      return;
    }

    await renderShell();
  }

  function initAdminAnalytics() {
    if (redirectLegacyReviewViews()) return;
    const root = document.getElementById('admin-analytics-root');
    if (!root) return;
    if (!Admin()) {
      root.innerHTML = '<p class="admin-review-empty">管理脚本加载失败，请强制刷新页面。</p>';
      return;
    }
    Admin().ensureAdminSession().then((user) => {
      if (user) boot();
      else renderLogin(root);
    });
  }

  document.addEventListener('DOMContentLoaded', initAdminAnalytics);
})();

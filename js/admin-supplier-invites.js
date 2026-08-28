/** AsiaPower admin — supplier admission codes and referral attribution. */
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;',
    }[char]));
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, { credentials: 'include', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  function render(root) {
    root.innerHTML = `
      <details class="admin-supplier-invites">
        <summary><span>供应商准入</span><strong>创建手机号绑定邀请码</strong></summary>
        <div class="admin-supplier-invites__body">
          <p>平台直接邀请供应商时，可签发与手机号绑定的一次性准入码；供应商之间推荐则使用各自的长期推荐码。准入码仅在创建时显示一次。</p>
          <form id="supplier-invite-form">
            <label><span>国家区号</span><select name="countryCode"><option value="+86">+86 CN</option><option value="+81">+81 JP</option><option value="+82">+82 KR</option><option value="+1">+1</option></select></label>
            <label><span>供应商手机号</span><input name="phone" inputmode="tel" required></label>
            <label><span>有效小时</span><input name="expiresInHours" type="number" min="1" max="720" value="168" required></label>
            <button class="btn btn--primary" type="submit">创建邀请码</button>
          </form>
          <div class="admin-supplier-invites__result" id="supplier-invite-result" hidden></div>
          <div class="admin-supplier-invites__history" id="supplier-invite-history"></div>
        </div>
      </details>
      <section class="admin-supplier-referrals" aria-labelledby="supplier-referrals-title">
        <header>
          <div><span>推荐归因</span><h2 id="supplier-referrals-title">新供应商是谁邀请的</h2><p>仅记录推荐功能启用后完成注册的供应商；历史注册不会推测或回填推荐关系。</p></div>
          <button class="btn" type="button" id="supplier-referrals-refresh">刷新</button>
        </header>
        <div class="admin-supplier-referrals__loading" id="supplier-referrals-loading">正在读取推荐关系…</div>
        <div id="supplier-referrals-content" hidden>
          <div class="admin-supplier-referrals__metrics">
            <div><span>已分配推荐码</span><strong id="referral-code-count">0</strong></div>
            <div><span>新注册归因</span><strong id="referral-event-count">0</strong></div>
            <div><span>供应商推荐</span><strong id="referral-supplier-count">0</strong></div>
          </div>
          <div class="admin-supplier-referrals__table-wrap">
            <table class="admin-supplier-referrals__table">
              <thead><tr><th>新供应商</th><th>推荐人</th><th>来源</th><th>注册时间</th></tr></thead>
              <tbody id="supplier-referral-events"></tbody>
            </table>
            <div class="admin-supplier-referrals__empty" id="supplier-referrals-empty" hidden>暂无新归因记录。新的供应商完成注册后会显示在这里。</div>
          </div>
          <details class="admin-supplier-referrals__directory">
            <summary>查看全部账户推荐码 <b id="supplier-referral-directory-count">0</b></summary>
            <div id="supplier-referral-directory"></div>
          </details>
        </div>
        <div class="admin-supplier-referrals__error" id="supplier-referrals-error" hidden role="alert"></div>
      </section>`;
  }

  function renderHistory(rows) {
    const container = document.getElementById('supplier-invite-history');
    if (!container) return;
    container.innerHTML = rows.length ? `<h3>最近邀请码</h3>${rows.slice(0, 12).map((row) => `<div><code>${escapeHtml(row.codeHint || '—')}</code><span>${escapeHtml(row.phoneNormalized)}</span><span>${row.usedAt ? '已使用' : (Date.parse(row.expiresAt) <= Date.now() ? '已过期' : '可使用')}</span><time>${escapeHtml((row.createdAt || '').slice(0, 16).replace('T', ' '))}</time></div>`).join('')}` : '';
  }

  async function loadHistory() {
    const data = await fetchJson('/api/admin/supplier-invites');
    renderHistory(data.invites || []);
  }

  function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function referralSourceLabel(source) {
    if (source === 'supplier-referral') return '供应商推荐码';
    if (source === 'phone-bound-invite') return 'AsiaPower 准入码';
    return source || '其他';
  }

  function renderReferrals(data) {
    const codes = Array.isArray(data.codes) ? data.codes : [];
    const events = Array.isArray(data.events) ? data.events : [];
    const supplierEvents = events.filter((event) => event.source === 'supplier-referral');
    document.getElementById('referral-code-count').textContent = codes.length.toLocaleString('zh-CN');
    document.getElementById('referral-event-count').textContent = events.length.toLocaleString('zh-CN');
    document.getElementById('referral-supplier-count').textContent = supplierEvents.length.toLocaleString('zh-CN');
    document.getElementById('supplier-referral-directory-count').textContent = codes.length.toLocaleString('zh-CN');

    const rows = document.getElementById('supplier-referral-events');
    const empty = document.getElementById('supplier-referrals-empty');
    rows.innerHTML = events.map((event) => `<tr>
      <td><strong>${escapeHtml(event.inviteeName || event.inviteeSupplierId || '未命名供应商')}</strong><small>${escapeHtml(event.inviteePhone || '')}</small></td>
      <td><strong>${escapeHtml(event.inviterName || 'AsiaPower')}</strong><small>${escapeHtml(event.inviterUserId || '平台签发')}</small></td>
      <td><span class="admin-supplier-referrals__source">${escapeHtml(referralSourceLabel(event.source))}</span></td>
      <td><time datetime="${escapeHtml(event.registeredAt || '')}">${escapeHtml(formatTime(event.registeredAt))}</time></td>
    </tr>`).join('');
    empty.hidden = events.length > 0;

    document.getElementById('supplier-referral-directory').innerHTML = codes.length
      ? codes.map((row) => `<div><code>${escapeHtml(row.code || '—')}</code><span><strong>${escapeHtml(row.ownerName || row.ownerUserId || '未命名账户')}</strong><small>${escapeHtml([row.ownerRole, row.ownerPhone].filter(Boolean).join(' · '))}</small></span><b>${Number(row.useCount || 0).toLocaleString('zh-CN')} 次</b><time>${escapeHtml(formatTime(row.lastUsedAt))}</time></div>`).join('')
      : '<p>暂无推荐码。</p>';

    document.getElementById('supplier-referrals-loading').hidden = true;
    document.getElementById('supplier-referrals-error').hidden = true;
    document.getElementById('supplier-referrals-content').hidden = false;
  }

  async function loadReferrals() {
    const loading = document.getElementById('supplier-referrals-loading');
    const content = document.getElementById('supplier-referrals-content');
    const errorBox = document.getElementById('supplier-referrals-error');
    loading.hidden = false;
    content.hidden = true;
    errorBox.hidden = true;
    try {
      renderReferrals(await fetchJson('/api/admin/supplier-referrals'));
    } catch (error) {
      loading.hidden = true;
      errorBox.hidden = false;
      errorBox.textContent = `推荐关系读取失败：${error.message}`;
    }
  }

  async function init() {
    const root = document.getElementById('admin-supplier-invite-root');
    if (!root || !window.AdminCommon) return;
    const admin = await window.AdminCommon.ensureAdminSession();
    if (!admin) return;
    render(root);
    await Promise.all([loadHistory(), loadReferrals()]);
    document.getElementById('supplier-referrals-refresh').addEventListener('click', loadReferrals);
    document.getElementById('supplier-invite-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.target.querySelector('button[type="submit"]');
      const body = Object.fromEntries(new FormData(event.target));
      button.disabled = true;
      try {
        const data = await fetchJson('/api/admin/supplier-invites', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const result = document.getElementById('supplier-invite-result');
        result.hidden = false;
        result.innerHTML = `<strong>邀请码已创建（仅显示本次）</strong><code>${escapeHtml(data.invite.code)}</code><span>绑定手机号：${escapeHtml(data.invite.phoneNormalized)} · 到期：${escapeHtml(data.invite.expiresAt)}</span>`;
        await loadHistory();
      } catch (error) {
        window.AdminCommon.showFeedback(window.AdminCommon.ensureFeedbackBar(root, 'admin-supplier-invite-feedback'), error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => init().catch(() => {}));
}());

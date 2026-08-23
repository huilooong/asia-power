/** AsiaPower admin — phone-bound supplier invitations. */
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
          <p>短信 OTP 上线前，新供应商必须使用管理员签发、与手机号绑定的一次性邀请码。邀请码仅在创建时显示一次。</p>
          <form id="supplier-invite-form">
            <label><span>国家区号</span><select name="countryCode"><option value="+86">+86 CN</option><option value="+81">+81 JP</option><option value="+82">+82 KR</option><option value="+1">+1</option></select></label>
            <label><span>供应商手机号</span><input name="phone" inputmode="tel" required></label>
            <label><span>有效小时</span><input name="expiresInHours" type="number" min="1" max="720" value="168" required></label>
            <button class="btn btn--primary" type="submit">创建邀请码</button>
          </form>
          <div class="admin-supplier-invites__result" id="supplier-invite-result" hidden></div>
          <div class="admin-supplier-invites__history" id="supplier-invite-history"></div>
        </div>
      </details>`;
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

  async function init() {
    const root = document.getElementById('admin-supplier-invite-root');
    if (!root || !window.AdminCommon) return;
    const admin = await window.AdminCommon.ensureAdminSession();
    if (!admin) return;
    render(root);
    await loadHistory();
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

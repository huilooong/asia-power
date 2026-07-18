/**
 * AsiaPower — Admin email viewer (sales@ / weylon@ send + receive)
 */
(function () {
  'use strict';

  const MAILBOX_LABELS = {
    sales: 'Sales',
    weylon: 'CEO (weylon)',
    supplier: 'Supplier',
    inquiry: 'Inquiry (legacy)',
  };

  function parseInitialFilter() {
    const fromUrl = new URLSearchParams(window.location.search).get('mailbox');
    return fromUrl || 'all';
  }

  let activeFilter = parseInitialFilter();

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  function mailboxLabel(mailbox) {
    return MAILBOX_LABELS[mailbox] || mailbox || 'Unknown';
  }

  function multilineHtml(value) {
    const text = String(value ?? '').trim();
    if (!text) return '<p class="admin-lead-card__empty">(no text body)</p>';
    return `<p class="admin-lead-card__text">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  }

  async function ensureAdminSession() {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user?.role === 'admin' ? data.user : null;
  }

  function renderLogin(root) {
    const googleBlock = window.AdminCommon?.googleLoginBlockHtml?.() || `
      <p class="admin-review-login__hint">Use the password account, or open Inventory Hub and sign in with Google first.</p>`;
    root.innerHTML = `
      <div class="admin-review-login">
        <h2>Admin Login</h2>
        <p class="admin-review-login__hint">Email viewer requires administrator authentication.</p>
        ${googleBlock}
        <form id="admin-login-form" class="admin-review-login__form">
          <label>Username<input type="text" name="username" required autocomplete="username"></label>
          <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
          <button type="submit" class="btn btn-accent">Sign In</button>
        </form>
        <div id="admin-login-feedback" class="supplier-upload-feedback" role="status"></div>
      </div>`;

    const form = document.getElementById('admin-login-form');
    const feedback = document.getElementById('admin-login-feedback');
    window.AdminCommon?.bindGoogleAdminButton?.(root, feedback);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      feedback.textContent = 'Signing in…';
      const body = Object.fromEntries(new FormData(form));
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        feedback.textContent = 'Login failed.';
        feedback.className = 'admin-page-feedback admin-page-feedback--error';
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.role && data.role !== 'admin') {
        feedback.textContent = 'Admin access required.';
        feedback.className = 'admin-page-feedback admin-page-feedback--error';
        return;
      }
      boot();
    });
  }

  async function fetchThreads() {
    const res = await fetch('/api/email/threads', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load email threads');
    const data = await res.json();
    return Array.isArray(data.threads) ? data.threads : [];
  }

  function renderMessage(msg) {
    const isInbound = msg.direction === 'inbound';
    const dir = isInbound ? 'Received · 收到' : 'Sent · 已发出';
    const who = isInbound ? `From: ${escapeHtml(msg.from || '—')}` : `To: ${escapeHtml(msg.to || '—')}`;
    const when = formatDate(msg.receivedAt || msg.sentAt);
    return `
      <article class="admin-review-card admin-lead-card admin-email-message admin-email-message--${isInbound ? 'in' : 'out'}">
        <header class="admin-lead-card__head">
          <div>
            <h4>${dir}</h4>
            <p class="admin-lead-card__meta">${who} · ${escapeHtml(when)}</p>
          </div>
        </header>
        ${msg.subject ? `<p class="admin-lead-card__meta"><strong>Subject:</strong> ${escapeHtml(msg.subject)}</p>` : ''}
        ${multilineHtml(msg.text)}
        ${msg.attachments?.length ? `<p class="admin-lead-card__meta">Attachments: ${msg.attachments.map((a) => escapeHtml(a.filename || a.name || 'file')).join(', ')}</p>` : ''}
      </article>`;
  }

  function renderThreadCard(thread) {
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound');
    return `
      <article class="admin-review-card admin-lead-card" data-thread-id="${escapeHtml(thread.threadId)}">
        <header class="admin-lead-card__head">
          <div>
            <h3>${escapeHtml(thread.subject || '(no subject)')}</h3>
            <p class="admin-lead-card__meta">
              ${escapeHtml(formatDate(thread.updatedAt))}
              · ${escapeHtml(mailboxLabel(thread.mailbox))}
              · ${escapeHtml(thread.threadId)}
            </p>
          </div>
          <span class="admin-lead-card__status${thread.status === 'open' ? '' : ' admin-lead-card__status--replied'}">${escapeHtml(thread.status || 'open')}</span>
        </header>

        <dl class="admin-review-specs admin-lead-card__specs">
          <div><dt>Mailbox</dt><dd>${escapeHtml(thread.mailbox || '—')}@asia-power.com</dd></div>
          <div><dt>Customer</dt><dd>${escapeHtml(thread.customerDisplay || lastInbound?.from || '—')}</dd></div>
          <div><dt>Messages</dt><dd>${messages.length}</dd></div>
          <div><dt>Created</dt><dd>${escapeHtml(formatDate(thread.createdAt))}</dd></div>
        </dl>

        <section class="admin-lead-card__block admin-email-thread">
          <h4>Messages · 往来邮件（${messages.length}）</h4>
          ${messages.length ? messages.map(renderMessage).join('') : '<p class="admin-lead-card__empty">No messages recorded.</p>'}
        </section>
      </article>`;
  }

  function filterThreads(threads, filter, query) {
    const q = String(query || '').trim().toLowerCase();
    return threads.filter((thread) => {
      if (filter !== 'all' && thread.mailbox !== filter) return false;
      if (!q) return true;
      const haystack = [
        thread.subject,
        thread.threadId,
        thread.customerDisplay,
        thread.mailbox,
        ...(thread.messages || []).map((m) => `${m.from} ${m.to} ${m.subject} ${m.text}`),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  function renderFilterButton(id, label, count) {
    const active = activeFilter === id ? ' is-active' : '';
    return `<button type="button" class="admin-leads-filter${active}" data-filter="${id}">${escapeHtml(label)} (${count})</button>`;
  }

  async function boot() {
    const root = document.getElementById('admin-emails-root');
    if (!root) return;
    root.innerHTML = '<p class="admin-review-empty">Loading email threads…</p>';

    try {
      const threads = await fetchThreads();
      const searchInput = document.getElementById('admin-emails-search');
      const query = searchInput?.value || new URLSearchParams(window.location.search).get('q') || '';

      const salesCount = threads.filter((t) => t.mailbox === 'sales').length;
      const weylonCount = threads.filter((t) => t.mailbox === 'weylon').length;
      const otherCount = threads.length - salesCount - weylonCount;

      const filtered = filterThreads(threads, activeFilter, query)
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

      root.innerHTML = `
        <div id="admin-emails-feedback" class="admin-page-feedback" role="status" aria-live="polite" hidden></div>
        <div class="admin-leads-toolbar">
          <div>
            <h2>邮件收发详情</h2>
            <p>${threads.length} 个线程 · sales@ ${salesCount} · weylon@ ${weylonCount}${otherCount ? ` · 其他 ${otherCount}` : ''}</p>
          </div>
          <div class="admin-leads-toolbar__links">
            <button type="button" class="btn btn-outline-navy btn-sm" id="admin-emails-refresh">刷新</button>
          </div>
        </div>

        <div class="admin-leads-controls">
          <div class="admin-leads-filters" role="tablist" aria-label="Mailbox filters">
            ${renderFilterButton('all', 'All', threads.length)}
            ${renderFilterButton('sales', 'sales@', salesCount)}
            ${renderFilterButton('weylon', 'weylon@', weylonCount)}
          </div>
          <label class="admin-leads-search">
            <input type="search" id="admin-emails-search" placeholder="Search subject, sender, body…" aria-label="Search emails" value="${escapeHtml(query)}">
          </label>
        </div>

        <div class="admin-leads-grid">
          ${filtered.length
            ? filtered.map(renderThreadCard).join('')
            : `<p class="admin-review-empty">No email threads match this filter${query ? ' or search' : ''}.</p>`}
        </div>`;

      document.getElementById('admin-emails-refresh')?.addEventListener('click', boot);

      root.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeFilter = btn.dataset.filter || 'all';
          boot();
        });
      });

      const search = document.getElementById('admin-emails-search');
      let searchTimer = null;
      search?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(boot, 180);
      });
    } catch (err) {
      root.innerHTML = `<p class="admin-review-empty">${escapeHtml(err.message || 'Failed to load email threads')}</p>`;
    }
  }

  function initAdminEmails() {
    const root = document.getElementById('admin-emails-root');
    if (!root) return;
    ensureAdminSession().then((user) => {
      if (user) boot();
      else renderLogin(root);
    });
  }

  document.addEventListener('DOMContentLoaded', initAdminEmails);
})();

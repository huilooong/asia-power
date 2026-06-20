/**
 * AsiaPower — Admin lead inbox
 */
(function () {
  'use strict';

  const INTENT_LABELS = {
    price: 'Request Price',
    photos: 'Request Photos',
    similar: 'Request Similar Unit',
    whatsapp: 'WhatsApp Enquiry',
    availability: 'Check Availability',
  };

  const ENQUIRY_LABELS = {
    engine: 'Engine Quote',
    gearbox: 'Gearbox Quote',
    powertrain: 'Engine + Gearbox Set',
    bulk: 'Bulk / Container Order',
    partnership: 'B2B Partnership',
    other: 'Other',
  };

  let activeFilter = 'open';

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

  function intentLabel(intent) {
    return INTENT_LABELS[intent] || intent || 'Enquiry';
  }

  function enquiryLabel(type) {
    return ENQUIRY_LABELS[type] || type || 'Quote';
  }

  function displayValue(value) {
    const text = String(value ?? '').trim();
    return text || '—';
  }

  function multilineHtml(value) {
    const text = String(value ?? '').trim();
    if (!text || text === '-') return '<p class="admin-lead-card__empty">—</p>';
    return `<p class="admin-lead-card__text">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  }

  function phoneDigits(phone) {
    return String(phone || '').replace(/[^\d+]/g, '');
  }

  function whatsappUrl(phone, lead) {
    const digits = phoneDigits(phone);
    if (!digits) return '';
    const text = lead ? buildSummaryText(lead) : '';
    return `https://wa.me/${digits.replace(/^\+/, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
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
        <p class="admin-review-login__hint">Lead inbox requires administrator authentication.</p>
        <form id="admin-login-form" class="admin-review-login__form">
          <label>Username<input type="text" name="username" required autocomplete="username"></label>
          <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
          <button type="submit" class="btn btn-accent">Sign In</button>
        </form>
        <div id="admin-login-feedback" class="supplier-upload-feedback" role="status"></div>
      </div>`;

    const form = document.getElementById('admin-login-form');
    const feedback = document.getElementById('admin-login-feedback');
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
        feedback.className = 'supplier-upload-feedback supplier-upload-feedback--error';
        return;
      }
      boot();
    });
  }

  function leadTitle(lead) {
    if (lead.source === 'half-cut') {
      return `${lead.stockId || 'Half-cut'} · ${intentLabel(lead.intent)}`;
    }
    return `${lead.name || 'Contact lead'} · ${enquiryLabel(lead.enquiryType)}`;
  }

  function statusBadge(lead) {
    if (lead.replyStatus === 'replied') return '<span class="admin-lead-card__status admin-lead-card__status--replied">Replied</span>';
    if (lead.replyChannel === 'email') {
      return '<span class="admin-lead-card__status admin-lead-card__status--email">Email reply</span>';
    }
    return '<span class="admin-lead-card__status">Open</span>';
  }

  function specRow(label, valueHtml) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd></div>`;
  }

  function linkValue(href, text, className = '') {
    if (!href || !text || text === '—') return escapeHtml(text || '—');
    const cls = className ? ` class="${className}"` : '';
    return `<a href="${escapeHtml(href)}"${cls} target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
  }

  function visitorLocationText(lead) {
    const city = String(lead.ipCity || '').trim();
    const region = String(lead.ipRegion || '').trim();
    const country = String(lead.ipCountry || '').trim();
    const parts = [];
    if (city) parts.push(city);
    if (region && region !== city) parts.push(region);
    if (country) parts.push(country);
    if (parts.length) return parts.join(', ');
    if (lead.clientIp) return 'Unknown location';
    return '—';
  }

  function renderVisitorLocationRows(lead) {
    const location = visitorLocationText(lead);
    const ip = displayValue(lead.clientIp);
    return `
        ${specRow('Visitor location', escapeHtml(location))}
        ${specRow('IP address', escapeHtml(ip))}`;
  }

  function renderContactSpecs(lead) {
    const phone = displayValue(lead.phone);
    const email = displayValue(lead.email);
    const wa = whatsappUrl(lead.phone);
    const replyVia = lead.replyChannel === 'email' ? 'Email' : 'WhatsApp';

    return `
      <dl class="admin-review-specs admin-lead-card__specs">
        ${specRow('Name', escapeHtml(displayValue(lead.name)))}
        ${specRow('Company', escapeHtml(displayValue(lead.company)))}
        ${specRow('Phone / WhatsApp', linkValue(wa, phone, 'admin-lead-card__link'))}
        ${specRow('Email', linkValue(email && email !== '—' ? `mailto:${email}` : '', email, 'admin-lead-card__link'))}
        ${specRow('Country (form)', escapeHtml(displayValue(lead.country)))}
        ${renderVisitorLocationRows(lead)}
        ${specRow('Enquiry type', escapeHtml(enquiryLabel(lead.enquiryType)))}
        ${specRow('Reply via', escapeHtml(replyVia))}
        ${specRow('Reference', `<code class="admin-lead-card__code">${escapeHtml(lead.id)}</code>`)}
      </dl>`;
  }

  function renderHalfCutSpecs(lead) {
    return `
      <dl class="admin-review-specs admin-lead-card__specs">
        ${specRow('Stock ID', escapeHtml(displayValue(lead.stockId)))}
        ${specRow('Intent', escapeHtml(intentLabel(lead.intent)))}
        ${specRow('Vehicle', escapeHtml(`${displayValue(lead.brand)} ${displayValue(lead.model)}`.trim()))}
        ${specRow('Engine', escapeHtml(displayValue(lead.engineCode)))}
        ${specRow('Transmission', escapeHtml(displayValue(lead.transmissionCode)))}
        ${specRow('Listing status', escapeHtml(displayValue(lead.listingStatus)))}
        ${specRow('Slug', escapeHtml(displayValue(lead.slug)))}
        ${renderVisitorLocationRows(lead)}
        ${specRow('Reference', `<code class="admin-lead-card__code">${escapeHtml(lead.id)}</code>`)}
      </dl>`;
  }

  function ipSummaryLine(lead) {
    if (!lead.clientIp) return '';
    const location = visitorLocationText(lead);
    if (location && location !== '—' && location !== 'Unknown location') {
      return `IP: ${lead.clientIp} (${location})`;
    }
    return `IP: ${lead.clientIp}`;
  }

  function buildSummaryText(lead) {
    if (lead.source === 'half-cut') {
      return [
        'Hello AsiaPower, following up on a half-cut enquiry.',
        '',
        `Reference: ${lead.id}`,
        `Stock: ${lead.stockId || '—'}`,
        `Vehicle: ${lead.brand || '—'} ${lead.model || ''}`.trim(),
        `Engine: ${lead.engineCode || '—'} / ${lead.transmissionCode || '—'}`,
        `Intent: ${intentLabel(lead.intent)}`,
        ipSummaryLine(lead),
        lead.page ? `Page: ${lead.page}` : '',
      ].filter(Boolean).join('\n');
    }

    return [
      'Hello AsiaPower, following up on my enquiry.',
      '',
      `Reference: ${lead.id}`,
      `Name: ${lead.name || '—'}`,
      lead.company ? `Company: ${lead.company}` : '',
      `Phone: ${lead.phone || '—'}`,
      lead.email ? `Email: ${lead.email}` : '',
      `Country: ${lead.country || '—'}`,
      `Type: ${enquiryLabel(lead.enquiryType)}`,
      ipSummaryLine(lead),
      '',
      `Vehicle / Part: ${String(lead.vehicleDetails || '').replace(/\s+/g, ' ').trim() || '—'}`,
      lead.message && lead.message !== '-' ? `Note: ${lead.message}` : '',
      lead.page ? `Page: ${lead.page}` : '',
    ].filter(Boolean).join('\n');
  }

  function renderLeadCard(lead) {
    const replied = lead.replyStatus === 'replied';
    const isHalfCut = lead.source === 'half-cut';
    const wa = !isHalfCut ? whatsappUrl(lead.phone, lead) : '';
    const email = !isHalfCut && lead.email ? `mailto:${lead.email}` : '';

    return `
      <article class="admin-review-card admin-lead-card${replied ? ' admin-lead-card--replied' : ''}" data-lead-id="${escapeHtml(lead.id)}">
        <header class="admin-lead-card__head">
          <div>
            <h3>${escapeHtml(leadTitle(lead))}</h3>
            <p class="admin-lead-card__meta">
              ${escapeHtml(formatDate(lead.createdAt))}
              · ${escapeHtml(isHalfCut ? 'Half-cut' : 'Contact form')}
              · ${escapeHtml(lead.id)}
            </p>
          </div>
          ${statusBadge(lead)}
        </header>

        ${isHalfCut ? renderHalfCutSpecs(lead) : renderContactSpecs(lead)}

        ${isHalfCut ? '' : `
          <section class="admin-lead-card__block">
            <h4>Vehicle / Part Details</h4>
            ${multilineHtml(lead.vehicleDetails)}
          </section>
          <section class="admin-lead-card__block">
            <h4>Additional Message</h4>
            ${multilineHtml(lead.message)}
          </section>`}

        ${lead.page ? `<p class="admin-lead-card__page"><span>Source page</span> ${escapeHtml(lead.page)}</p>` : ''}

        <div class="admin-lead-card__actions">
          ${replied ? '' : `<button type="button" class="btn btn-accent btn-sm" data-mark-replied="${escapeHtml(lead.id)}">Mark Replied</button>`}
          <button type="button" class="btn btn-outline-navy btn-sm" data-copy-summary="${escapeHtml(lead.id)}">Copy Summary</button>
          ${wa ? `<a href="${escapeHtml(wa)}" class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${email ? `<a href="${escapeHtml(email)}" class="btn btn-outline-navy btn-sm">Email</a>` : ''}
          ${lead.slug ? `<a href="../half-cuts/detail.html?slug=${encodeURIComponent(lead.slug)}" class="btn btn-outline-navy btn-sm" target="_blank" rel="noopener">View Listing</a>` : ''}
          <button type="button" class="btn btn-outline-navy btn-sm admin-lead-card__delete" data-delete-lead="${escapeHtml(lead.id)}">Delete</button>
        </div>
      </article>`;
  }

  function filterLeads(leads, filter, query) {
    const q = String(query || '').trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === 'open' && lead.replyStatus === 'replied') return false;
      if (filter === 'replied' && lead.replyStatus !== 'replied') return false;
      if (filter === 'contact' && lead.source !== 'contact-form') return false;
      if (filter === 'half-cut' && lead.source !== 'half-cut') return false;
      if (filter === 'email' && lead.replyChannel !== 'email') return false;

      if (!q) return true;
      const haystack = [
        lead.id,
        lead.name,
        lead.company,
        lead.phone,
        lead.email,
        lead.country,
        lead.enquiryType,
        lead.vehicleDetails,
        lead.message,
        lead.stockId,
        lead.brand,
        lead.model,
        lead.intent,
        lead.slug,
        lead.clientIp,
        lead.ipCity,
        lead.ipRegion,
        lead.ipCountry,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  async function fetchLeads() {
    const res = await fetch('/api/leads', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load leads');
    const data = await res.json();
    return Array.isArray(data.leads) ? data.leads : [];
  }

  async function deleteLead(id) {
    const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Delete failed');
  }

  async function markReplied(id) {
    const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ replyStatus: 'replied' }),
    });
    if (!res.ok) throw new Error('Update failed');
  }

  async function copySummary(lead) {
    const text = buildSummaryText(lead);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }

  function renderFilterButton(id, label, count) {
    const active = activeFilter === id ? ' is-active' : '';
    return `<button type="button" class="admin-leads-filter${active}" data-filter="${id}">${escapeHtml(label)} (${count})</button>`;
  }

  async function boot() {
    const root = document.getElementById('admin-leads-root');
    if (!root) return;
    root.innerHTML = '<p class="admin-review-empty">Loading leads…</p>';

    try {
      const leads = await fetchLeads();
      const searchInput = document.getElementById('admin-leads-search');
      const query = searchInput?.value || '';
      const filtered = filterLeads(leads, activeFilter, query);
      const openCount = leads.filter((lead) => lead.replyStatus !== 'replied').length;
      const repliedCount = leads.filter((lead) => lead.replyStatus === 'replied').length;
      const contactCount = leads.filter((lead) => lead.source === 'contact-form').length;
      const halfCutCount = leads.filter((lead) => lead.source === 'half-cut').length;
      const emailCount = leads.filter((lead) => lead.replyChannel === 'email').length;

      root.innerHTML = `
        <div class="admin-leads-toolbar">
          <div>
            <h2>Lead Inbox</h2>
            <p>${openCount} open · ${repliedCount} replied · ${leads.length} total</p>
          </div>
          <div class="admin-leads-toolbar__links">
            <a href="half-cut-review.html" class="btn btn-outline-navy btn-sm">Half-Cut Review</a>
            <a href="analytics.html" class="btn btn-outline-navy btn-sm">Analytics</a>
            <a href="leads.html" class="btn btn-outline-navy btn-sm">Lead Inbox</a>
            <button type="button" class="btn btn-outline-navy btn-sm" id="admin-leads-refresh">Refresh</button>
          </div>
        </div>

        <div class="admin-leads-controls">
          <div class="admin-leads-filters" role="tablist" aria-label="Lead filters">
            ${renderFilterButton('open', 'Open', openCount)}
            ${renderFilterButton('contact', 'Contact', contactCount)}
            ${renderFilterButton('half-cut', 'Half-cut', halfCutCount)}
            ${renderFilterButton('email', 'Email reply', emailCount)}
            ${renderFilterButton('replied', 'Replied', repliedCount)}
            ${renderFilterButton('all', 'All', leads.length)}
          </div>
          <label class="admin-leads-search">
            <input type="search" id="admin-leads-search" placeholder="Search name, phone, stock ID, vehicle…" aria-label="Search leads" value="${escapeHtml(query)}">
          </label>
        </div>

        <div class="admin-leads-grid">
          ${filtered.length
            ? filtered.map(renderLeadCard).join('')
            : `<p class="admin-review-empty">No leads match this filter${query ? ' or search' : ''}.</p>`}
        </div>
        <div id="admin-leads-feedback" class="supplier-upload-feedback" role="status" aria-live="polite"></div>`;

      const leadMap = new Map(leads.map((lead) => [lead.id, lead]));

      document.getElementById('admin-leads-refresh')?.addEventListener('click', boot);

      root.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeFilter = btn.dataset.filter || 'open';
          boot();
        });
      });

      const search = document.getElementById('admin-leads-search');
      let searchTimer = null;
      search?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(boot, 180);
      });

      root.addEventListener('click', async (event) => {
        const feedback = document.getElementById('admin-leads-feedback');
        const markBtn = event.target.closest('[data-mark-replied]');
        if (markBtn) {
          try {
            await markReplied(markBtn.dataset.markReplied);
            if (feedback) {
              feedback.textContent = 'Lead marked as replied.';
              feedback.className = 'supplier-upload-feedback supplier-upload-feedback--success';
            }
            boot();
          } catch (err) {
            if (feedback) {
              feedback.textContent = err.message || 'Update failed';
              feedback.className = 'supplier-upload-feedback supplier-upload-feedback--error';
            }
          }
          return;
        }

        const deleteBtn = event.target.closest('[data-delete-lead]');
        if (deleteBtn) {
          if (!window.confirm('Delete this lead permanently?')) return;
          try {
            await deleteLead(deleteBtn.dataset.deleteLead);
            if (feedback) {
              feedback.textContent = 'Lead deleted.';
              feedback.className = 'supplier-upload-feedback supplier-upload-feedback--success';
            }
            boot();
          } catch (err) {
            if (feedback) {
              feedback.textContent = err.message || 'Delete failed';
              feedback.className = 'supplier-upload-feedback supplier-upload-feedback--error';
            }
          }
          return;
        }

        const copyBtn = event.target.closest('[data-copy-summary]');
        if (!copyBtn) return;
        const lead = leadMap.get(copyBtn.dataset.copySummary);
        if (!lead) return;
        try {
          await copySummary(lead);
          if (feedback) {
            feedback.textContent = 'Summary copied to clipboard.';
            feedback.className = 'supplier-upload-feedback supplier-upload-feedback--success';
          }
        } catch (err) {
          if (feedback) {
            feedback.textContent = err.message || 'Copy failed';
            feedback.className = 'supplier-upload-feedback supplier-upload-feedback--error';
          }
        }
      });
    } catch (err) {
      root.innerHTML = `<p class="admin-review-empty">${escapeHtml(err.message || 'Failed to load leads')}</p>`;
    }
  }

  function initAdminLeads() {
    const root = document.getElementById('admin-leads-root');
    if (!root) return;
    ensureAdminSession().then((user) => {
      if (user) boot();
      else renderLogin(root);
    });
  }

  document.addEventListener('DOMContentLoaded', initAdminLeads);
})();

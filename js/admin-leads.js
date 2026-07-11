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
    'whatsapp-quote': 'WhatsApp Quote',
    quote: 'Quote Request',
    availability: 'Check Availability',
  };

  const ENQUIRY_LABELS = {
    'truck-head': 'Truck Head / Cab Quote',
    engine: 'Engine Quote',
    gearbox: 'Gearbox Quote',
    'truck-parts': 'Truck Parts Quote',
    'half-cut': 'Half-cut Quote',
    chassis: 'Chassis Parts Quote',
    powertrain: 'Engine + Gearbox Set',
    bulk: 'Bulk / Container Order',
    partnership: 'B2B Partnership',
    other: 'Other',
  };

  const WEBSITE_SOURCES = new Set(['contact-form', 'quote-form', 'whatsapp-intent']);

  function parseInitialFilter() {
    const fromUrl = new URLSearchParams(window.location.search).get('filter');
    const allowed = new Set(['open', 'replied', 'contact', 'whatsapp', 'half-cut', 'catalog', 'email', 'all']);
    return allowed.has(fromUrl) ? fromUrl : 'open';
  }

  function parseInitialSearch() {
    return new URLSearchParams(window.location.search).get('q') || '';
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

  function enrichLead(lead) {
    return window.AsiaLeadContext?.enrichLead?.(lead) || lead;
  }

  function pageDisplayUrl(pageUrl) {
    const value = String(pageUrl || '').trim();
    if (!value) return '';
    if (value.startsWith('http')) return value;
    return `https://asia-power.com${value.startsWith('/') ? value : `/${value}`}`;
  }

  function renderLeadContextBlock(lead) {
    const ctx = enrichLead(lead);
    const pageUrl = ctx.pageUrl || ctx.page;
    const pageHref = pageDisplayUrl(pageUrl);
    const referrer = displayValue(ctx.referrer);
    const utmParts = [ctx.utmSource, ctx.utmMedium, ctx.utmCampaign].filter(Boolean);
    const utmText = utmParts.length ? utmParts.join(' / ') : '—';

    return `
      <section class="admin-lead-card__context">
        <h4>询价上下文 · Inquiry Context</h4>
        <dl class="admin-review-specs admin-lead-card__specs">
          ${specRow('询价主题', `<strong>${escapeHtml(displayValue(ctx.inquirySubject))}</strong>`)}
          ${specRow('建议回复主题', `<code class="admin-lead-card__code">${escapeHtml(displayValue(ctx.replySubject))}</code>`)}
          ${specRow('来源页面', pageHref
            ? linkValue(pageHref, pageUrl, 'admin-lead-card__link')
            : escapeHtml(displayValue(pageUrl)))}
          ${specRow('品牌', escapeHtml(displayValue(ctx.brand)))}
          ${specRow('产品', escapeHtml(displayValue(ctx.productLabel || ctx.product || ctx.model)))}
          ${specRow('访问来源 Referrer', escapeHtml(referrer))}
          ${specRow('广告来源 UTM', escapeHtml(utmText))}
        </dl>
      </section>`;
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
    return data?.user?.role === 'admin' ? data.user : null;
  }

  function renderLogin(root) {
    const googleBlock = window.AdminCommon?.googleLoginBlockHtml?.() || `
      <p class="admin-review-login__hint">Use the password account, or open Inventory Hub and sign in with Google first.</p>`;
    root.innerHTML = `
      <div class="admin-review-login">
        <h2>Admin Login</h2>
        <p class="admin-review-login__hint">Lead inbox requires administrator authentication.</p>
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

  function isWebsiteLead(lead) {
    return WEBSITE_SOURCES.has(lead.source);
  }

  function leadTitle(lead) {
    const ctx = enrichLead(lead);
    if (lead.source === 'half-cut') {
      const contact = displayValue(lead.phone) !== '—'
        ? displayValue(lead.phone)
        : (displayValue(lead.email) !== '—' ? displayValue(lead.email) : 'No contact');
      return `${contact} · ${lead.stockId || 'Half-cut'} · ${intentLabel(lead.intent)}`;
    }
    if (lead.source === 'product-catalog') {
      const contact = displayValue(lead.phone) !== '—'
        ? displayValue(lead.phone)
        : (displayValue(lead.email) !== '—' ? displayValue(lead.email) : 'No contact');
      return `${contact} · ${lead.enquiryType || 'Product'} · ${lead.model || lead.brand || 'Catalog'}`;
    }
    if (lead.source === 'whatsapp-intent') {
      return `${lead.name || 'WhatsApp lead'} · ${ctx.inquirySubject || 'WhatsApp enquiry'}`;
    }
    return `${lead.name || 'Contact lead'} · ${ctx.inquirySubject || enquiryLabel(lead.enquiryType)}`;
  }

  function statusBadge(lead) {
    if (lead.replyStatus === 'replied') return '<span class="admin-lead-card__status admin-lead-card__status--replied">Replied</span>';
    if (lead.replyChannel === 'email') {
      return '<span class="admin-lead-card__status admin-lead-card__status--email">Email reply</span>';
    }
    if (lead.whatsappStatus === 'sent') {
      return '<span class="admin-lead-card__status admin-lead-card__status--replied">WhatsApp sent</span>';
    }
    if (lead.whatsappStatus === 'pending_send') {
      return '<span class="admin-lead-card__status admin-lead-card__status--pending">WhatsApp pending</span>';
    }
    return '<span class="admin-lead-card__status">Open</span>';
  }

  function whatsappStatusLabel(status) {
    if (status === 'not_applicable') return 'Email reply only';
    if (status === 'sent') return 'WhatsApp confirmed';
    if (status === 'unknown') return 'WhatsApp unknown';
    return 'WhatsApp not confirmed';
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
    const phoneCell = phone !== '—' && wa
      ? linkValue(wa, phone, 'admin-lead-card__link')
      : escapeHtml(phone);

    return `
      <dl class="admin-review-specs admin-lead-card__specs">
        ${specRow('Name', escapeHtml(displayValue(lead.name)))}
        ${specRow('Company', escapeHtml(displayValue(lead.company)))}
        ${specRow('Phone / WhatsApp', phoneCell)}
        ${specRow('Email', linkValue(email && email !== '—' ? `mailto:${email}` : '', email, 'admin-lead-card__link'))}
        ${specRow('Country (form)', escapeHtml(displayValue(lead.country)))}
        ${renderVisitorLocationRows(lead)}
        ${specRow('Enquiry type', escapeHtml(enquiryLabel(lead.enquiryType)))}
        ${specRow('Reply via', escapeHtml(replyVia))}
        ${lead.replyChannel !== 'email' ? specRow('WhatsApp status', escapeHtml(whatsappStatusLabel(lead.whatsappStatus))) : specRow('Follow-up', 'Reply by email')}
        ${specRow('Reference', `<code class="admin-lead-card__code">${escapeHtml(lead.id)}</code>`)}
      </dl>`;
  }

  function renderHalfCutSpecs(lead) {
    const phone = displayValue(lead.phone);
    const email = displayValue(lead.email);
    const wa = whatsappUrl(lead.phone, lead);
    return `
      <dl class="admin-review-specs admin-lead-card__specs">
        ${specRow('Name', escapeHtml(displayValue(lead.name)))}
        ${specRow('Phone / WhatsApp', linkValue(wa, phone, 'admin-lead-card__link'))}
        ${specRow('Email', linkValue(email && email !== '—' ? `mailto:${email}` : '', email, 'admin-lead-card__link'))}
        ${specRow('Country', escapeHtml(displayValue(lead.country)))}
        ${specRow('Stock ID', escapeHtml(displayValue(lead.stockId)))}
        ${specRow('Intent', escapeHtml(intentLabel(lead.intent)))}
        ${specRow('Vehicle', escapeHtml(`${displayValue(lead.brand)} ${displayValue(lead.model)}`.trim()))}
        ${specRow('Engine', escapeHtml(displayValue(lead.engineCode)))}
        ${specRow('Transmission', escapeHtml(displayValue(lead.transmissionCode)))}
        ${specRow('Listing status', escapeHtml(displayValue(lead.listingStatus)))}
        ${specRow('Slug', escapeHtml(displayValue(lead.slug)))}
        ${renderVisitorLocationRows(lead)}
        ${specRow('WhatsApp status', escapeHtml(whatsappStatusLabel(lead.whatsappStatus)))}
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

  function buildEmailReplyUrl(lead) {
    const ctx = enrichLead(lead);
    const to = String(lead.email || '').trim();
    if (!to) return '';
    const subject = encodeURIComponent(ctx.replySubject || `Re: AsiaPower enquiry — ${lead.id}`);
    const greeting = lead.name ? `Hi ${lead.name},\n\n` : 'Hello,\n\n';
    const body = encodeURIComponent(
      `${greeting}Thank you for your enquiry about ${ctx.inquirySubject || 'our products'}.\n\n${buildSummaryText(lead)}\n\nBest regards,\nAsiaPower Team`
    );
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  function utmSummaryLine(lead) {
    const parts = [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean);
    if (!parts.length) return '';
    return `Campaign: ${parts.join(' / ')}`;
  }

  function buildSummaryText(lead) {
    const ctx = enrichLead(lead);
    if (lead.source === 'half-cut') {
      return [
        'Hello AsiaPower, following up on a half-cut enquiry.',
        '',
        `Reference: ${lead.id}`,
        ctx.inquirySubject ? `Topic: ${ctx.inquirySubject}` : '',
        lead.name ? `Name: ${lead.name}` : '',
        lead.phone ? `Phone: ${lead.phone}` : '',
        lead.email ? `Email: ${lead.email}` : '',
        lead.country ? `Country: ${lead.country}` : '',
        `Stock: ${lead.stockId || '—'}`,
        `Vehicle: ${lead.brand || '—'} ${lead.model || ''}`.trim(),
        `Engine: ${lead.engineCode || '—'} / ${lead.transmissionCode || '—'}`,
        `Intent: ${intentLabel(lead.intent)}`,
        ipSummaryLine(lead),
        ctx.pageUrl || lead.page ? `Page: ${ctx.pageUrl || lead.page}` : '',
      ].filter(Boolean).join('\n');
    }

    if (lead.source === 'product-catalog') {
      return [
        'Hello AsiaPower, following up on a product catalog enquiry.',
        '',
        `Reference: ${lead.id}`,
        ctx.inquirySubject ? `Topic: ${ctx.inquirySubject}` : '',
        lead.name ? `Name: ${lead.name}` : '',
        lead.phone ? `Phone: ${lead.phone}` : '',
        lead.email ? `Email: ${lead.email}` : '',
        lead.country ? `Country: ${lead.country}` : '',
        `Category: ${lead.enquiryType || '—'}`,
        `Brand: ${lead.brand || '—'}`,
        `Product: ${lead.model || '—'}`,
        ipSummaryLine(lead),
        ctx.pageUrl || lead.page ? `Page: ${ctx.pageUrl || lead.page}` : '',
      ].filter(Boolean).join('\n');
    }

    const structuredMessage = String(lead.message || '').trim();
    if (structuredMessage.includes('Category:') && structuredMessage.includes('Destination country:')) {
      const lines = [
        structuredMessage,
        '',
        `Reference: ${lead.id}`,
        ctx.inquirySubject ? `Topic: ${ctx.inquirySubject}` : '',
        ctx.pageUrl || lead.page ? `Page: ${ctx.pageUrl || lead.page}` : '',
        ipSummaryLine(lead),
      ].filter(Boolean);
      return lines.join('\n');
    }

    return [
      'Hello AsiaPower, following up on my enquiry.',
      '',
      `Reference: ${lead.id}`,
      ctx.inquirySubject ? `Topic: ${ctx.inquirySubject}` : '',
      `Name: ${lead.name || '—'}`,
      lead.company ? `Company: ${lead.company}` : '',
      `Phone: ${lead.phone || '—'}`,
      lead.email ? `Email: ${lead.email}` : '',
      `Country: ${lead.country || '—'}`,
      `Type: ${enquiryLabel(lead.enquiryType)}`,
      lead.brand ? `Brand: ${lead.brand}` : '',
      ctx.product || lead.model ? `Product: ${ctx.product || lead.model}` : '',
      ipSummaryLine(lead),
      '',
      `Vehicle / Part: ${String(lead.vehicleDetails || '').replace(/\s+/g, ' ').trim() || '—'}`,
      lead.message && lead.message !== '-' ? `Note: ${lead.message}` : '',
      ctx.pageUrl || lead.page ? `Page: ${ctx.pageUrl || lead.page}` : '',
      lead.referrer ? `Referrer: ${lead.referrer}` : '',
      utmSummaryLine(lead),
    ].filter(Boolean).join('\n');
  }

  function buildWhatsappReplyText(lead) {
    const summary = buildSummaryText(lead);
    if (window.AsiaLeadContext?.buildWhatsappReplyTemplate) {
      return window.AsiaLeadContext.buildWhatsappReplyTemplate(lead, summary);
    }
    const ctx = enrichLead(lead);
    const greeting = lead.name ? `Hi ${lead.name},` : 'Hello,';
    return [
      greeting,
      '',
      `Thank you for your enquiry about ${ctx.inquirySubject || 'our products'}.`,
      '',
      summary,
      '',
      'Best regards,',
      'AsiaPower Team',
    ].join('\n');
  }

  // Guard: renderLeadCard must follow buildSummaryText — deleting it breaks the whole inbox (syntax error).
  function renderLeadCard(lead) {
    const replied = lead.replyStatus === 'replied';
    const isHalfCut = lead.source === 'half-cut';
    const isProductCatalog = lead.source === 'product-catalog';
    const sourceLabel = isHalfCut
      ? 'Half-cut'
      : (isProductCatalog ? 'Product catalog'
        : (lead.source === 'quote-form' ? 'Quote form'
          : (lead.source === 'whatsapp-intent' ? 'WhatsApp enquiry' : 'Contact form')));
    const wa = whatsappUrl(lead.phone, lead);
    const emailReply = buildEmailReplyUrl(lead);
    const emailOnly = lead.replyChannel === 'email';

    return `
      <article class="admin-review-card admin-lead-card${replied ? ' admin-lead-card--replied' : ''}" data-lead-id="${escapeHtml(lead.id)}">
        <header class="admin-lead-card__head">
          <div>
            <h3>${escapeHtml(leadTitle(lead))}</h3>
            <p class="admin-lead-card__meta">
              ${escapeHtml(formatDate(lead.createdAt))}
              · ${escapeHtml(sourceLabel)}
              · ${escapeHtml(lead.id)}
            </p>
          </div>
          ${statusBadge(lead)}
        </header>

        ${renderLeadContextBlock(lead)}

        ${isHalfCut ? renderHalfCutSpecs(lead) : renderContactSpecs(lead)}

        ${isHalfCut || isProductCatalog ? '' : `
          <section class="admin-lead-card__block">
            <h4>Vehicle / Part Details</h4>
            ${multilineHtml(lead.vehicleDetails)}
          </section>
          <section class="admin-lead-card__block">
            <h4>Additional Message</h4>
            ${multilineHtml(lead.message)}
          </section>`}

        <div class="admin-lead-card__actions">
          ${replied ? '' : `<button type="button" class="btn btn-accent btn-sm" data-mark-replied="${escapeHtml(lead.id)}">Mark Replied</button>`}
          ${emailReply && !replied ? `<a href="${escapeHtml(emailReply)}" class="btn ${emailOnly ? 'btn-accent' : 'btn-outline-navy'} btn-sm">Reply by Email</a>` : ''}
          <button type="button" class="btn btn-outline-navy btn-sm" data-copy-wa-reply="${escapeHtml(lead.id)}">复制 WhatsApp 回复</button>
          <button type="button" class="btn btn-outline-navy btn-sm" data-copy-summary="${escapeHtml(lead.id)}">Copy Summary</button>
          ${wa && !emailOnly ? `<a href="${escapeHtml(wa)}" class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener">WhatsApp</a>` : ''}
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
      if (filter === 'contact' && !isWebsiteLead(lead)) return false;
      if (filter === 'whatsapp' && lead.source !== 'whatsapp-intent') return false;
      if (filter === 'half-cut' && lead.source !== 'half-cut') return false;
      if (filter === 'catalog' && lead.source !== 'product-catalog') return false;
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
        lead.inquirySubject,
        lead.replySubject,
        lead.pageUrl,
        lead.referrer,
        lead.product,
        lead.productLabel,
        lead.utmSource,
        lead.utmMedium,
        lead.utmCampaign,
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

  async function copyText(text) {
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

  async function copySummary(lead) {
    await copyText(buildSummaryText(lead));
  }

  async function copyWhatsappReply(lead) {
    await copyText(buildWhatsappReplyText(lead));
  }

  function renderFilterButton(id, label, count) {
    const active = activeFilter === id ? ' is-active' : '';
    return `<button type="button" class="admin-leads-filter${active}" data-filter="${id}">${escapeHtml(label)} (${count})</button>`;
  }

  function pathLabel(pageUrl) {
    const value = String(pageUrl || '').trim();
    if (!value) return 'Unknown page';
    try {
      const url = value.startsWith('http') ? new URL(value) : new URL(value, 'https://asia-power.com');
      return url.pathname.replace(/^\/+/, '') || 'Home';
    } catch {
      return value;
    }
  }

  function topGroups(leads, keyFn, limit = 5) {
    const groups = new Map();
    leads.forEach((lead) => {
      const key = keyFn(lead);
      if (!key) return;
      const current = groups.get(key) || { key, total: 0, open: 0 };
      current.total += 1;
      if (lead.replyStatus !== 'replied') current.open += 1;
      groups.set(key, current);
    });
    return [...groups.values()]
      .sort((a, b) => (b.total - a.total) || (b.open - a.open) || a.key.localeCompare(b.key))
      .slice(0, limit);
  }

  function renderGrowthGroup(title, rows, type) {
    const body = rows.length
      ? rows.map((row) => {
        const href = type === 'page' ? pageDisplayUrl(row.key) : '';
        const label = type === 'page' ? pathLabel(row.key) : row.key;
        const value = href ? linkValue(href, label, 'admin-lead-card__link') : escapeHtml(label);
        return `<li>${value}<span>${row.total} total · ${row.open} open</span></li>`;
      }).join('')
      : '<li><em>No attribution data yet</em><span>0 total</span></li>';
    return `<section class="admin-leads-growth__card"><h3>${escapeHtml(title)}</h3><ul class="link-list">${body}</ul></section>`;
  }

  function renderGrowthAttributionSummary(leads) {
    const attributed = leads.filter((lead) => lead.pageUrl || lead.page || lead.referrer || lead.utmSource || lead.utmCampaign);
    const pageRows = topGroups(attributed, (lead) => lead.pageUrl || lead.page, 5);
    const productRows = topGroups(leads, (lead) => {
      const ctx = enrichLead(lead);
      return ctx.engineCode || lead.engineCode || ctx.product || lead.product || lead.model || ctx.productLabel;
    }, 5);
    const countryRows = topGroups(leads, (lead) => lead.country || lead.ipCountry, 5);
    const organicCount = leads.filter((lead) => {
      const ref = String(lead.referrer || '').toLowerCase();
      const source = String(lead.utmSource || '').toLowerCase();
      return ref.includes('google') || ref.includes('bing') || source === 'google' || source === 'bing';
    }).length;

    return `
      <div class="admin-leads-growth">
        <div class="admin-leads-growth__head">
          <h2>Growth Attribution</h2>
          <p>${attributed.length} attributed leads · ${organicCount} search-attributed leads · use this to decide the next SEO page batch.</p>
        </div>
        <div class="admin-leads-growth__grid">
          ${renderGrowthGroup('Top Source Pages', pageRows, 'page')}
          ${renderGrowthGroup('Top Products / Engines', productRows, 'product')}
          ${renderGrowthGroup('Top Countries', countryRows, 'country')}
        </div>
      </div>`;
  }

  async function boot() {
    const root = document.getElementById('admin-leads-root');
    if (!root) return;
    root.innerHTML = '<p class="admin-review-empty">Loading leads…</p>';

    try {
      const leads = await fetchLeads();
      const initialQuery = parseInitialSearch();
      const searchInput = document.getElementById('admin-leads-search');
      const query = searchInput?.value || initialQuery;
      const filtered = filterLeads(leads, activeFilter, query);
      const openCount = leads.filter((lead) => lead.replyStatus !== 'replied').length;
      const repliedCount = leads.filter((lead) => lead.replyStatus === 'replied').length;
      const contactCount = leads.filter((lead) => isWebsiteLead(lead)).length;
      const whatsappCount = leads.filter((lead) => lead.source === 'whatsapp-intent').length;
      const halfCutCount = leads.filter((lead) => lead.source === 'half-cut').length;
      const catalogCount = leads.filter((lead) => lead.source === 'product-catalog').length;
      const emailCount = leads.filter((lead) => lead.replyChannel === 'email').length;

      root.innerHTML = `
        <div id="admin-leads-feedback" class="admin-page-feedback" role="status" aria-live="polite" hidden></div>
        <div class="admin-leads-toolbar">
          <div>
            <h2>询价收件箱</h2>
            <p>${openCount} 待回复 · ${repliedCount} 已回复 · 共 ${leads.length}</p>
            <p class="admin-leads-toolbar__hint">WhatsApp 快捷询价在「待回复」或「WhatsApp」筛选里，不在 Half-cut / Catalog。</p>
          </div>
          <div class="admin-leads-toolbar__links">
            <button type="button" class="btn btn-outline-navy btn-sm" id="admin-leads-refresh">刷新</button>
          </div>
        </div>

        <div class="admin-leads-controls">
          <div class="admin-leads-filters" role="tablist" aria-label="Lead filters">
            ${renderFilterButton('open', 'Open', openCount)}
            ${renderFilterButton('contact', 'Website', contactCount)}
            ${renderFilterButton('whatsapp', 'WhatsApp', whatsappCount)}
            ${renderFilterButton('half-cut', 'Half-cut', halfCutCount)}
            ${renderFilterButton('catalog', 'Catalog', catalogCount)}
            ${renderFilterButton('email', 'Email reply', emailCount)}
            ${renderFilterButton('replied', 'Replied', repliedCount)}
            ${renderFilterButton('all', 'All', leads.length)}
          </div>
          <label class="admin-leads-search">
            <input type="search" id="admin-leads-search" placeholder="Search name, phone, stock ID, vehicle…" aria-label="Search leads" value="${escapeHtml(query)}">
          </label>
        </div>

        ${renderGrowthAttributionSummary(leads)}

        <div class="admin-leads-grid">
          ${filtered.length
            ? filtered.map(renderLeadCard).join('')
            : `<p class="admin-review-empty">No leads match this filter${query ? ' or search' : ''}.</p>`}
        </div>`;

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
              feedback.hidden = false;
              feedback.textContent = 'Lead marked as replied.';
              feedback.className = 'admin-page-feedback admin-page-feedback--success';
              feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
            boot();
          } catch (err) {
            if (feedback) {
              feedback.hidden = false;
              feedback.textContent = err.message || 'Update failed';
              feedback.className = 'admin-page-feedback admin-page-feedback--error';
              feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
              feedback.hidden = false;
              feedback.textContent = 'Lead deleted.';
              feedback.className = 'admin-page-feedback admin-page-feedback--success';
              feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
            boot();
          } catch (err) {
            if (feedback) {
              feedback.hidden = false;
              feedback.textContent = err.message || 'Delete failed';
              feedback.className = 'admin-page-feedback admin-page-feedback--error';
              feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
          return;
        }

        const copyBtn = event.target.closest('[data-copy-summary]');
        if (copyBtn) {
          const lead = leadMap.get(copyBtn.dataset.copySummary);
          if (!lead) return;
          try {
            await copySummary(lead);
            if (feedback) {
              feedback.hidden = false;
              feedback.textContent = 'Summary copied to clipboard.';
              feedback.className = 'admin-page-feedback admin-page-feedback--success';
              feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          } catch (err) {
            if (feedback) {
              feedback.hidden = false;
              feedback.textContent = err.message || 'Copy failed';
              feedback.className = 'admin-page-feedback admin-page-feedback--error';
              feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
          return;
        }

        const copyWaBtn = event.target.closest('[data-copy-wa-reply]');
        if (!copyWaBtn) return;
        const waLead = leadMap.get(copyWaBtn.dataset.copyWaReply);
        if (!waLead) return;
        try {
          await copyWhatsappReply(waLead);
          if (feedback) {
            feedback.hidden = false;
            feedback.textContent = 'WhatsApp 回复模板已复制（含询价主题）。';
            feedback.className = 'admin-page-feedback admin-page-feedback--success';
            feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        } catch (err) {
          if (feedback) {
            feedback.hidden = false;
            feedback.textContent = err.message || 'Copy failed';
            feedback.className = 'admin-page-feedback admin-page-feedback--error';
            feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

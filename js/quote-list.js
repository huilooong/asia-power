/**
 * AsiaPower quote list ("购物车" = 报价清单, not payment checkout).
 * localStorage key: asiapower-quote-list-v1
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'asiapower-quote-list-v1';
  const CHANGE_EVENT = 'asiapower:quote-list-change';

  function href(path) {
    if (window.SitePaths?.href) return window.SitePaths.href(path);
    return path;
  }

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function write(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    try {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { count: list.length, items: list } }));
    } catch { /* ignore */ }
    refreshBadges();
  }

  function itemKey(item) {
    const stock = String(item.stockId || item.stock_id || '').trim();
    const part = String(item.partType || item.part_type || '').trim();
    return part ? `${stock}::${part}` : stock;
  }

  function normalize(item) {
    const stockId = String(item.stockId || item.stock_id || '').trim();
    if (!stockId) return null;
    const priceRaw = item.priceUsd ?? item.price_usd;
    const priceUsd = priceRaw === '' || priceRaw == null ? null : Number(priceRaw);
    return {
      stockId,
      slug: String(item.slug || '').trim(),
      title: String(item.title || '').trim(),
      brand: String(item.brand || '').trim(),
      model: String(item.model || '').trim(),
      year: item.year || '',
      engineCode: String(item.engineCode || item.engine_code || '').trim(),
      partType: String(item.partType || item.part_type || '').trim(),
      partLabel: String(item.partLabel || item.part_label || '').trim(),
      priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
      priceNote: String(item.priceNote || item.price_note || '').trim(),
      pageUrl: String(item.pageUrl || item.page_url || '').trim(),
      qty: Math.max(1, Number(item.qty) || 1),
      addedAt: item.addedAt || new Date().toISOString(),
    };
  }

  function add(raw) {
    const item = normalize(raw);
    if (!item) return { ok: false, reason: 'missing_stock' };
    const list = read();
    const key = itemKey(item);
    const idx = list.findIndex((x) => itemKey(x) === key);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item, qty: (Number(list[idx].qty) || 1) + (item.qty || 1) };
    } else {
      list.push(item);
    }
    write(list);
    return { ok: true, count: list.length, items: list };
  }

  function remove(stockId, partType) {
    const key = itemKey({ stockId, partType });
    const list = read().filter((x) => itemKey(x) !== key);
    write(list);
    return list;
  }

  function clear() {
    write([]);
  }

  function count() {
    return read().reduce((n, x) => n + (Number(x.qty) || 1), 0);
  }

  function buildBulkMessage(items) {
    const list = items || read();
    if (!list.length) {
      return 'Hello AsiaPower, I would like a quote for items on your site.';
    }
    const lines = [
      'Hello AsiaPower — quote list inquiry',
      `Items: ${list.length}`,
      '',
    ];
    list.forEach((it, i) => {
      const price =
        it.priceUsd != null
          ? `EXW $${Math.round(Number(it.priceUsd))} USD${it.priceNote ? ` (${it.priceNote})` : ''}`
          : 'EXW: please confirm';
      lines.push(
        `${i + 1}. ${it.stockId}` +
          (it.partLabel || it.partType ? ` · ${it.partLabel || it.partType}` : '') +
          ` · ${[it.year, it.brand, it.model].filter(Boolean).join(' ')}` +
          (it.engineCode ? ` · ${it.engineCode}` : '') +
          ` · qty ${it.qty || 1} · ${price}` +
          (it.pageUrl ? `\n   ${it.pageUrl}` : ''),
      );
    });
    lines.push('');
    lines.push('Destination country: [please advise]');
    lines.push('Please confirm availability, EXW, and shipping options for this list.');
    return lines.join('\n');
  }

  function bulkWhatsAppUrl(items) {
    const text = buildBulkMessage(items);
    if (window.WhatsAppCrm?.buildUrl) return window.WhatsAppCrm.buildUrl(text);
    const n = String(window.ASIAPOWER?.whatsapp || '8616638801930').replace(/\D/g, '');
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  }

  function badgeHtml(extraClass) {
    const n = count();
    const cls = ['ap-quote-badge', extraClass].filter(Boolean).join(' ');
    return `<a class="${cls}" href="${href('quote-list.html')}" data-quote-list-badge aria-label="Quote list">
      <span class="ap-quote-badge__label">List</span>
      <span class="ap-quote-badge__count" data-quote-count>${n}</span>
    </a>`;
  }

  function refreshBadges() {
    const n = count();
    document.querySelectorAll('[data-quote-count]').forEach((el) => {
      el.textContent = String(n);
      el.hidden = n <= 0;
      el.classList.toggle('is-empty', n <= 0);
    });
    document.querySelectorAll('[data-quote-list-badge]').forEach((el) => {
      el.classList.toggle('has-items', n > 0);
    });
  }

  function toast(msg) {
    if (window.SiteFeedback?.toast) {
      window.SiteFeedback.toast(msg);
      return;
    }
    let el = document.getElementById('ap-quote-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ap-quote-toast';
      el.className = 'ap-quote-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('is-show'), 2200);
  }

  function addFromHalfCutItem(item, extras) {
    const u = window.HalfCutUtils;
    const pageUrl = u?.listingSharePageUrl?.(item) || u?.detailUrl?.(item) || '';
    const price = extras?.priceUsd != null
      ? extras.priceUsd
      : (item.priceUsd != null ? Number(item.priceUsd) : null);
    return add({
      stockId: item.stockId,
      slug: item.slug,
      title: item.title,
      brand: item.brand,
      model: item.model,
      year: item.year,
      engineCode: item.engineCode,
      partType: extras?.partType || '',
      partLabel: extras?.partLabel || '',
      priceUsd: price,
      priceNote: extras?.priceNote || '',
      pageUrl,
      qty: extras?.qty || 1,
    });
  }

  function wireAddButtons(root) {
    (root || document).querySelectorAll('[data-quote-add]').forEach((btn) => {
      if (btn.dataset.quoteWired) return;
      btn.dataset.quoteWired = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const payload = {
          stockId: btn.getAttribute('data-stock-id') || btn.dataset.stockId,
          slug: btn.getAttribute('data-slug') || '',
          title: btn.getAttribute('data-title') || '',
          brand: btn.getAttribute('data-brand') || '',
          model: btn.getAttribute('data-model') || '',
          year: btn.getAttribute('data-year') || '',
          engineCode: btn.getAttribute('data-engine') || '',
          partType: btn.getAttribute('data-part-type') || '',
          partLabel: btn.getAttribute('data-part-label') || '',
          priceUsd: btn.getAttribute('data-price-usd'),
          priceNote: btn.getAttribute('data-price-note') || '',
          pageUrl: btn.getAttribute('data-page-url') || window.location.href,
        };
        const res = add(payload);
        if (res.ok) toast(`Added to quote list (${res.count})`);
      });
    });
  }

  window.QuoteList = {
    STORAGE_KEY,
    CHANGE_EVENT,
    read,
    write,
    add,
    remove,
    clear,
    count,
    buildBulkMessage,
    bulkWhatsAppUrl,
    badgeHtml,
    refreshBadges,
    addFromHalfCutItem,
    wireAddButtons,
    toast,
  };

  document.addEventListener('DOMContentLoaded', () => {
    refreshBadges();
    wireAddButtons();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) refreshBadges();
  });
})();

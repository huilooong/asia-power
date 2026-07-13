/**
 * Hybrid preview: v4 brand door + live multi-category shelves
 */
(function () {
  'use strict';

  const ORIGIN = 'https://asia-power.com';
  const WA = '8616638801930';
  const ENGINE_RATIO = 0.65;

  const ICONS = {
    half: '<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/></svg>',
    engine: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>',
    mach: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    used: '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function photoUrl(item) {
    const p = item?.photo || '';
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    return ORIGIN + (p.startsWith('/') ? p : '/' + p);
  }

  function detailUrl(item) {
    return `${ORIGIN}/half-cuts/detail.html?slug=${encodeURIComponent(item?.slug || '')}`;
  }

  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return 'Quote';
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  function engineMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return 'Quote';
    return money(v * ENGINE_RATIO);
  }

  function hasVideo(item) {
    return !!(item?.videoUrl && String(item.videoUrl).trim());
  }

  function titleOf(item, variant) {
    if (variant === 'engine') {
      const code = item?.engineCode || '';
      const brand = item?.brand || '';
      return [brand, code, 'Engine'].filter(Boolean).join(' ');
    }
    const bits = [item?.brand, item?.model, item?.engineCode].filter(Boolean);
    if (bits.length) return bits.join(' ') + (variant === 'truck' ? ' Cab' : ' Half-Cut');
    return item?.title || item?.stockId || 'Listing';
  }

  function waUrl(item) {
    const msg = item
      ? `Hello AsiaPower,\nStock ID: ${item.stockId}\n${titleOf(item)}\nEXW: ${money(item.priceUsd)} USD\n${detailUrl(item)}`
      : 'Hello AsiaPower, I would like to enquire about inventory.';
    return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  }

  function go(id) {
    document.querySelectorAll('.pv').forEach((el) => el.classList.toggle('on', el.id === id));
    document.querySelectorAll('.demo-bar .tab').forEach((btn) => {
      btn.classList.toggle('on', btn.getAttribute('data-go') === id);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function card(item, variant) {
    const img = photoUrl(item);
    const video = hasVideo(item);
    const price = variant === 'engine' ? engineMoney(item.priceUsd) : money(item.priceUsd);
    const tags = variant === 'engine'
      ? [item.engineCode, item.year].filter(Boolean)
      : [item.year, item.transmissionCode, item.drivetrain].filter(Boolean);
    const tagHtml = tags.map((t) => `<span class="ptg">${esc(t)}</span>`).join('')
      + (video ? '<span class="ptg v">Video</span>' : '');
    const imgHtml = img
      ? `<div class="pc-img real"><span class="pc-hc">${esc(item.stockId)}</span>${video ? '<span class="pc-video">Video</span>' : ''}<img src="${esc(img)}" alt="" loading="lazy"></div>`
      : `<div class="pc-img"><span class="pc-hc">${esc(item.stockId || '')}</span><div class="pc-ph">${ICONS.photo}<span>Photo</span></div></div>`;
    const note = variant === 'engine'
      ? '<div class="engine-price-note">Engine EXW ref. (~65%)</div>'
      : '';

    return `<a class="pcard" href="${esc(detailUrl(item))}" target="_blank" rel="noopener">
      ${imgHtml}
      <div class="pc-body">
        <div class="pc-make">${esc(item.brand || '')}</div>
        <div class="pc-name">${esc(titleOf(item, variant))}</div>
        <div class="pc-tags">${tagHtml}</div>
        ${note}
        <div class="pc-foot">
          <div><span class="pc-price">${esc(price)}</span><span class="pc-exw">EXW</span></div>
          <span class="btn-q">Quote →</span>
        </div>
      </div>
    </a>`;
  }

  function emptyRail(msg) {
    return `<div style="padding:28px 12px;color:var(--t3);font-size:14px">${esc(msg)}</div>`;
  }

  function renderShowcase(item) {
    if (!item) return '';
    const img = photoUrl(item);
    const video = hasVideo(item);
    const imgBlock = img
      ? `<div class="sc-img real"><img src="${esc(img)}" alt=""><div class="sc-badges">${video ? '<span class="sc-badge vf">✓ Video Verified</span><span class="sc-badge vid">Watch Video</span>' : '<span class="sc-badge vf">✓ In Stock</span>'}</div><span class="sc-hc-tag">${esc(item.stockId)}</span></div>`
      : `<div class="sc-img"><div class="sc-img-ph">${ICONS.photo}<span>Product photo</span></div><span class="sc-hc-tag">${esc(item.stockId)}</span></div>`;

    return `
      <div style="margin-bottom:18px">
        <div class="sec-kicker">Featured listing</div>
        <div class="sec-h" style="margin-bottom:0">Handpicked this week</div>
      </div>
      <div class="showcase-card">
        ${imgBlock}
        <div class="sc-body">
          <div>
            <div class="sc-kicker">${esc(item.brand || '')} · ${esc(item.year || '')}</div>
            <div class="sc-name">${esc(item.model || '')}<br>${esc(item.engineCode || '')} Half-Cut${item.drivetrain ? ', ' + esc(item.drivetrain) : ''}</div>
            <div class="sc-specs">
              <div class="sc-spec"><span class="sc-spec-k">Engine</span><span class="sc-spec-v">${esc(item.engineCode || '—')}</span></div>
              <div class="sc-spec"><span class="sc-spec-k">Transmission</span><span class="sc-spec-v">${esc(item.transmissionCode || '—')}</span></div>
              <div class="sc-spec"><span class="sc-spec-k">Drivetrain</span><span class="sc-spec-v">${esc(item.drivetrain || '—')}</span></div>
              <div class="sc-spec"><span class="sc-spec-k">Stock ID</span><span class="sc-spec-v mono">${esc(item.stockId)}</span></div>
            </div>
          </div>
          <div class="sc-price-area">
            <div class="sc-price">${esc(money(item.priceUsd))} <span class="sc-exw">EXW</span></div>
            <div class="sc-note">Live inventory · asia-power.com</div>
            <div class="sc-ctas">
              <a class="sc-wa" href="${esc(waUrl(item))}" target="_blank" rel="noopener">WhatsApp</a>
              <a class="sc-view" href="${esc(detailUrl(item))}" target="_blank" rel="noopener">View Details →</a>
            </div>
          </div>
        </div>
      </div>`;
  }

  function fillRail(id, items, variant) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = emptyRail('No items in this category right now.');
      return;
    }
    el.innerHTML = items.map((it) => card(it, variant)).join('');
  }

  function render(data) {
    const c = data.counts || {};
    const shelves = data.shelves || {};

    document.getElementById('snap-meta').textContent =
      `${c.total || 0} 台在库 · 混合预览 · ${String(data.generatedAt || '').slice(0, 16).replace('T', ' ')} UTC`;

    document.getElementById('stats-row').innerHTML = `
      <div class="stat"><div class="stat-n">${esc(c.total)}<em>+</em></div><div class="stat-l">Items in stock</div></div>
      <div class="stat"><div class="stat-n">110<em>+</em></div><div class="stat-l">Export destinations</div></div>
      <div class="stat"><div class="stat-n">24<em>h</em></div><div class="stat-l">Quote turnaround</div></div>
      <div class="stat"><div class="stat-n">${esc(c.brands)}<em>+</em></div><div class="stat-l">Vehicle brands</div></div>`;

    document.getElementById('popular-tags').innerHTML = (data.popularSearches || [])
      .map((q) => `<a class="ptag" href="${ORIGIN}/half-cuts/?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">${esc(q)}</a>`)
      .join('');

    const cats = [
      { name: 'Half-Cuts', count: c.half, href: '#shelf-half', icon: ICONS.half, on: true },
      { name: 'Engines', count: c.engineCandidates, href: '#shelf-engines', icon: ICONS.engine },
      { name: 'Trucks', count: c.truck, href: '#shelf-trucks', icon: ICONS.truck },
      { name: 'Construction', count: c.mach, href: '#shelf-machinery', icon: ICONS.mach },
      { name: 'Used Cars', count: c.used, href: '#shelf-used', icon: ICONS.used },
    ];
    document.getElementById('cat-grid').innerHTML = cats.map((cat) => `
      <a class="cat-card${cat.on ? ' on' : ''}" href="${esc(cat.href)}">
        <div class="cat-ic">${cat.icon}</div>
        <div class="cat-n">${esc(cat.name)}</div>
        <div class="cat-c">${esc(cat.count)} listings</div>
      </a>`).join('');

    document.getElementById('showcase-wrap').innerHTML = renderShowcase(data.featured);
    document.getElementById('see-half').textContent = `See All ${c.half || ''} →`;

    fillRail('rail-half', shelves.halfCuts, 'half');
    fillRail('rail-engines', shelves.engines, 'engine');
    fillRail('rail-trucks', shelves.trucks, 'truck');
    fillRail('rail-machinery', shelves.machinery, 'mach');
    fillRail('rail-used', shelves.usedCars, 'used');

    document.getElementById('trust-w').innerHTML = `
      <div class="ti"><div class="ti-ic">${ICONS.half}</div><div class="ti-n">${esc(c.total)}<em>+</em></div><div class="ti-l">Items in stock</div></div>
      <div class="ti"><div class="ti-ic">${ICONS.engine}</div><div class="ti-n">110<em>+</em></div><div class="ti-l">Export destinations</div></div>
      <div class="ti"><div class="ti-ic">${ICONS.truck}</div><div class="ti-n">${esc(c.brands)}<em>+</em></div><div class="ti-l">Vehicle brands</div></div>
      <div class="ti"><div class="ti-ic">${ICONS.mach}</div><div class="ti-n">24<em>h</em></div><div class="ti-l">Quote turnaround</div></div>`;

    document.getElementById('nav-wa').href = waUrl(null);
  }

  async function boot() {
    document.querySelectorAll('[data-go]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        go(el.getAttribute('data-go'));
      });
    });

    try {
      const res = await fetch('./inventory-snapshot.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('snapshot ' + res.status);
      render(await res.json());
    } catch (err) {
      document.getElementById('snap-meta').textContent = '加载失败: ' + err.message;
      document.getElementById('rail-half').innerHTML = emptyRail('库存快照加载失败');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

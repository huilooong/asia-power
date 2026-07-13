/**
 * AsiaPower home v4-hybrid — live multi-category shelves from /api/half-cuts/public
 */
(function () {
  'use strict';

  const WA = '8616638801930';
  const ENGINE_RATIO = 0.65;
  const SHELF_LIMIT = 12;
  const POPULAR = ['Lexus LX570', 'Toyota Prado', 'Isuzu 4JB1', '2AZ-FE', 'HC250127', 'Hilux'];

  const ICONS = {
    half: '<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/></svg>',
    engine: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>',
    mach: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    used: '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  };

  let lastData = null;

  function t(key, fallback) {
    return window.PublicI18n?.t?.(key, fallback) || fallback || key;
  }

  function tf(key, fallback, vars) {
    let s = t(key, fallback);
    if (vars) {
      Object.keys(vars).forEach((k) => {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return s;
  }

  function base() {
    return window.SitePaths?.base?.() || '';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function firstPhoto(item) {
    const photos = item?.photos;
    if (Array.isArray(photos) && photos.length) {
      const p = photos[0];
      return typeof p === 'string' ? p : (p?.url || p?.thumbUrl || '');
    }
    return item?.photo || '';
  }

  function photoUrl(item) {
    const p = firstPhoto(item);
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    return (p.startsWith('/') ? p : '/' + p);
  }

  function detailUrl(item) {
    const slug = item?.slug || '';
    return `${base()}half-cuts/detail.html?slug=${encodeURIComponent(slug)}`;
  }

  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return t('home.v4.quoteOnly', 'Quote');
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  function engineMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return t('home.v4.quoteOnly', 'Quote');
    return money(v * ENGINE_RATIO);
  }

  function hasVideo(item) {
    return !!(item?.videoUrl || item?.video?.url);
  }

  function isAvailable(item) {
    const status = String(item?.status || '').trim();
    return !status || status === 'Available';
  }

  function isTruckCab(item) {
    // Must be explicitly truck category — never trust Driver Cab alone
    // (QXB passenger half-cuts were mis-tagged as truck cabs Jul 2026)
    if (String(item?.vehicleCategory || '').trim() !== 'truck') return false;
    if (looksLikePassengerVehicle(item)) return false;
    return item?.truckPartType === 'cab'
      || String(item?.vehicleCondition || '').trim() === 'Driver Cab';
  }

  /** Passenger OEMs / models that must never appear in Trucks shelf */
  function looksLikePassengerVehicle(item) {
    const brand = String(item?.brand || '');
    const model = String(item?.model || '');
    const blob = `${brand} ${model} ${item?.title || ''}`.toLowerCase();
    const passengerOem = [
      '吉利', '雪佛兰', '别克', '福特', '大众', '马自达', '哈弗', '长安', '猎豹',
      '宝马', '奥迪', '丰田', '本田', '日产', '现代', '起亚', '荣威', '名爵',
      '比亚迪', '奇瑞', '长城', '传祺', '五菱', '宝骏', '奔驰', '保时捷', '路虎', '捷豹',
      'lexus', 'toyota', 'honda', 'nissan', 'mazda', 'ford', 'volkswagen', 'bmw',
      'audi', 'hyundai', 'kia', 'chevrolet', 'buick', 'geely', 'haval', 'changan',
      'byd', 'mg', 'roewe', 'jeep', 'porsche', 'jaguar', 'land rover', 'landrover', 'liebao',
    ];
    const passengerModels = [
      '科鲁兹', '英朗', '帝豪', '奔奔', '福克斯', '福睿斯', 'passat', '朗逸',
      '宝来', '捷达', 'polo', 'civic', 'corolla', 'camry', 'accord', 'h6', 'h2',
      'cs10', 'cruze', 'focus', 'jetta', 'freelander', 'range rover', 'discovery',
    ];
    if (passengerOem.some((b) => brand.includes(b) || blob.includes(b.toLowerCase()))) {
      // Allow if clearly a commercial truck series under a dual-use brand (rare)
      if (/\b(truck|giga|elf|nqr|npr|700|500|howo|t7|f3000|m3000)\b/i.test(blob)) return false;
      return true;
    }
    return passengerModels.some((m) => blob.includes(m.toLowerCase()));
  }

  function isTruckListing(item) {
    if (String(item?.vehicleCategory || '').trim() !== 'truck') return false;
    if (looksLikePassengerVehicle(item)) return false;
    return true;
  }

  function isMachinery(item) {
    return item?.vehicleCategory === 'machinery'
      || !!item?.machineryType;
  }

  function isUsedCar(item) {
    return !!item?.isExportUsedCar
      || String(item?.vehicleCondition || '').includes('Running Vehicle');
  }

  function passengerPartType(item) {
    const explicit = String(item?.passengerPartType || '').trim().toLowerCase();
    if (['front', 'engine', 'transmission', 'chassis', 'other'].includes(explicit)) return explicit;
    const slug = String(item?.slug || '').toLowerCase();
    if (slug.includes('-passenger-engine-')) return 'engine';
    if (slug.includes('-passenger-transmission-')) return 'transmission';
    if (slug.includes('-passenger-chassis-')) return 'chassis';
    if (slug.includes('-front-cut-')) return 'front';
    if (slug.includes('-passenger-part-')) return 'other';
    const cond = String(item?.vehicleCondition || '').trim().toLowerCase();
    if (cond === 'engine assembly') return 'engine';
    if (cond === 'transmission assembly') return 'transmission';
    if (cond === 'chassis part') return 'chassis';
    if (cond === 'front cut' || cond.includes('nose cut')) return 'front';
    if (cond === 'part') return 'other';
    return '';
  }

  function isPassengerHalf(item) {
    if (isMachinery(item) || isTruckCab(item) || isUsedCar(item)) return false;
    if (item?.vehicleCategory === 'truck') return false;
    const partType = passengerPartType(item);
    return !partType || partType === 'front';
  }

  function isPassengerEngine(item) {
    if (isMachinery(item) || isTruckListing(item) || isUsedCar(item)) return false;
    const partType = passengerPartType(item);
    if (partType) return partType === 'engine';
    return isPassengerHalf(item) && Boolean(String(item?.engineCode || '').trim());
  }

  function titleOf(item, variant) {
    // Prefer API English title when present
    const apiTitle = String(item?.title || '').trim();
    const hasCjk = /[\u4e00-\u9fff]/.test(apiTitle);
    if (apiTitle && !hasCjk && variant !== 'engine') return apiTitle;

    if (variant === 'engine') {
      return [item?.brand, item?.engineCode, t('home.v4.engineSuffix', 'Engine')].filter(Boolean).join(' ');
    }
    const bits = [item?.brand, item?.model, item?.engineCode].filter(Boolean);
    if (bits.length) {
      if (variant === 'truck') return bits.join(' ') + ' ' + t('home.v4.cabSuffix', 'Cab');
      if (variant === 'used') return bits.join(' ');
      return bits.join(' ') + ' ' + t('home.v4.halfCutSuffix', 'Half-Cut');
    }
    return item?.title || item?.stockId || 'Listing';
  }

  function waUrl(item) {
    const msg = item
      ? `Hello AsiaPower,\nStock ID: ${item.stockId}\n${titleOf(item)}\nEXW: ${money(item.priceUsd)} USD\n${location.origin}${detailUrl(item)}`
      : 'Hello AsiaPower, I would like to enquire about inventory.';
    return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  }

  function sortNewest(a, b) {
    const ta = Date.parse(a?.listedAt || 0) || 0;
    const tb = Date.parse(b?.listedAt || 0) || 0;
    if (tb !== ta) return tb - ta;
    return String(b?.stockId || '').localeCompare(String(a?.stockId || ''));
  }

  function take(list, n) {
    return list.slice().sort(sortNewest).slice(0, n);
  }

  function card(item, variant) {
    const img = photoUrl(item);
    const video = hasVideo(item);
    const price = variant === 'engine' ? engineMoney(item.priceUsd) : money(item.priceUsd);
    const tags = variant === 'engine'
      ? [item.engineCode, item.year].filter(Boolean)
      : [item.year, item.transmissionCode, item.drivetrain].filter(Boolean);
    const tagHtml = tags.map((tg) => `<span class="ptg">${esc(tg)}</span>`).join('')
      + (video ? `<span class="ptg v">${esc(t('home.video', 'Video'))}</span>` : '');
    const imgHtml = img
      ? `<div class="pc-img real"><span class="pc-hc">${esc(item.stockId)}</span>${video ? `<span class="pc-video">${esc(t('home.video', 'Video'))}</span>` : ''}<img src="${esc(img)}" alt="" loading="lazy"></div>`
      : `<div class="pc-img"><span class="pc-hc">${esc(item.stockId || '')}</span><div class="pc-ph">${ICONS.photo}<span>${esc(t('home.v4.photo', 'Photo'))}</span></div></div>`;
    const note = variant === 'engine'
      ? `<div class="engine-price-note">${esc(t('home.v4.engineNote', 'Engine EXW ref. (~65%)'))}</div>`
      : '';

    return `<a class="pcard" href="${esc(detailUrl(item))}">
      ${imgHtml}
      <div class="pc-body">
        <div class="pc-make">${esc(item.brand || '')}</div>
        <div class="pc-name">${esc(titleOf(item, variant))}</div>
        <div class="pc-tags">${tagHtml}</div>
        ${note}
        <div class="pc-foot">
          <div><span class="pc-price">${esc(price)}</span><span class="pc-exw">EXW</span></div>
          <span class="btn-q">${esc(t('home.v4.quote', 'Quote →'))}</span>
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
    const badges = video
      ? `<span class="sc-badge vf">${esc(t('home.v4.videoVerifiedBadge', '✓ Video Verified'))}</span><span class="sc-badge vid">${esc(t('home.v4.watchVideo', 'Watch Video'))}</span>`
      : `<span class="sc-badge vf">${esc(t('home.v4.inStock', '✓ In Stock'))}</span>`;
    const imgBlock = img
      ? `<div class="sc-img real"><img src="${esc(img)}" alt=""><div class="sc-badges">${badges}</div><span class="sc-hc-tag">${esc(item.stockId)}</span></div>`
      : `<div class="sc-img"><div class="sc-img-ph">${ICONS.photo}<span>${esc(t('home.v4.productPhoto', 'Product photo'))}</span></div><span class="sc-hc-tag">${esc(item.stockId)}</span></div>`;

    return `
      <div style="margin-bottom:18px">
        <div class="sec-kicker">${esc(t('home.v4.featured', 'Featured listing'))}</div>
        <div class="sec-h" style="margin-bottom:0">${esc(t('home.v4.handpicked', 'Handpicked this week'))}</div>
      </div>
      <div class="showcase-card">
        ${imgBlock}
        <div class="sc-body">
          <div>
            <div class="sc-kicker">${esc(item.brand || '')} · ${esc(item.year || '')}</div>
            <div class="sc-name">${esc(item.model || '')}<br>${esc(item.engineCode || '')} ${esc(t('home.v4.halfCutSuffix', 'Half-Cut'))}${item.drivetrain ? ', ' + esc(item.drivetrain) : ''}</div>
            <div class="sc-specs">
              <div class="sc-spec"><span class="sc-spec-k">${esc(t('home.v4.spec.engine', 'Engine'))}</span><span class="sc-spec-v">${esc(item.engineCode || '—')}</span></div>
              <div class="sc-spec"><span class="sc-spec-k">${esc(t('home.v4.spec.transmission', 'Transmission'))}</span><span class="sc-spec-v">${esc(item.transmissionCode || '—')}</span></div>
              <div class="sc-spec"><span class="sc-spec-k">${esc(t('home.v4.spec.drivetrain', 'Drivetrain'))}</span><span class="sc-spec-v">${esc(item.drivetrain || '—')}</span></div>
              <div class="sc-spec"><span class="sc-spec-k">${esc(t('home.v4.spec.stockId', 'Stock ID'))}</span><span class="sc-spec-v mono">${esc(item.stockId)}</span></div>
            </div>
          </div>
          <div class="sc-price-area">
            <div class="sc-price">${esc(money(item.priceUsd))} <span class="sc-exw">EXW</span></div>
            <div class="sc-note">${esc(t('home.v4.liveNote', 'Live inventory · asia-power.com'))}</div>
            <div class="sc-ctas">
              <a class="sc-wa" href="${esc(waUrl(item))}" target="_blank" rel="noopener">WhatsApp</a>
              <a class="sc-view" href="${esc(detailUrl(item))}">${esc(t('home.v4.viewDetails', 'View Details →'))}</a>
            </div>
          </div>
        </div>
      </div>`;
  }

  function fillRail(id, items, variant) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = emptyRail(t('home.v4.emptyShelf', 'No items in this category right now.'));
      return;
    }
    el.innerHTML = items.map((it) => card(it, variant)).join('');
  }

  function buildHomeData(approved) {
    const live = (approved || []).filter(isAvailable);
    const half = live.filter(isPassengerHalf);
    const trucks = live.filter((x) => isTruckListing(x) && isTruckCab(x));
    const machinery = live.filter(isMachinery);
    const used = live.filter(isUsedCar);
    const engines = live.filter(isPassengerEngine);
    const brands = new Set(live.map((x) => x.brand).filter(Boolean));

    let featured = live.find((x) => x.stockId === 'HC250127')
      || live.find((x) => hasVideo(x) && isPassengerHalf(x))
      || half[0]
      || live[0]
      || null;

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        total: live.length,
        half: half.length,
        truck: trucks.length,
        used: used.length,
        mach: machinery.length,
        engineCandidates: engines.length,
        brands: brands.size,
      },
      featured,
      shelves: {
        halfCuts: take(half, SHELF_LIMIT),
        engines: take(engines, SHELF_LIMIT),
        trucks: take(trucks, SHELF_LIMIT),
        machinery: take(machinery, SHELF_LIMIT),
        usedCars: take(used, SHELF_LIMIT),
      },
      popularSearches: POPULAR,
    };
  }

  function render(data) {
    lastData = data;
    const c = data.counts || {};
    const shelves = data.shelves || {};

    const meta = document.getElementById('snap-meta');
    if (meta) {
      meta.removeAttribute('data-i18n');
      meta.textContent = tf(
        'home.v4.liveMeta',
        '{n} live listings · updated {t} UTC',
        { n: c.total || 0, t: String(data.generatedAt || '').slice(11, 16) },
      );
    }

    const stats = document.getElementById('stats-row');
    if (stats) {
      stats.innerHTML = `
        <div class="stat"><div class="stat-n">${esc(c.total)}<em>+</em></div><div class="stat-l">${esc(t('home.v4.stat.items', 'Items in stock'))}</div></div>
        <div class="stat"><div class="stat-n">110<em>+</em></div><div class="stat-l">${esc(t('home.v4.stat.destinations', 'Export destinations'))}</div></div>
        <div class="stat"><div class="stat-n">24<em>h</em></div><div class="stat-l">${esc(t('home.v4.stat.quote', 'Quote turnaround'))}</div></div>
        <div class="stat"><div class="stat-n">${esc(c.brands)}<em>+</em></div><div class="stat-l">${esc(t('home.v4.stat.brands', 'Vehicle brands'))}</div></div>`;
    }

    const tags = document.getElementById('popular-tags');
    if (tags) {
      tags.innerHTML = (data.popularSearches || POPULAR)
        .map((q) => `<a class="ptag" href="${base()}half-cuts/?q=${encodeURIComponent(q)}">${esc(q)}</a>`)
        .join('');
    }

    // Category cards → list pages (same targets as top nav; marker: nav-list-direct-v1)
    const cats = [
      { name: t('home.v4.nav.halfCuts', 'Half-Cuts'), count: c.half, href: '/half-cuts/', icon: ICONS.half, on: true },
      { name: t('home.v4.cat.engines', 'Engines'), count: c.engineCandidates, href: '/engines/', icon: ICONS.engine },
      { name: t('home.v4.nav.trucks', 'Trucks'), count: c.truck, href: '/trucks/', icon: ICONS.truck },
      { name: t('home.v4.cat.construction', 'Construction'), count: c.mach, href: '/machinery/', icon: ICONS.mach },
      { name: t('home.v4.nav.usedCars', 'Used Cars'), count: c.used, href: '/half-cuts/?cat=used-cars', icon: ICONS.used },
    ];
    const catGrid = document.getElementById('cat-grid');
    if (catGrid) {
      catGrid.innerHTML = cats.map((cat) => `
        <a class="cat-card${cat.on ? ' on' : ''}" href="${esc(cat.href)}">
          <div class="cat-ic">${cat.icon}</div>
          <div class="cat-n">${esc(cat.name)}</div>
          <div class="cat-c">${esc(cat.count)} ${esc(t('home.v4.listings', 'listings'))}</div>
        </a>`).join('');
    }

    const showcase = document.getElementById('showcase-wrap');
    if (showcase) showcase.innerHTML = renderShowcase(data.featured);

    const seeHalf = document.getElementById('see-half');
    if (seeHalf) {
      seeHalf.removeAttribute('data-i18n');
      seeHalf.textContent = tf('home.v4.seeAllN', 'See All {n} →', { n: c.half || '' }).replace(/\s+/g, ' ').trim();
    }

    fillRail('rail-half', shelves.halfCuts, 'half');
    fillRail('rail-engines', shelves.engines, 'engine');
    fillRail('rail-trucks', shelves.trucks, 'truck');
    fillRail('rail-machinery', shelves.machinery, 'mach');
    fillRail('rail-used', shelves.usedCars, 'used');

    const trust = document.getElementById('trust-w');
    if (trust) {
      trust.innerHTML = `
        <div class="ti"><div class="ti-ic">${ICONS.half}</div><div class="ti-n">${esc(c.total)}<em>+</em></div><div class="ti-l">${esc(t('home.v4.stat.items', 'Items in stock'))}</div></div>
        <div class="ti"><div class="ti-ic">${ICONS.engine}</div><div class="ti-n">110<em>+</em></div><div class="ti-l">${esc(t('home.v4.stat.destinations', 'Export destinations'))}</div></div>
        <div class="ti"><div class="ti-ic">${ICONS.truck}</div><div class="ti-n">${esc(c.brands)}<em>+</em></div><div class="ti-l">${esc(t('home.v4.stat.brands', 'Vehicle brands'))}</div></div>
        <div class="ti"><div class="ti-ic">${ICONS.mach}</div><div class="ti-n">24<em>h</em></div><div class="ti-l">${esc(t('home.v4.stat.quote', 'Quote turnaround'))}</div></div>`;
    }

    const navWa = document.getElementById('nav-wa');
    if (navWa) navWa.href = waUrl(null);

    // Re-apply static data-i18n after dynamic HTML updates (lang switcher / layout refresh)
    window.PublicI18n?.applyDataI18n?.(document.body);
  }

  async function loadApproved() {
    const res = await fetch('/api/half-cuts/public', { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) throw new Error('public catalog ' + res.status);
    const data = await res.json();
    return data.approved || data.items || [];
  }

  async function loadSnapshotFallback() {
    const res = await fetch('/assets/home-v4-inventory-snapshot.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('snapshot ' + res.status);
    return res.json();
  }

  async function boot() {
    try {
      const approved = await loadApproved();
      if (approved.length) {
        render(buildHomeData(approved));
        return;
      }
      // Local/dev empty catalog → same-origin snapshot (no CORS)
      const snap = await loadSnapshotFallback();
      if (snap?.shelves) render(snap);
      else render(buildHomeData(snap?.approved || []));
    } catch (err) {
      try {
        const snap = await loadSnapshotFallback();
        if (snap?.shelves) {
          render(snap);
          return;
        }
      } catch {
        // fall through
      }
      // Still render empty shelves — never leave a broken hero
      render(buildHomeData([]));
      const meta = document.getElementById('snap-meta');
      if (meta) meta.textContent = t('home.v4.unavailable', 'Inventory temporarily unavailable');
      console.warn('[home-v4-hybrid]', err);
    }
  }

  window.addEventListener('asiapower:langchange', () => {
    if (lastData) render(lastData);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

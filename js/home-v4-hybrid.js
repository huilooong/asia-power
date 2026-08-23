/**
 * AsiaPower home v4-hybrid — live multi-category shelves from /api/half-cuts/public
 */
(function () {
  'use strict';

  const WA = '8616638801930';
  const SHELF_LIMIT = 12;
  const POPULAR = ['LEXUS LX570', 'TOYOTA Prado', 'ISUZU 4JB1', '2AZ-FE', 'HC250127', 'Hilux'];
  // Official Chinese market names. EN / FR / AR keep the registered international
  // name in uppercase instead of machine-translating a legally sensitive field.
  const BRAND_ZH = {
    AUDI: '奥迪', BEIBEN: '北奔', BMW: '宝马', BUICK: '别克', BYD: '比亚迪',
    CADILLAC: '凯迪拉克', CAMC: 'CAMC', CHANGAN: '长安', 'CHANGAN KUAYUE': '长安跨越',
    CHERY: '奇瑞', CHEVROLET: '雪佛兰', CHRYSLER: '克莱斯勒', CITROËN: '雪铁龙',
    DENZA: '腾势', DODGE: '道奇', DONGFANGHONG: '东方红', DONGFENG: '东风',
    FANGCHENGBAO: '方程豹', FAW: '一汽', FORD: '福特', GEELY: '吉利', GMC: 'GMC',
    'GREAT WALL': '长城', HAVAL: '哈弗', HINO: '日野', HONDA: '本田', HONGYAN: '红岩',
    HOWO: '豪沃', HYUNDAI: '现代', 'HYUNDAI TRUCKS': '现代商用车', ISUZU: '五十铃',
    JAC: '江淮', JEEP: 'JEEP', JINBEI: '金杯', JMC: '江铃', KIA: '起亚',
    'LAND ROVER': '路虎', LEXUS: '雷克萨斯', LIEBAO: '猎豹汽车', LONKING: '龙工',
    LOVOL: '雷沃', MAN: '曼恩', MAXUS: '上汽大通MAXUS', MAZDA: '马自达',
    'MERCEDES-BENZ': '梅赛德斯-奔驰', MG: 'MG', MITSUBISHI: '三菱汽车', NISSAN: '日产',
    PEUGEOT: '标致', ROEWE: '荣威', SANY: '三一', 'SHAANXI AUTO': '陕汽',
    SHACMAN: '陕汽重卡', SINOTRUK: '中国重汽', SUZUKI: '铃木', TANK: '坦克',
    TOYOTA: '丰田', VOLKSWAGEN: '大众汽车', VOLVO: '沃尔沃', WULING: '五菱',
  };

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

  function canonicalBrand(item) {
    return String(item?.brand || '').trim().toLocaleUpperCase('en-US');
  }

  function brandName(item) {
    const canonical = canonicalBrand(item);
    return window.PublicI18n?.getLang?.() === 'zh' ? (BRAND_ZH[canonical] || canonical) : canonical;
  }

  function upperBrandInTitle(value, item) {
    const title = String(value || '').trim();
    const rawBrand = String(item?.brand || '').trim();
    if (!title || !rawBrand) return title;
    const escapedBrand = rawBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return title.replace(new RegExp(escapedBrand, 'i'), brandName(item));
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
    const q = `detail.html?slug=${encodeURIComponent(slug)}`;
    if (isTruckCab(item) || isTruckListing(item)) return `${base()}trucks/${q}`;
    if (isMachinery(item)) return `${base()}machinery/${q}`;
    if (isUsedCar(item)) return `${base()}used-cars/${q}`;
    return `${base()}half-cuts/${q}`;
  }

  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return t('home.v4.quoteOnly', 'Quote');
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  function engineMoney(item) {
    if (passengerPartType(item) !== 'engine') return t('home.v4.quoteOnly', 'Quote');
    return money(item?.priceUsd);
  }

  function hasVideo(item) {
    return !!(item?.videoUrl || item?.video?.url);
  }

  function videoSource(item) {
    return String(item?.videoUrl || item?.video?.url || '').trim();
  }

  function youtubeVideoId(raw) {
    try {
      const url = new URL(String(raw || ''), location.origin);
      if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
      if (url.hostname.endsWith('youtube.com')) {
        if (url.pathname === '/watch') return url.searchParams.get('v') || '';
        const parts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || '';
      }
    } catch {
      return '';
    }
    return '';
  }

  function playableVideoMime(item) {
    const src = videoSource(item).split('?')[0].toLowerCase();
    if (src.endsWith('.mp4')) return 'video/mp4';
    if (src.endsWith('.webm')) return 'video/webm';
    return '';
  }

  function mediaPlayOverlay() {
    return `<span class="ap-media-cover__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 7.5v9l7-4.5z" fill="currentColor"/></svg></span>
      <span class="ap-media-cover__label"><span aria-hidden="true">▶</span> ${esc(t('home.video', 'Video'))}</span>`;
  }

  function youtubeCoverLayers(thumbnail, fallback, alt, loading) {
    const baseLayer = fallback
      ? `<img class="ap-media-cover__visual ap-media-cover__fallback" src="${esc(fallback)}" alt="${alt}" loading="${loading}" decoding="async">`
      : `<span class="ap-media-cover__empty" aria-hidden="true">▶</span>`;
    return `${baseLayer}<img class="ap-media-cover__visual ap-media-cover__video-thumb" data-ap-youtube-thumb src="${esc(thumbnail)}" alt="" aria-hidden="true" loading="${loading}" decoding="async">`;
  }

  function coverMedia(item, className, eager, options = {}) {
    const img = photoUrl(item);
    const src = videoSource(item);
    const youtubeId = youtubeVideoId(src);
    const mime = playableVideoMime(item);
    const loading = eager ? 'eager' : 'lazy';
    const common = `ap-media-canvas ${hasVideo(item) ? 'ap-media-canvas--video ' : ''}${className}`;
    const stockClass = options.stockClass || 'pc-hc';
    const stock = `<span class="${stockClass}">${esc(item?.stockId || '')}</span>`;
    const extras = options.extras || '';
    const alt = esc([item?.brand, item?.model, item?.stockId].filter(Boolean).join(' '));

    if (youtubeId) {
      const thumbnail = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
      return `<div class="${common} real" data-ap-video-cover="youtube" role="img" aria-label="${alt}">${stock}${youtubeCoverLayers(thumbnail, img, alt, loading)}${mediaPlayOverlay()}${extras}</div>`;
    }
    if (mime) {
      const poster = img ? ` poster="${esc(img)}"` : '';
      return `<div class="${common} real" data-ap-video-cover="hosted">${stock}<video class="ap-media-cover__visual ap-media-cover__video" muted loop playsinline preload="metadata" data-ap-cover-video aria-label="${alt}"${poster}><source src="${esc(src)}" type="${mime}"></video>${mediaPlayOverlay()}${extras}</div>`;
    }
    if (img) {
      const overlay = hasVideo(item) ? mediaPlayOverlay() : '';
      return `<div class="${common} real"${hasVideo(item) ? ' data-ap-video-cover="fallback"' : ''}>${stock}<img class="ap-media-cover__visual ap-media-cover__visual--contain" src="${esc(img)}" alt="${alt}" loading="${loading}" decoding="async">${overlay}${extras}</div>`;
    }
    return `<div class="${common}">${stock}<div class="pc-ph">${ICONS.photo}<span>${esc(t('home.v4.photo', 'Photo'))}</span></div>${hasVideo(item) ? mediaPlayOverlay() : ''}${extras}</div>`;
  }

  function bindCoverVideos(root) {
    const scope = root?.querySelectorAll ? root : document;
    const thumbs = [...scope.querySelectorAll('img[data-ap-youtube-thumb]:not([data-ap-youtube-thumb-bound])')];
    thumbs.forEach((thumb) => {
      thumb.dataset.apYoutubeThumbBound = 'true';
      const sync = () => thumb.classList.toggle('is-ready', thumb.complete && thumb.naturalWidth > 0);
      thumb.addEventListener('load', sync, { once: true });
      thumb.addEventListener('error', sync, { once: true });
      sync();
    });

    const videos = [...scope.querySelectorAll('video[data-ap-cover-video]:not([data-ap-cover-video-bound])')];
    if (!videos.length) return;
    videos.forEach((video) => { video.dataset.apCoverVideoBound = 'true'; });
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      || navigator.connection?.saveData === true
      || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) entry.target.play().catch(() => {});
        else entry.target.pause();
      });
    }, { threshold: [0, 0.35, 0.75] });
    videos.forEach((video) => observer.observe(video));
  }

  function isAvailable(item) {
    const status = String(item?.status || '').trim();
    return !status || status === 'Available';
  }

  function inventoryStatusLabel(status) {
    const value = String(status || '').trim();
    return window.PublicI18n?.translateStatus?.(value) || value;
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
    if (['front', 'engine', 'transmission', 'chassis', 'tire', 'other'].includes(explicit)) return explicit;
    const slug = String(item?.slug || '').toLowerCase();
    if (slug.includes('-passenger-engine-')) return 'engine';
    if (slug.includes('-passenger-transmission-')) return 'transmission';
    if (slug.includes('-passenger-chassis-')) return 'chassis';
    if (slug.includes('-passenger-tire-')) return 'tire';
    if (slug.includes('-front-cut-')) return 'front';
    if (slug.includes('-passenger-part-')) return 'other';
    const cond = String(item?.vehicleCondition || '').trim().toLowerCase();
    if (cond === 'engine assembly') return 'engine';
    if (cond === 'transmission assembly') return 'transmission';
    if (cond === 'chassis part') return 'chassis';
    if (cond === 'used tire' || cond === 'scrap tire') return 'tire';
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
    const label = window.EngineCardLabel;
    if (variant === 'engine') {
      const engineTitle = label?.formatEngineCodeDisplacementFuel?.(item)
        || [brandName(item), item?.engineCode, t('home.v4.engineSuffix', 'Engine')].filter(Boolean).join(' ');
      return upperBrandInTitle(engineTitle, item);
    }
    // Vehicle-first for half-cuts / trucks / used
    const vehicle = upperBrandInTitle(
      label?.formatHalfCutVehicleTitle?.(item)
        || [brandName(item), item?.model].filter(Boolean).join(' '),
      item,
    );
    if (vehicle) {
      if (variant === 'truck') return vehicle + ' ' + t('home.v4.cabSuffix', 'Cab');
      if (variant === 'used') return vehicle;
      return vehicle;
    }
    const apiTitle = String(item?.title || '').trim();
    const hasCjk = /[\u4e00-\u9fff]/.test(apiTitle);
    if (apiTitle && !hasCjk) return upperBrandInTitle(apiTitle, item);
    return upperBrandInTitle(item?.title, item) || item?.stockId || 'Listing';
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
    const price = variant === 'engine' ? engineMoney(item) : money(item.priceUsd);
    const tags = variant === 'engine'
      ? [
        window.EngineCardLabel?.formatEngineCodeDisplacementFuel?.(item) || item.engineCode,
        item.year,
      ].filter(Boolean)
      : [
        window.EngineCardLabel?.formatEngineCodeDisplacementFuel?.(item) || item.engineCode,
        item.year,
        inventoryStatusLabel(item.status),
      ].filter(Boolean);
    const tagHtml = tags.map((tg) => `<span class="ptg">${esc(tg)}</span>`).join('');
    const imgHtml = coverMedia(item, 'pc-img', false);
    const note = variant === 'engine'
      ? `<div class="engine-price-note">${esc(t('home.v4.engineNote', 'Engine EXW reference'))}</div>`
      : '';

    return `<a class="pcard" href="${esc(detailUrl(item))}" data-brand="${esc(canonicalBrand(item))}">
      ${imgHtml}
      <div class="pc-body">
        <div class="pc-make notranslate" translate="no">${esc(brandName(item))}</div>
        <div class="pc-name notranslate" translate="no">${esc(titleOf(item, variant))}</div>
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

  /**
   * Week index flips every Sunday 00:00 Asia/Shanghai (北京时间周日 0 点).
   * Same week → same pick for all visitors (deterministic).
   */
  function featuredWeekIndex(nowMs = Date.now()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date(nowMs));
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    const y = get('year');
    const m = get('month');
    const d = get('day');
    const utcNoon = Date.UTC(y, m - 1, d, 12);
    const dow = new Date(utcNoon).getUTCDay(); // 0 = Sunday
    const sundayUtc = utcNoon - dow * 864e5;
    const epochSunday = Date.UTC(2024, 0, 7, 12); // known Sunday
    return Math.floor((sundayUtc - epochSunday) / (7 * 864e5));
  }

  function showcaseScore(item) {
    let s = 0;
    if (firstPhoto(item)) s += 10;
    if (hasVideo(item)) s += 5;
    if (isTruckCab(item)) s += 3;
    else if (isPassengerHalf(item)) s += 2;
    else if (isMachinery(item)) s += 2;
    if (Number(item?.priceUsd) > 0) s += 1;
    return s;
  }

  /** Auto-rotate featured listing each Sunday 00:00 Asia/Shanghai. */
  function pickWeeklyFeatured(live) {
    const week = featuredWeekIndex();
    const pool = (live || [])
      .filter((x) => showcaseScore(x) >= 10)
      .sort((a, b) => {
        const ds = showcaseScore(b) - showcaseScore(a);
        if (ds) return ds;
        return String(a.stockId || '').localeCompare(String(b.stockId || ''));
      })
      .slice(0, 24);
    if (!pool.length) return live[0] || null;
    // Rotate category preference by week so trucks / video half-cuts alternate
    const preferFns = [
      (x) => isTruckCab(x),
      (x) => isPassengerHalf(x) && hasVideo(x),
      (x) => isPassengerHalf(x),
      (x) => isMachinery(x) || isTruckCab(x),
    ];
    const prefer = preferFns[((week % preferFns.length) + preferFns.length) % preferFns.length];
    const preferred = pool.filter(prefer);
    const use = preferred.length ? preferred : pool;
    return use[((week % use.length) + use.length) % use.length];
  }

  function evidenceCount(item) {
    const photos = Array.isArray(item?.photos) ? item.photos.filter(Boolean).length : (firstPhoto(item) ? 1 : 0);
    return photos + (hasVideo(item) ? 1 : 0);
  }

  function ledgerKind(item) {
    if (isUsedCar(item)) return 'vehicle';
    if (isMachinery(item)) return 'machinery';
    if (isTruckListing(item)) return 'commercial';
    if (passengerPartType(item) === 'engine') return 'powertrain';
    return 'parts';
  }

  function ledgerVariant(item) {
    const kind = ledgerKind(item);
    if (kind === 'vehicle') return 'used';
    if (kind === 'commercial') return 'truck';
    if (kind === 'powertrain') return 'engine';
    if (kind === 'machinery') return 'mach';
    return 'half';
  }

  function ledgerRoute(item, forcedKind) {
    const routes = {
      vehicle: ['home.circular.routeVehicle', 'Vehicle reuse'],
      powertrain: ['home.circular.routePowertrain', 'Powertrain reuse'],
      commercial: ['home.circular.routeCommercial', 'Commercial asset reuse'],
      machinery: ['home.circular.routeMachinery', 'Machinery reuse'],
      parts: ['home.circular.routeParts', 'Core parts reuse'],
    };
    const route = routes[forcedKind || ledgerKind(item)] || routes.parts;
    return t(route[0], route[1]);
  }

  function ledgerSpec(item) {
    return [item?.year, item?.engineCode || item?.transmissionCode || item?.machineryType, item?.mileage]
      .filter(Boolean)
      .slice(0, 3)
      .join(' · ');
  }

  function selectLedgerItems(groups, live) {
    const selected = [];
    const seen = new Set();
    const seenKinds = new Set();
    const add = (item, kind, allowRepeatedKind = false) => {
      const resolvedKind = kind || ledgerKind(item);
      if (!item || seen.has(item.stockId) || (!allowRepeatedKind && seenKinds.has(resolvedKind))) return;
      seen.add(item.stockId);
      seenKinds.add(resolvedKind);
      selected.push({ item, kind: resolvedKind });
    };
    const all = take((live || []).filter((item) => firstPhoto(item) || hasVideo(item)), Math.max((live || []).length, 1));
    add(all.find(hasVideo), null, true);
    [
      [groups.used, 'vehicle'],
      [groups.engines, 'powertrain'],
      [groups.trucks, 'commercial'],
      [groups.machinery, 'machinery'],
      [groups.half, 'parts'],
    ].forEach(([group, kind]) => add(take(group || [], 1)[0], kind));
    all.forEach((item) => { if (selected.length < 4) add(item, ledgerKind(item), true); });
    return selected.slice(0, 4);
  }

  function renderLedger(items) {
    const rows = (items || []).map((entry, index) => {
      const item = entry?.item || entry;
      const kind = entry?.item ? entry.kind : ledgerKind(item);
      const variant = kind === 'vehicle' ? 'used' : kind === 'commercial' ? 'truck' : kind === 'powertrain' ? 'engine' : kind === 'machinery' ? 'mach' : 'half';
      const amount = Number(item?.priceUsd);
      const price = Number.isFinite(amount) && amount > 0
        ? `<small>USD</small><b>${esc(Math.round(amount).toLocaleString('en-US'))}</b>`
        : `<b>${esc(t('home.v4.quoteOnly', 'Quote'))}</b>`;
      const evidence = tf('home.circular.evidenceCount', '{n} original evidence items', { n: evidenceCount(item) });
      return `<article class="ledger-row${hasVideo(item) ? ' ledger-row--video' : ''}" data-brand="${esc(canonicalBrand(item))}">
        <a class="ledger-media-link" href="${esc(detailUrl(item))}" aria-label="${esc(titleOf(item, variant))}">
          ${coverMedia(item, 'ledger-media', index === 0)}
        </a>
        <a class="ledger-identity" href="${esc(detailUrl(item))}" translate="no">
          <small translate="yes">${esc(ledgerRoute(item, kind))}</small>
          <b class="notranslate">${esc(titleOf(item, variant))}</b>
          <span class="notranslate">${esc(ledgerSpec(item) || item?.stockId || '')}</span>
        </a>
        <div class="ledger-evidence"><b class="notranslate" translate="no">${esc(item?.stockId || '')}</b><span><i aria-hidden="true"></i>${esc(evidence)}</span></div>
        <p class="ledger-price">${price}</p>
      </article>`;
    }).join('');
    return rows || `<p class="ledger-empty">${esc(t('home.v4.unavailable', 'Inventory temporarily unavailable'))}</p>`;
  }

  function renderShowcase(item) {
    if (!item) return '';
    const badges = item.supplierVerified
      ? `<span class="sc-badge vf">${esc(t('hc.verified', '✓ Verified'))}</span>`
      : (isAvailable(item) ? `<span class="sc-badge vf">${esc(t('home.v4.inStock', '✓ In Stock'))}</span>` : '');
    const imgBlock = coverMedia(item, 'sc-img', true, {
      stockClass: 'sc-hc-tag',
      extras: `<div class="sc-badges">${badges}</div>`,
    });

    return `
      <div class="showcase-head" style="margin-bottom:12px">
        <div class="sec-kicker">${esc(t('home.v4.featured', 'Featured listing'))}</div>
        <div class="sec-h" style="margin-bottom:0">${esc(t('home.v4.handpicked', 'Handpicked this week'))}</div>
        <div class="sc-note" style="margin:6px 0 0">${esc(t('home.v4.featuredRotate', 'Auto-updates every Sunday'))}</div>
      </div>
      <div class="showcase-card" data-brand="${esc(canonicalBrand(item))}">
        ${imgBlock}
        <div class="sc-body">
          <div>
            <div class="sc-kicker notranslate" translate="no">${esc(brandName(item))} · ${esc(item.year || '')}</div>
            <div class="sc-name">${esc(item.model || '')}<br>${esc(
              isTruckCab(item)
                ? (item.engineCode ? `${item.engineCode} ` : '') + t('home.v4.cabSuffix', 'Truck Cab')
                : `${item.engineCode || ''} ${t('home.v4.halfCutSuffix', 'Half-Cut')}`.trim()
            )}${item.drivetrain ? ', ' + esc(item.drivetrain) : ''}</div>
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
              <a class="sc-view" href="${esc(detailUrl(item))}">${esc(t('home.v4.viewDetails', 'View Details →'))}</a>
              <a class="sc-wa" href="${esc(waUrl(item))}" target="_blank" rel="noopener">WhatsApp</a>
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

    // Weekly auto-pick (Sunday 00:00 Asia/Shanghai); no hard-coded stockId
    const featured = pickWeeklyFeatured(live);

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
      ledger: selectLedgerItems({ half, trucks, machinery, used, engines }, live),
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

    const ledger = document.getElementById('circular-ledger');
    if (ledger) {
      const fallbackLedger = data.ledger || [shelves.usedCars?.[0], shelves.engines?.[0], shelves.trucks?.[0], shelves.machinery?.[0], shelves.halfCuts?.[0]].filter(Boolean).slice(0, 4);
      ledger.innerHTML = renderLedger(fallbackLedger);
    }

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
        <div class="stat"><div class="stat-n">${esc(c.half)}<em>+</em></div><div class="stat-l">${esc(t('home.v4.stat.halfCuts', 'Half-cuts'))}</div></div>
        <div class="stat"><div class="stat-n">${esc(c.engineCandidates)}<em>+</em></div><div class="stat-l">${esc(t('home.v4.stat.engines', 'Engine listings'))}</div></div>
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
      { name: t('home.circular.routeVehicleTitle', 'Complete vehicle reuse'), desc: t('home.circular.routeVehicleText', 'Match complete vehicles with their next cross-border user.'), count: c.used, href: '/half-cuts/?cat=used-cars', icon: ICONS.used },
      { name: t('home.circular.routePowertrainTitle', 'Powertrain reuse'), desc: t('home.circular.routePowertrainText', 'Engines and gearboxes for repair, replacement and rebuild.'), count: c.engineCandidates, href: '/engines/', icon: ICONS.engine },
      { name: t('home.circular.routeCommercialTitle', 'Commercial asset reuse'), desc: t('home.circular.routeCommercialText', 'Keep trucks and cabs serving transport and production.'), count: c.truck, href: '/trucks/', icon: ICONS.truck },
      { name: t('home.circular.routeMachineryTitle', 'Machinery reuse'), desc: t('home.circular.routeMachineryText', 'Move equipment into its next project or production setting.'), count: c.mach, href: '/machinery/', icon: ICONS.mach },
      { name: t('home.circular.routePartsTitle', 'Core parts reuse'), desc: t('home.circular.routePartsText', 'Recover usable assemblies and body parts from existing assets.'), count: c.half, href: '/half-cuts/', icon: ICONS.half },
    ];
    const catGrid = document.getElementById('cat-grid');
    if (catGrid) {
      catGrid.innerHTML = cats.map((cat, index) => `
        <a class="cat-card route-card${index === 0 || index === 3 ? ' route-card--wide' : ''}" href="${esc(cat.href)}">
          <span class="route-index">${String.fromCharCode(65 + index)} / ${String(index + 1).padStart(2, '0')}</span>
          <span class="cat-ic route-icon">${cat.icon}</span>
          <span class="route-copy"><small>${esc(cat.count)} ${esc(t('home.v4.listings', 'listings'))}</small><b class="cat-n">${esc(cat.name)}</b><em>${esc(cat.desc)}</em></span>
          <span class="route-arrow" aria-hidden="true">↗</span>
        </a>`).join('');
    }

    const showcase = document.getElementById('showcase-wrap');
    if (showcase) {
      showcase.innerHTML = renderShowcase(data.featured);
    }

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
    bindCoverVideos(document);

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

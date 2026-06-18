/**
 * AsiaPower — Main Application JS
 */
(function () {
  'use strict';

  function initMobileNav() {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    const header = document.querySelector('.header');
    if (!toggle || !nav) return;

    function updateSiteHeaderHeight() {
      const topBar = document.querySelector('.top-bar:not(.site-topbar--hidden)');
      const topBarEl = document.getElementById('site-topbar');
      const hasTopBar = topBar && topBar.offsetHeight > 0 && !topBarEl?.classList.contains('site-topbar--hidden');
      const height = (hasTopBar ? topBar.offsetHeight : 0) + (header?.offsetHeight || 0);
      document.documentElement.style.setProperty('--site-header-height', `${height}px`);
      document.documentElement.style.setProperty('--header-offset', `${height}px`);
    }

    function setNavOpen(open) {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
      document.body.classList.toggle('nav-open', open);
    }

    updateSiteHeaderHeight();
    window.addEventListener('resize', updateSiteHeaderHeight, { passive: true });
    window.addEventListener('orientationchange', updateSiteHeaderHeight);
    window.addEventListener('load', updateSiteHeaderHeight);
    requestAnimationFrame(updateSiteHeaderHeight);

    toggle.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      setNavOpen(open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    nav.querySelectorAll('.nav__link, .nav__cta, .lang-switcher__btn').forEach(el => {
      el.addEventListener('click', () => setNavOpen(false));
    });

    document.addEventListener('click', (e) => {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      setNavOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) setNavOpen(false);
    });
  }

  function initFAQ() {
    document.querySelectorAll('.faq-q').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
      const panel = btn.nextElementSibling;
      if (panel) panel.setAttribute('aria-hidden', 'true');

      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => {
          i.classList.remove('open');
          const q = i.querySelector('.faq-q');
          const p = q?.nextElementSibling;
          if (q) q.setAttribute('aria-expanded', 'false');
          if (p) p.setAttribute('aria-hidden', 'true');
        });
        if (!wasOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
          if (panel) panel.setAttribute('aria-hidden', 'false');
        }
      });
    });
  }

  function initFilters() {
    const bar = document.querySelector('.filter-group');
    if (!bar) return;

    const buttons = bar.querySelectorAll('.filter-btn');
    const items = document.querySelectorAll('[data-filter-tags]');
    const countEl = document.querySelector('[data-catalog-count]');

    function updateCount(visible) {
      if (countEl) countEl.textContent = visible;
    }

    function applyFilter(filter) {
      let visible = 0;
      items.forEach(item => {
        const tags = (item.dataset.filterTags || '').split(/\s+/);
        const show = filter === 'all' || tags.includes(filter);
        item.classList.toggle('hidden', !show);
        if (show) visible++;
      });
      updateCount(visible);
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilter(btn.dataset.filter);
      });
    });

    applyFilter('all');
  }

  function initURLFilters() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (!type) return;
    const btn = document.querySelector(`.filter-btn[data-filter="${type}"]`);
    if (btn) btn.click();
  }

  function validateForm(form) {
    let ok = true;
    form.querySelectorAll('[required]').forEach(field => {
      field.style.borderColor = '';
      const err = field.parentElement.querySelector('.field-err');
      if (err) err.remove();

      if (!field.value.trim()) {
        ok = false;
        field.style.borderColor = 'var(--danger)';
        const span = document.createElement('span');
        span.className = 'field-err';
        span.style.cssText = 'color:var(--danger);font-size:.75rem;margin-top:4px;display:block;';
        span.textContent = 'Required';
        field.parentElement.appendChild(span);
      } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
        ok = false;
        field.style.borderColor = 'var(--danger)';
      }
    });

    const terms = form.querySelector('[data-terms]');
    if (terms && !terms.checked) ok = false;

    return ok;
  }

  function fieldValue(form, name) {
    const field = form.elements[name];
    return field?.value?.trim() || '';
  }

  function optionText(form, name) {
    const field = form.elements[name];
    if (!field) return '';
    const selected = field.options?.[field.selectedIndex];
    return selected?.text?.trim() || field.value?.trim() || '';
  }

  function buildContactWhatsAppMessage(form) {
    const lines = [
      'Hello AsiaPower, I would like to request a quote.',
      '',
      `Name: ${fieldValue(form, 'name')}`,
      `Company: ${fieldValue(form, 'company') || '-'}`,
      `Email: ${fieldValue(form, 'email')}`,
      `Phone / WhatsApp: ${fieldValue(form, 'phone')}`,
      `Country: ${optionText(form, 'country')}`,
      `Enquiry Type: ${optionText(form, 'enquiry_type')}`,
      '',
      `Vehicle / Part Details: ${fieldValue(form, 'vehicle_details')}`,
      `Additional Message: ${fieldValue(form, 'message') || '-'}`,
      '',
      'Please quote availability, price, shipping option, and lead time.',
    ];
    return lines.join('\n');
  }

  function openContactWhatsApp(form) {
    const config = window.ASIAPOWER || {};
    const whatsapp = config.whatsapp || '8618603773077';
    const message = buildContactWhatsAppMessage(form);
    const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;
  }

  function initForms() {
    document.querySelectorAll('form[data-form]').forEach(form => {
      form.addEventListener('submit', e => {
        e.preventDefault();
        if (!validateForm(form)) return;

        const card = form.closest('.form-card');
        const success = card?.querySelector('.form-success');
        if (form.dataset.form === 'contact-enquiry') {
          openContactWhatsApp(form);
        }
        if (success) {
          form.classList.add('hidden');
          success.classList.add('show');
        } else {
          form.reset();
          showToast('Message sent. We will respond within 24 hours.');
        }
      });
    });
  }

  function showToast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:96px;right:24px;z-index:10001;background:var(--navy-800);color:#fff;padding:14px 20px;border-radius:6px;font-size:.88rem;box-shadow:0 8px 24px rgba(0,0,0,.2);border-left:4px solid var(--accent);max-width:320px;';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 4000);
  }

  function initHeaderShadow() {
    const header = document.querySelector('.header');
    if (!header) return;
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 20 ? 'var(--shadow-sm)' : 'var(--shadow-xs)';
    }, { passive: true });
  }

  function initCategoryGrid() {
    const grid = document.getElementById('category-grid');
    const config = window.ASIAPOWER;
    if (!grid || !config) return;

    const iconMap = {
      engine: '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="10" rx="1"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M8 8V5h8v3"/></svg>',
      gearbox: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="4" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="20"/></svg>',
      diesel: '<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>',
      '4wd': '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="8" rx="1"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>',
      network: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="8" x2="5" y2="16"/><line x1="12" y1="8" x2="19" y2="16"/></svg>',
      shipping: '<svg viewBox="0 0 24 24"><rect x="1" y="6" width="15" height="10"/><polygon points="16 10 20 10 23 13 23 16 16 16 16 10"/></svg>',
    };

    grid.innerHTML = config.categories.map(cat => `
      <a href="${cat.href}" class="category-card">
        <div class="category-card__icon">${iconMap[cat.icon] || iconMap.engine}</div>
        <div>
          <div class="category-card__count">${cat.count}</div>
          <div class="category-card__title">${cat.title}</div>
          <div class="category-card__desc">${cat.desc}</div>
        </div>
        <span class="category-card__arrow">→</span>
      </a>
    `).join('');
  }

  function initStatsStrip() {
    const strip = document.getElementById('stats-strip');
    const config = window.ASIAPOWER;
    if (!strip || !config) return;
    strip.innerHTML = config.stats.map(s => `
      <div class="stats-strip__item">
        <div class="stats-strip__num"><span>${s.value.replace('+', '')}</span>${s.value.includes('+') ? '+' : ''}</div>
        <div class="stats-strip__label">${s.label}</div>
      </div>
    `).join('');
  }

  function initBrandsMarquee() {
    const track = document.getElementById('brands-track');
    const config = window.ASIAPOWER;
    if (!track || !config) return;
    const tags = config.brands.map(b => `<a href="brands.html" class="brand-tag">${b}</a>`).join('');
    track.innerHTML = tags + tags;
  }

  function initEngineCatalogPage() {
    const root = document.getElementById('engine-catalog-root');
    if (!root || !window.getAllEngineBrands || !window.EngineCatalog) return;

    const brands = window.getAllEngineBrands();
    root.innerHTML = brands
      .map(b => window.EngineCatalog.renderEngineCatalogSection(b, { showHeader: true }))
      .join('');

    const countEl = document.getElementById('engine-catalog-count');
    if (countEl && window.getEngineModelCount) {
      countEl.textContent = window.getEngineModelCount();
    }

    const bar = document.querySelector('.filter-group');
    if (!bar) return;

    const buttons = bar.querySelectorAll('.filter-btn');
    const items = root.querySelectorAll('.engine-model');

    function applyFilter(filter) {
      let visible = 0;
      items.forEach(item => {
        const tags = (item.dataset.filterTags || '').split(/\s+/);
        const show = filter === 'all' || tags.includes(filter);
        item.classList.toggle('hidden', !show);
        if (show) visible++;
      });
      if (countEl) {
        countEl.textContent = filter === 'all'
          ? window.getEngineModelCount()
          : visible;
      }
      root.querySelectorAll('.engine-catalog').forEach(section => {
        const sectionItems = section.querySelectorAll('.engine-model:not(.hidden)');
        section.classList.toggle('hidden', sectionItems.length === 0);
      });
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilter(btn.dataset.filter);
      });
    });
  }

  function initPlatformOffices() {
    const el = document.getElementById('platform-offices');
    const config = window.ASIAPOWER;
    if (!el || !config) return;
    el.innerHTML = Object.values(config.offices).map(o => `
      <div class="platform-office">
        <strong>${o.flag} ${o.label}</strong>
        <p>${o.address}</p>
      </div>
    `).join('');
  }

  function initHomepageBrands() {
    const grid = document.getElementById('homepage-brands');
    const config = window.ASIAPOWER;
    if (!grid || !config) return;

    const slugs = config.homepageBrands || [];
    const brands = slugs
      .map(slug => config.brandsDirectory.find(b => b.slug === slug))
      .filter(Boolean);

    grid.innerHTML = brands.map(brand => {
      const url = brandProductUrl(brand);
      const initial = brand.name.charAt(0);
      const active = brand.landingPage ? ' platform-brand--active' : '';
      return `
        <a href="${url}" class="platform-brand${active}">
          <span class="platform-brand__initial">${initial}</span>
          <span class="platform-brand__name">${brand.name}</span>
        </a>`;
    }).join('');
  }

  const BRAND_PRODUCT_SEARCH = [
    {
      label: 'Gearboxes',
      terms: ['gearbox', 'gearboxes', 'transmission', 'transmissions', 'cvt', 'automatic', 'manual', 'dsg', '4wd', 'awd', 'steptronic', 'zf'],
    },
    {
      label: 'Half-Cuts',
      terms: ['half-cut', 'half cut', 'halfcut', 'half-cuts', 'half cuts', 'nose cut', 'front cut', 'rear cut'],
    },
    {
      label: 'Chassis Parts',
      terms: ['chassis', 'suspension', 'steering', 'brake', 'brakes', 'axle', 'control arm', 'chassis parts', 'chassis part'],
    },
    {
      label: 'Engines',
      terms: ['engine', 'engines', 'motor', 'motors'],
    },
  ];

  function normalizeBrandSearch(value) {
    return String(value || '').toLowerCase().replace(/[\s-]/g, '');
  }

  function findEngineModelMatch(models, query) {
    const q = query.toLowerCase().trim();
    const qNorm = normalizeBrandSearch(q);
    if (!qNorm) return null;

    let best = null;
    let bestScore = -1;

    models.forEach(model => {
      const modelLower = model.toLowerCase();
      const modelNorm = normalizeBrandSearch(model);
      const matches = modelLower.includes(q) || modelNorm.includes(qNorm);
      if (!matches) return;

      let score = 0;
      if (modelNorm === qNorm) score += 100;
      if (modelNorm.startsWith(qNorm) || modelLower.startsWith(q)) score += 50;
      score += Math.max(0, 40 - modelNorm.length);
      if (score > bestScore) {
        bestScore = score;
        best = model;
      }
    });

    return best;
  }

  function findProductCategoryMatch(query) {
    const q = query.toLowerCase().trim();
    if (!q) return null;

    for (const category of BRAND_PRODUCT_SEARCH) {
      const matched = category.terms.some(term => q.includes(term) || term.includes(q));
      if (matched) return category.label;
    }
    return null;
  }

  function getBrandSearchMatch(brand, query) {
    if (!query) return { show: true, label: null };

    const q = query.toLowerCase().trim();
    const name = brand.name.toLowerCase();
    const slug = brand.slug.toLowerCase();

    if (name.includes(q) || slug.includes(q)) {
      return { show: true, label: null };
    }

    const engineMatch = findEngineModelMatch(brand.engineModels || [], q);
    if (engineMatch) {
      return { show: true, label: engineMatch };
    }

    const productMatch = findProductCategoryMatch(q);
    if (productMatch) {
      return { show: true, label: productMatch };
    }

    return { show: false, label: null };
  }

  function updateBrandMatchLabel(el, label) {
    const matchEl = el.querySelector('.brand-search-match');
    if (!matchEl) return;
    if (label) {
      matchEl.textContent = `Matched: ${label}`;
      matchEl.classList.remove('hidden');
    } else {
      matchEl.textContent = '';
      matchEl.classList.add('hidden');
    }
  }

  function brandProductUrl(brand) {
    if (brand.landingPage) return brand.landingPage;
    return `contact.html?brand=${encodeURIComponent(brand.slug)}`;
  }

  function renderFeaturedBrandCard(brand) {
    const initial = brand.name.charAt(0);
    const url = brandProductUrl(brand);
    const cta = brand.landingPage ? 'View Brand Directory' : 'Request Quote';

    return `
      <article class="brand-card brand-card--featured-lg" data-brand-slug="${brand.slug}" id="brand-featured-${brand.slug}">
        <div class="brand-card__inner">
          <span class="brand-card__badge">Featured</span>
          <div class="brand-card__header">
            <h2 class="brand-card__name">${brand.name}</h2>
            <span class="brand-card__initial" aria-hidden="true">${initial}</span>
          </div>
          <p class="brand-search-match hidden" aria-live="polite"></p>
          <p class="brand-card__summary">Engines · Gearboxes · Chassis Parts · Half-Cuts</p>
          <a href="${url}" class="brand-card__action brand-card__action--featured">${cta} →</a>
        </div>
      </article>`;
  }

  function renderBrandTile(brand) {
    const initial = brand.name.charAt(0);
    const url = brandProductUrl(brand);
    const active = brand.landingPage ? ' brand-tile--active' : '';

    return `
      <a href="${url}" class="brand-tile${active}" data-brand-slug="${brand.slug}" id="brand-${brand.slug}">
        <span class="brand-tile__initial" aria-hidden="true">${initial}</span>
        <span class="brand-tile__content">
          <span class="brand-tile__name">${brand.name}</span>
          <span class="brand-search-match hidden" aria-live="polite"></span>
        </span>
      </a>`;
  }

  function renderBrandCard(brand, config) {
    const products = config.brandProducts.map(p =>
      `<li><span class="brand-card__check" aria-hidden="true">✓</span> ${p}</li>`
    ).join('');
    const initial = brand.name.charAt(0);
    const featuredClass = brand.featured ? ' brand-card--featured' : '';
    const badge = brand.featured ? '<span class="brand-card__badge">Priority</span>' : '';
    const url = brandProductUrl(brand);
    const searchName = brand.name.toLowerCase();

    return `
      <article class="brand-card${featuredClass}" data-brand-name="${searchName}" data-brand-slug="${brand.slug}" id="brand-${brand.slug}">
        ${badge}
        <div class="brand-card__inner">
          <div class="brand-card__header">
            <h2 class="brand-card__name">${brand.name}</h2>
            <span class="brand-card__initial" aria-hidden="true">${initial}</span>
          </div>
          <div class="brand-card__products-label">Available Products</div>
          <ul class="brand-card__products">${products}</ul>
          <a href="${url}" class="brand-card__action">${brand.landingPage ? 'View Brand' : 'View Products'}</a>
        </div>
      </article>`;
  }

  function initBrandDirectory() {
    const matrix = document.getElementById('brand-matrix');
    const featuredMatrix = document.getElementById('brand-featured-matrix');
    const config = window.ASIAPOWER;
    if (!matrix && !featuredMatrix) return;
    if (!config || !Array.isArray(config.brandsDirectory) || !Array.isArray(config.brandProducts)) {
      console.error('AsiaPower: brandsDirectory data missing — check js/config.js');
      return;
    }

    const brands = config.brandsDirectory;
    const featuredSlugs = config.featuredBrandSlugs || [];
    const featuredBrands = featuredSlugs
      .map(slug => brands.find(b => b.slug === slug))
      .filter(Boolean);

    try {
      if (featuredMatrix) {
        featuredMatrix.innerHTML = featuredBrands.map(brand => renderFeaturedBrandCard(brand)).join('');
      }
      if (matrix) {
        matrix.innerHTML = brands.map(brand => renderBrandTile(brand)).join('');
      }
    } catch (err) {
      console.error('AsiaPower: failed to render brand directory', err);
      return;
    }

    const totalEl = document.getElementById('brand-total-count');
    const visibleEl = document.getElementById('brand-visible-count');
    const countMetric = document.getElementById('brand-count-metric');
    const emptyEl = document.getElementById('brands-empty');
    const searchInput = document.getElementById('brand-search');
    const featuredSection = document.querySelector('.brands-section--featured');

    const brandBySlug = Object.fromEntries(brands.map(brand => [brand.slug, brand]));
    const whatsappUrl = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(config.whatsappMessage)}`;

    if (totalEl) totalEl.textContent = brands.length;
    if (visibleEl) visibleEl.textContent = brands.length;
    if (countMetric) countMetric.textContent = brands.length;
    if (emptyEl) {
      emptyEl.classList.add('hidden');
      emptyEl.innerHTML = `<p>No matching brand or engine model found. Please <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">send us a WhatsApp inquiry</a>.</p>`;
    }

    function filterBrands() {
      const query = (searchInput?.value || '').trim();
      let visible = 0;
      let featuredVisible = 0;

      matrix?.querySelectorAll('.brand-tile').forEach(tile => {
        const brand = brandBySlug[tile.dataset.brandSlug || ''];
        const result = brand ? getBrandSearchMatch(brand, query) : { show: !query, label: null };
        tile.classList.toggle('hidden', !result.show);
        tile.style.display = result.show ? '' : 'none';
        updateBrandMatchLabel(tile, query ? result.label : null);
        if (result.show) visible++;
      });

      featuredMatrix?.querySelectorAll('.brand-card').forEach(card => {
        const brand = brandBySlug[card.dataset.brandSlug || ''];
        const result = brand ? getBrandSearchMatch(brand, query) : { show: !query, label: null };
        card.classList.toggle('hidden', !result.show);
        card.style.display = result.show ? '' : 'none';
        updateBrandMatchLabel(card, query ? result.label : null);
        if (result.show) featuredVisible++;
      });

      if (featuredSection) {
        featuredSection.classList.toggle('hidden', query.length > 0 && featuredVisible === 0);
      }
      if (visibleEl) visibleEl.textContent = visible;
      if (emptyEl) emptyEl.classList.toggle('hidden', visible > 0);
    }

    if (searchInput) {
      searchInput.addEventListener('input', filterBrands);
      searchInput.addEventListener('search', filterBrands);
    }
  }

  function initBrandDetailNav() {
    const nav = document.querySelector('.brand-detail-nav');
    if (!nav) return;

    const links = nav.querySelectorAll('.brand-detail-nav__link');
    const sections = Array.from(links).map(link => {
      const id = link.getAttribute('href')?.slice(1);
      return id ? document.getElementById(id) : null;
    }).filter(Boolean);

    function setActive() {
      const scrollY = window.scrollY + 120;
      let current = sections[0];
      sections.forEach(section => {
        if (section.offsetTop <= scrollY) current = section;
      });
      links.forEach(link => {
        const id = link.getAttribute('href')?.slice(1);
        link.classList.toggle('active', id === current?.id);
      });
    }

    window.addEventListener('scroll', setActive, { passive: true });
    setActive();
  }

  function initWhatsAppAnalytics() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href*="wa.me"]');
      if (!link) return;
      const payload = {
        eventType: 'whatsapp_click',
        page: window.location.pathname + window.location.search,
        href: link.href,
        label: (link.getAttribute('aria-label') || link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        timestamp: new Date().toISOString(),
      };
      const body = JSON.stringify(payload);
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics/event', new Blob([body], { type: 'application/json' }));
        } else {
          fetch('/api/analytics/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // analytics must not block navigation
      }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initFAQ();
    initFilters();
    initURLFilters();
    initForms();
    initHeaderShadow();
    initCategoryGrid();
    initStatsStrip();
    initBrandsMarquee();
    initBrandDirectory();
    initBrandDetailNav();
    initPlatformOffices();
    initHomepageBrands();
    initEngineCatalogPage();
    initWhatsAppAnalytics();
  });

  window.addEventListener('load', () => {
    const matrix = document.getElementById('brand-matrix');
    if (matrix && matrix.children.length === 0) {
      initBrandDirectory();
    }
  });

  window.addEventListener('asiapower:layoutrefresh', initMobileNav);
})();

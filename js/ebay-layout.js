/**
 * AsiaPower — eBay Motors layout shell for all public pages
 */
(function () {
  'use strict';

  function siteBase() {
    if (window.SitePaths) return window.SitePaths.base();
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (!segments.length) return '';
    const last = segments[segments.length - 1];
    const isPageFile = last.includes('.');
    const depth = isPageFile ? segments.length - 1 : segments.length;
    return depth ? '../'.repeat(depth) : '';
  }

  function href(path) {
    if (!path || path.startsWith('http') || path.startsWith('mailto') || path.startsWith('#')) return path;
    return siteBase() + path;
  }

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  const SIDEBAR_FALLBACK = [
    { href: 'half-cuts/', labelKey: 'ebay.catHalfCuts', label: 'Half-Cuts', id: 'halfcuts', icon: 'halfcuts' },
    { href: 'trucks/', labelKey: 'ebay.catTrucks', label: 'Trucks', id: 'trucks', icon: 'trucks' },
    { href: 'engines/', labelKey: 'ebay.catParts', label: 'Engines & Parts', id: 'parts', icon: 'parts' },
    { href: 'machinery/', labelKey: 'ebay.catMachinery', label: 'Construction Machinery', id: 'machinery', icon: 'machinery' },
    { href: 'half-cuts/?cat=used-cars', labelKey: 'ebay.catUsedCars', label: 'Export Used Cars', id: 'used-cars', icon: 'cars' },
  ];

  const SIDEBAR_ICONS = {
    halfcuts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    trucks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/></svg>',
    parts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/></svg>',
    machinery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2M6 17v2M18 17v2"/></svg>',
    cars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 17h14v-5l-2-5H7L5 12v5z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  };

  function sidebarItems() {
    return window.EBAY_CATALOG_SIDEBAR?.length ? window.EBAY_CATALOG_SIDEBAR : SIDEBAR_FALLBACK;
  }

  const CATALOG_CATEGORY_TITLES = {
    'used-cars': 'ebay.catUsedCars',
    halfcuts: 'ebay.catHalfCuts',
    trucks: 'ebay.catTrucks',
    machinery: 'ebay.catMachinery',
  };

  function catalogCategoryFromUrl() {
    const path = String(window.location.pathname || '').toLowerCase();
    if (/\/trucks\/?$/.test(path) || path.endsWith('/trucks/index.html')) return 'trucks';
    if (/\/machinery\/?$/.test(path) || path.endsWith('/machinery/index.html')) return 'machinery';
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('cat');
    if (cat && CATALOG_CATEGORY_TITLES[cat]) return cat;
    const q = decodeURIComponent((params.get('q') || '').replace(/\+/g, ' ')).toLowerCase().trim();
    if (['used car', 'usedcar', 'used-car', 'used-cars', '二手车', '出口二手车'].includes(q)) return 'used-cars';
    if (['truck', 'trucks', '卡车'].includes(q)) return 'trucks';
    if (['machinery', '工程机械', 'excavator'].includes(q)) return 'machinery';
    if (['half cut', 'half-cut', 'halfcuts', '半切车'].includes(q)) return 'halfcuts';
    return 'halfcuts';
  }

  const CATALOG_PAGE_IDS = new Set(['halfcuts', 'trucks', 'machinery']);
  const PARTS_CATALOG_PAGE_IDS = new Set(['engines', 'gearboxes', 'chassis', 'frontcuts']);

  function isCatalogHubPage() {
    return CATALOG_PAGE_IDS.has(pageId());
  }

  function isPartsCatalogPage() {
    return PARTS_CATALOG_PAGE_IDS.has(pageId());
  }

  function isEbayCatalogPage() {
    return isCatalogHubPage() || isPartsCatalogPage();
  }

  const PAGE_META = {
    home: { layout: 'home' },
    halfcuts: { layout: 'category', title: 'Half-Cuts', hub: 'Export Parts & Vehicles' },
    engines: { layout: 'category', title: 'Engines & Parts', hub: 'Export Parts & Vehicles' },
    gearboxes: { layout: 'category', title: 'Gearboxes', hub: 'Export Parts & Vehicles' },
    chassis: { layout: 'category', title: 'Chassis Parts', hub: 'Export Parts & Vehicles' },
    frontcuts: { layout: 'category', title: 'Front Cut', hub: 'Export Parts & Vehicles' },
    'halfcut-detail': { layout: 'detail', title: 'Half-Cut Detail', hub: 'Half-Cuts' },
    'engine-detail': { layout: 'detail', title: 'Engine Detail', hub: 'Engines' },
    brands: { layout: 'static', title: 'Brand Directory', hub: 'Export Parts & Vehicles' },
    contact: { layout: 'static', title: 'Contact Us', hub: 'AsiaPower' },
    about: { layout: 'static', title: 'About Us', hub: 'AsiaPower' },
    supplier: { layout: 'static', title: 'Supplier Portal', hub: 'AsiaPower' },
  };

  function pageId() {
    return document.body.dataset.page || '';
  }

  function activeCategoryId() {
    const id = pageId();
    if (id === 'engines' || id === 'gearboxes' || id === 'chassis' || id === 'frontcuts') return 'parts';
    if (id.startsWith('brand-')) return 'used-cars';
    if (id === 'halfcut-detail') return 'halfcuts';
    if (id === 'halfcuts') return catalogCategoryFromUrl();
    if (id === 'trucks') return 'trucks';
    if (id === 'machinery') return 'machinery';
    return id;
  }

  function metaForPage() {
    const id = pageId();
    if (id === 'halfcuts') {
      const cat = catalogCategoryFromUrl();
      return {
        layout: 'category',
        title: t(CATALOG_CATEGORY_TITLES[cat], 'Half-Cuts'),
        hub: 'Export Parts & Vehicles',
        catalogCategory: cat,
      };
    }
    if (id === 'trucks') {
      return {
        layout: 'category',
        title: t('ebay.catTrucks', 'Trucks'),
        hub: 'Export Parts & Vehicles',
        catalogCategory: 'trucks',
      };
    }
    if (id === 'machinery') {
      return {
        layout: 'category',
        title: t('ebay.catMachinery', 'Construction Machinery'),
        hub: 'Export Parts & Vehicles',
        catalogCategory: 'machinery',
      };
    }
    if (id === 'engines') {
      return {
        layout: 'category',
        title: t('engines.title', 'Engine Model Catalog'),
        hub: 'Export Parts & Vehicles',
      };
    }
    if (id === 'gearboxes') {
      return {
        layout: 'category',
        title: t('gearboxes.title', 'Gearbox Catalog'),
        hub: 'Export Parts & Vehicles',
      };
    }
    if (id === 'chassis') {
      return {
        layout: 'category',
        title: t('catalog.chassis', 'Chassis Parts'),
        hub: 'Export Parts & Vehicles',
      };
    }
    if (id === 'frontcuts') {
      return {
        layout: 'category',
        title: t('parts.submoduleFrontCut', 'Front Cut'),
        hub: 'Export Parts & Vehicles',
      };
    }
    if (id.startsWith('brand-')) {
      const brand = id.replace('brand-', '');
      const name = brand.charAt(0).toUpperCase() + brand.slice(1).replace(/-/g, ' ');
      return { layout: 'detail', title: name, hub: 'Brand Directory', brand };
    }
    return PAGE_META[id] || { layout: 'static', title: document.title.split('|')[0].trim(), hub: 'AsiaPower' };
  }

  function renderSidebarListHtml(activeId) {
    return sidebarItems().map((item) => {
      const iconKey = item.icon || item.id || 'halfcuts';
      const icon = SIDEBAR_ICONS[iconKey] || SIDEBAR_ICONS.halfcuts;
      const count = item.count != null ? `<span class="ebay-sidebar__cat-count">${item.count}</span>` : '';
      return `<li><a href="${href(item.href)}"${item.id === activeId ? ' class="is-active"' : ''}><span class="ebay-sidebar__cat-icon">${icon}</span><span class="ebay-sidebar__cat-label" data-i18n="${item.labelKey}">${t(item.labelKey, item.label)}</span>${count}</a></li>`;
    }).join('');
  }

  function syncSidebar(activeId) {
    document.querySelectorAll('.ebay-sidebar__list').forEach((list) => {
      list.innerHTML = renderSidebarListHtml(activeId);
    });
    const pub = window.PublicI18n;
    if (pub?.applyDataI18n) {
      document.querySelectorAll('.ebay-sidebar').forEach((el) => pub.applyDataI18n(el));
    }
    syncTruckSidebarForPage(activeId);
    syncPartsSidebarForPage(activeId);
  }

  function truckSidebarRoute(activeId) {
    const category = activeId === 'trucks' ? 'trucks' : catalogCategoryFromUrl();
    if (category !== 'trucks') return { category: 'halfcuts' };
    return {
      category: 'trucks',
      brand: new URLSearchParams(window.location.search).get('brand') || '',
      searchQuery: '',
    };
  }

  function syncTruckSidebarForPage(activeId) {
    const route = truckSidebarRoute(activeId);
    window.AsiaPowerEbayCatalogHub?.syncTruckSidebarSubmodules?.(route);
  }

  const PARTS_SUBMODULES = [
    { id: 'engines', labelKey: 'parts.submoduleEngines', label: 'Engines', href: 'engines/' },
    { id: 'gearboxes', labelKey: 'parts.submoduleGearboxes', label: 'Gearboxes', href: 'gearboxes/' },
    { id: 'chassis', labelKey: 'parts.submoduleChassis', label: 'Chassis', href: 'chassis-parts/' },
    { id: 'frontcut', labelKey: 'parts.submoduleFrontCut', label: 'Front cut', href: 'front-cuts/' },
  ];

  function activePartsSubmoduleId() {
    const id = pageId();
    if (id === 'engines') return 'engines';
    if (id === 'gearboxes') return 'gearboxes';
    if (id === 'chassis') return 'chassis';
    if (id === 'frontcuts') return 'frontcut';
    return '';
  }

  function showPartsSubmodules(activeId) {
    return activeId === 'parts' || isPartsCatalogPage();
  }

  function syncPartsSidebarForPage(activeId) {
    const show = showPartsSubmodules(activeId);
    document.querySelectorAll('[data-ebay-parts-submodules]').forEach((wrap) => {
      if (!show) {
        wrap.hidden = true;
        return;
      }
      const activeSubmodule = activePartsSubmoduleId();
      const items = PARTS_SUBMODULES.map((sub) => {
        const active = sub.id === activeSubmodule ? ' class="is-active"' : '';
        return `<li><a href="${href(sub.href)}"${active} data-i18n="${sub.labelKey}">${t(sub.labelKey, sub.label)}</a></li>`;
      }).join('');
      const list = wrap.querySelector('.ebay-sidebar__submodules-list');
      if (list) list.innerHTML = items;
      wrap.hidden = false;
      window.PublicI18n?.applyDataI18n?.(wrap);
    });
  }

  function renderPartsSidebarSubmodulesBlock(activeId) {
    const show = showPartsSubmodules(activeId);
    if (!show) {
      return `
        <div class="ebay-sidebar__submodules" data-ebay-parts-submodules hidden>
          <ul class="ebay-sidebar__submodules-list"></ul>
        </div>`;
    }
    const activeSubmodule = activePartsSubmoduleId();
    const items = PARTS_SUBMODULES.map((sub) => {
      const active = sub.id === activeSubmodule ? ' class="is-active"' : '';
      return `<li><a href="${href(sub.href)}"${active} data-i18n="${sub.labelKey}">${t(sub.labelKey, sub.label)}</a></li>`;
    }).join('');
    return `
        <div class="ebay-sidebar__submodules" data-ebay-parts-submodules aria-label="${t('parts.submoduleNav', 'Parts categories')}">
          <ul class="ebay-sidebar__submodules-list">${items}</ul>
        </div>`;
  }

  function ensureSidebarPartsSubmodulesBlock(sidebar, activeId) {
    if (!sidebar) return;
    let block = sidebar.querySelector('[data-ebay-parts-submodules]');
    if (!block) {
      const truckBlock = sidebar.querySelector('[data-ebay-truck-submodules]');
      const html = renderPartsSidebarSubmodulesBlock(activeId);
      if (truckBlock) truckBlock.insertAdjacentHTML('afterend', html);
      else {
        const models = sidebar.querySelector('[data-ebay-sidebar-models]');
        if (models) models.insertAdjacentHTML('beforebegin', html);
        else sidebar.insertAdjacentHTML('beforeend', html);
      }
      block = sidebar.querySelector('[data-ebay-parts-submodules]');
    }
    syncPartsSidebarForPage(activeId);
  }

  function renderSidebarSubmodulesBlock(activeId) {
    const showTrucks = activeId === 'trucks' || catalogCategoryFromUrl() === 'trucks';
    if (!showTrucks) {
      return `
        <div class="ebay-sidebar__submodules" data-ebay-truck-submodules hidden>
          <ul class="ebay-sidebar__submodules-list"></ul>
        </div>`;
    }
    const part = new URLSearchParams(window.location.search).get('part') || 'all';
    const subs = [
      { id: 'all', labelKey: 'trucks.submoduleAll', label: 'All', href: 'trucks/' },
      { id: 'whole', labelKey: 'trucks.submoduleWhole', label: 'Whole vehicle', href: 'trucks/?part=whole' },
      { id: 'engine', labelKey: 'trucks.submoduleEngine', label: 'Engine', href: 'trucks/?part=engine' },
      { id: 'axle', labelKey: 'trucks.submoduleAxle', label: 'Axle', href: 'trucks/?part=axle' },
      { id: 'head', labelKey: 'trucks.submoduleHead', label: 'Truck head', href: 'trucks/?part=head' },
    ];
    const items = subs.map((sub) => {
      const active = sub.id === part ? ' class="is-active"' : '';
      return `<li><a href="${href(sub.href)}"${active} data-i18n="${sub.labelKey}">${t(sub.labelKey, sub.label)}</a></li>`;
    }).join('');
    return `
        <div class="ebay-sidebar__submodules" data-ebay-truck-submodules aria-label="${t('trucks.submoduleNav', 'Truck part categories')}">
          <ul class="ebay-sidebar__submodules-list">${items}</ul>
        </div>`;
  }

  function ensureSidebarSubmodulesBlock(sidebar, activeId) {
    if (!sidebar) return;
    let block = sidebar.querySelector('[data-ebay-truck-submodules]');
    if (!block) {
      const models = sidebar.querySelector('[data-ebay-sidebar-models]');
      const html = renderSidebarSubmodulesBlock(activeId);
      if (models) models.insertAdjacentHTML('beforebegin', html);
      else sidebar.insertAdjacentHTML('beforeend', html);
      block = sidebar.querySelector('[data-ebay-truck-submodules]');
    }
    syncTruckSidebarForPage(activeId);
  }

  function renderSidebarModelsBlock() {
    return `
        <div class="ebay-sidebar__models" data-ebay-sidebar-models hidden>
          <h3 class="ebay-sidebar__models-title" data-ebay-sidebar-models-title></h3>
          <ul class="ebay-sidebar__model-list" data-ebay-model-list></ul>
        </div>`;
  }

  function ensureSidebarModelsBlock(sidebar) {
    if (!sidebar || sidebar.querySelector('[data-ebay-sidebar-models]')) return;
    sidebar.insertAdjacentHTML('beforeend', renderSidebarModelsBlock());
  }

  function ensureSidebarBrandsBlock(sidebar) {
    if (!sidebar || sidebar.querySelector('[data-ebay-sidebar-brands]')) return;
    const models = sidebar.querySelector('[data-ebay-sidebar-models]');
    const html = `
      <div class="ebay-sidebar__brands" data-ebay-sidebar-brands hidden>
        <h3 class="ebay-sidebar__models-title" data-ebay-sidebar-brands-title>${t('filter.make', 'Brand')}</h3>
        <ul class="ebay-sidebar__brand-list" data-ebay-brand-list></ul>
      </div>`;
    if (models) models.insertAdjacentHTML('beforebegin', html);
    else sidebar.insertAdjacentHTML('beforeend', html);
  }

  function refreshCatalogSidebarModels() {
    window.AsiaPowerEbayCatalogHub?.refreshSidebarModels?.();
  }

  function renderSidebar(activeId) {
    return `
      <aside class="ebay-sidebar ebay-sidebar--v4" aria-label="${t('ebay.browseByCategory', 'Browse by category')}">
        <h2 class="ebay-sidebar__title">${t('ebay.browseByCategory', 'Browse by category')}</h2>
        <ul class="ebay-sidebar__list">${renderSidebarListHtml(activeId)}</ul>
        ${renderSidebarSubmodulesBlock(activeId)}
        ${renderPartsSidebarSubmodulesBlock(activeId)}
        <div class="ebay-sidebar__brands" data-ebay-sidebar-brands hidden>
          <h3 class="ebay-sidebar__models-title" data-ebay-sidebar-brands-title>${t('filter.make', 'Brand')}</h3>
          <ul class="ebay-sidebar__brand-list" data-ebay-brand-list></ul>
        </div>
        ${renderSidebarModelsBlock()}
      </aside>`;
  }

  function parseBreadcrumb(heroEl) {
    const bc = heroEl?.querySelector('.page-hero__breadcrumb');
    if (!bc) return null;
    const parts = [];
    bc.querySelectorAll('a').forEach((a) => parts.push({ text: a.textContent.trim(), href: a.getAttribute('href') }));
    const last = bc.querySelector('span');
    if (last) parts.push({ text: last.textContent.trim(), current: true });
    return parts;
  }

  function renderBreadcrumb(parts, fallback) {
    if (parts && parts.length) {
      const items = parts.map((p, i) => {
        if (p.current || i === parts.length - 1) {
          return `<li aria-current="page">${p.text}</li>`;
        }
        const h = p.href ? (p.href.startsWith('http') ? p.href : href(p.href.replace(/^\.\.\//, ''))) : href('index.html');
        return `<li><a href="${h}">${p.text}</a></li>`;
      }).join('');
      return `<nav class="ebay-breadcrumb" aria-label="Breadcrumb"><ol>${items}</ol></nav>`;
    }
    return `
      <nav class="ebay-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="${href('index.html')}">AsiaPower</a></li>
          <li><a href="${href('half-cuts/')}">${fallback.hub}</a></li>
          <li aria-current="page">${fallback.title}</li>
        </ol>
      </nav>`;
  }

  function routeSearch(raw) {
    const q = String(raw || '').trim();
    if (!q) return;
    if (window.SitePaths?.isSupplierUploadSearch?.(q)) {
      window.location.href = window.SitePaths.supplierPortalHref();
      return;
    }
    window.AsiaPowerSearchTrends?.recordSearch?.(q);
    const upper = q.toUpperCase();
    if (/^(HC|UV)\d/i.test(upper)) {
      window.location.href = href(`half-cuts/?q=${encodeURIComponent(q)}`);
      return;
    }
    if (/^(ENG|GB|CH)-/i.test(upper) || /\b[0-9][A-Z]{1,3}-[A-Z0-9]{2,}/i.test(q)) {
      window.location.href = href(`engines/?q=${encodeURIComponent(q)}`);
      return;
    }
    window.location.href = href(`half-cuts/?q=${encodeURIComponent(q)}`);
  }

  function bindSearch() {
    document.querySelectorAll('[data-ebay-search]').forEach((form) => {
      if (form.dataset.ebayBound) return;
      form.dataset.ebayBound = '1';
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="search"]');
        routeSearch(input?.value);
      });
    });
  }

  function bindCarousels() {
    document.querySelectorAll('[data-carousel]').forEach((root) => {
      if (root.dataset.carouselBound) return;
      root.dataset.carouselBound = '1';
      const track = root.querySelector('[data-carousel-track]');
      const step = () => {
        const card = track?.querySelector('.ebay-card');
        return card ? card.offsetWidth + 12 : 180;
      };
      root.querySelector('[data-carousel-prev]')?.addEventListener('click', () => {
        track?.scrollBy({ left: -step() * 3, behavior: 'smooth' });
      });
      root.querySelector('[data-carousel-next]')?.addEventListener('click', () => {
        track?.scrollBy({ left: step() * 3, behavior: 'smooth' });
      });
    });
  }

  function migrateInnerHero(main) {
    const intro = main.querySelector('.ebay-page__intro');
    const contentHost = main.querySelector('.ebay-main');
    if (!intro || !contentHost) return;

    const hero = contentHost.querySelector('.page-hero');
    if (!hero || hero.dataset.ebayMigrated) return;

    const titleEl = hero.querySelector('h1');
    const bcParts = parseBreadcrumb(hero);

    if (titleEl) {
      const h1 = intro.querySelector('.ebay-page-title');
      if (h1) h1.textContent = titleEl.textContent.trim();
    }
    intro.querySelector('.ebay-page-lead')?.remove();
    if (bcParts && bcParts.length) {
      const bcNav = intro.querySelector('.ebay-breadcrumb');
      if (bcNav) bcNav.outerHTML = renderBreadcrumb(bcParts, {});
    }

    hero.remove();
    hero.dataset.ebayMigrated = '1';
  }

  function collectMainContentNodes(main) {
    return [...main.childNodes].filter((node) => {
      if (node.nodeType !== 1) return false;
      if (node.classList?.contains('page-hero')) return false;
      if (node.classList?.contains('cta-block')) return false;
      if (node.classList?.contains('ebay-page')) return false;
      return true;
    });
  }

  function extractWrappedContentNodes(main) {
    const host = main.querySelector('.ebay-main--product-detail, .ebay-main--content');
    if (host) return [...host.childNodes];
    return collectMainContentNodes(main);
  }

  function applyProductDetailShell(main) {
    if (main.dataset.ebayShell === 'detail-full') {
      bindSearch();
      return true;
    }

    const nodes = main.dataset.ebayShell === '1'
      ? extractWrappedContentNodes(main)
      : collectMainContentNodes(main);

    const shell = document.createElement('div');
    shell.className = 'ebay-page ebay-page--product-detail';
    shell.innerHTML = '<div class="ebay-main ebay-main--product-detail"></div>';
    const contentHost = shell.querySelector('.ebay-main');
    nodes.forEach((node) => contentHost.appendChild(node));

    main.innerHTML = '';
    main.appendChild(shell);
    main.dataset.ebayShell = 'detail-full';
    bindSearch();
    return true;
  }

  function applyShell() {
    if (!document.body.classList.contains('scheme-ebay')) return;
    const main = document.getElementById('main-content');
    if (!main) return;

    const meta = metaForPage();
    const activeId = activeCategoryId();
    syncSidebar(activeId);
    document.querySelectorAll('.ebay-sidebar').forEach((sidebar) => {
      sidebar.classList.add('ebay-sidebar--v4');
      ensureSidebarBrandsBlock(sidebar);
      ensureSidebarModelsBlock(sidebar);
      ensureSidebarSubmodulesBlock(sidebar, activeId);
      ensureSidebarPartsSubmodulesBlock(sidebar, activeId);
    });

    if (meta.layout === 'home') {
      bindSearch();
      bindCarousels();
      return;
    }

    if (pageId() === 'supplier') {
      bindSearch();
      return;
    }

    if (pageId() === 'halfcut-detail' || pageId() === 'engine-detail') {
      applyProductDetailShell(main);
      bindCarousels();
      return;
    }

    if (main.dataset.ebayShell === '1') {
      migrateInnerHero(main);
      if (isEbayCatalogPage()) {
        const titleEl = main.querySelector('.ebay-page-title');
        const bcNav = main.querySelector('.ebay-breadcrumb');
        if (titleEl) titleEl.textContent = meta.title;
        main.querySelector('.ebay-page-lead')?.remove();
        if (bcNav) bcNav.outerHTML = renderBreadcrumb(null, meta);
      }
      bindSearch();
      bindCarousels();
      if (isCatalogHubPage()) refreshCatalogSidebarModels();
      return;
    }

    const hero = main.querySelector('.page-hero');
    const titleEl = hero?.querySelector('h1');
    const title = isEbayCatalogPage() ? meta.title : (titleEl?.textContent?.trim() || meta.title);
    const breadcrumbParts = isEbayCatalogPage()
      ? null
      : parseBreadcrumb(hero);

    const contentNodes = collectMainContentNodes(main);

    const shell = document.createElement('div');
    shell.className = 'ebay-page';
    shell.innerHTML = `
      <div class="ebay-page__intro">
        ${renderBreadcrumb(breadcrumbParts, meta)}
        <h1 class="ebay-page-title">${title}</h1>
      </div>
      <div class="ebay-page__body">
        ${renderSidebar(activeId)}
        <div class="ebay-main ebay-main--content"></div>
      </div>`;

    const contentHost = shell.querySelector('.ebay-main');
    contentNodes.forEach((node) => contentHost.appendChild(node));

    main.innerHTML = '';
    main.appendChild(shell);
    main.dataset.ebayShell = '1';

    bindSearch();
    bindCarousels();
    if (isCatalogHubPage()) refreshCatalogSidebarModels();
  }

  function scheduleApply() {
    applyShell();
    window.setTimeout(applyShell, 100);
    window.setTimeout(applyShell, 600);
    window.setTimeout(applyShell, 1500);
  }

  window.addEventListener('asiapower:layoutrefresh', scheduleApply);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleApply);
  } else {
    scheduleApply();
  }

  window.AsiaPowerEbayLayout = { applyShell, syncSidebar, routeSearch, bindSearch, bindCarousels, catalogCategoryFromUrl };
})();

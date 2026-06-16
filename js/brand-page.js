/**
 * AsiaPower — Brand Detail Page Renderer
 */
(function () {
  'use strict';

  function base() {
    return window.SitePaths?.base?.() || (window.location.pathname.includes('/brands/') ? '../' : '');
  }

  function config() {
    return window.ASIAPOWER || null;
  }

  function quoteUrl(slug, product) {
    const q = product ? `&product=${encodeURIComponent(product)}` : '';
    return `${base()}contact.html?brand=${encodeURIComponent(slug)}${q}`;
  }

  function whatsappUrl(brandName, product) {
    const c = config();
    if (!c) return '#';
    let msg = `Hello AsiaPower, I would like to enquire about ${brandName} powertrain sourcing for export.`;
    if (product) msg += ` Engine/model: ${product}.`;
    return `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(msg)}`;
  }

  function engineUrl(brandSlug, code) {
    const page = window.SitePaths?.enginePagePath?.(brandSlug, code);
    if (page) return base() + page;
    return quoteUrl(brandSlug, code);
  }

  function renderOverview(brand) {
    return `
      <section class="brand-overview" id="overview">
        <div class="container">
          <div class="brand-overview__grid">
            <div class="brand-overview__main">
              <span class="section-eyebrow">Brand Overview</span>
              <h2>${brand.name} Powertrain Sourcing</h2>
              <p class="brand-overview__text">${brand.overview}</p>
              <ul class="brand-overview__points">
                <li>Engines, gearboxes, chassis parts and half-cuts</li>
                <li>FOB and CIF export to global destinations</li>
                <li>Inspection documentation on request</li>
                <li>Availability depends on supplier network and current stock</li>
              </ul>
            </div>
            <aside class="brand-overview__aside">
              <div class="brand-overview__stat">
                <span class="brand-overview__stat-value">${brand.popularEngines.length}+</span>
                <span class="brand-overview__stat-label">Engine Models Listed</span>
              </div>
              <div class="brand-overview__stat">
                <span class="brand-overview__stat-value">4</span>
                <span class="brand-overview__stat-label">Product Categories</span>
              </div>
              <div class="brand-overview__stat">
                <span class="brand-overview__stat-value">${brand.origin}</span>
                <span class="brand-overview__stat-label">Vehicle Origin</span>
              </div>
            </aside>
          </div>
        </div>
      </section>`;
  }

  function renderProductCategories(brand) {
    const categories = [
      {
        id: 'engines',
        title: 'Engines',
        desc: `Petrol, diesel and hybrid ${brand.name} engine units — compression tested with export documentation available on request.`,
        product: 'engines',
        catalog: `${base()}engines/index.html`,
      },
      {
        id: 'gearboxes',
        title: 'Gearboxes',
        desc: `Automatic, manual, CVT and 4WD ${brand.name} transmissions — shift-tested and export crated.`,
        product: 'gearboxes',
        catalog: `${base()}gearboxes/index.html`,
      },
      {
        id: 'chassis',
        title: 'Chassis Parts',
        desc: `${brand.name} suspension, steering, brake and drivetrain components for repair and fleet programs.`,
        product: 'chassis-parts',
        catalog: `${base()}chassis-parts/index.html`,
      },
      {
        id: 'halfcuts',
        title: 'Half-Cuts',
        desc: `${brand.name} front cuts, rear cuts, nose cuts and complete half-cuts for rebuild and extraction.`,
        product: 'half-cuts',
        catalog: `${base()}half-cuts/index.html`,
      },
    ];

    const cards = categories.map(cat => `
      <article class="brand-category-card" id="${cat.id}">
        <span class="brand-category-card__num">${cat.title}</span>
        <h3>${brand.name} ${cat.title}</h3>
        <p>${cat.desc}</p>
        <div class="brand-category-card__actions">
          <a href="${quoteUrl(brand.slug, cat.product)}" class="btn btn-navy btn-sm">Request Quote</a>
          <a href="${cat.catalog}" class="brand-category-card__link">Browse catalog →</a>
        </div>
      </article>
    `).join('');

    return `
      <section class="brand-detail-section brand-detail-section--alt" id="categories">
        <div class="container">
          <div class="brand-detail-section__header">
            <span class="section-eyebrow">Product Lines</span>
            <h2>Available Product Categories</h2>
            <p>Four sourcing categories for ${brand.name} — select a product line to request FOB/CIF pricing.</p>
          </div>
          <div class="brand-category-grid">${cards}</div>
        </div>
      </section>`;
  }

  function renderEngineCard(brand, code) {
    const url = engineUrl(brand.slug, code);
    return `
      <article class="brand-engine-card">
        <div class="brand-engine-card__header">
          <h3 class="brand-engine-card__code"><a href="${url}">${code}</a></h3>
          <span class="brand-engine-card__status">Available on Request</span>
        </div>
        <p class="brand-engine-card__note">Availability depends on supplier network and current stock.</p>
        <div class="brand-engine-card__actions">
          <a href="${quoteUrl(brand.slug, code)}" class="btn btn-navy btn-sm">Request Quote</a>
          <a href="${whatsappUrl(brand.name, code)}" class="brand-engine-card__wa" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </article>`;
  }

  function renderPopularEngines(brand) {
    const engines = brand.popularEngines || [];
    const cards = engines.map(code => renderEngineCard(brand, code)).join('');

    return `
      <section class="brand-detail-section" id="engines">
        <div class="container">
          <div class="brand-detail-section__header">
            <span class="section-eyebrow">Engine Catalog</span>
            <h2>Popular ${brand.name} Engine Models</h2>
            <p>Commonly requested ${brand.name} engine codes for global export. All units are available on request — send your code for FOB/CIF quotation.</p>
          </div>
          <div class="brand-engine-grid">${cards}</div>
        </div>
      </section>`;
  }

  function renderQuoteSection(brand) {
    return `
      <section class="brand-quote-block" id="quote">
        <div class="container brand-quote-block__inner">
          <div class="brand-quote-block__text">
            <span class="section-eyebrow">Get Started</span>
            <h2>Request a ${brand.name} Sourcing Quote</h2>
            <p>Send your engine code, VIN, vehicle model or container requirements. Our sourcing team responds within 24 hours with FOB/CIF pricing.</p>
          </div>
          <div class="brand-quote-block__actions">
            <a href="${quoteUrl(brand.slug)}" class="btn btn-accent">Request Quote</a>
            <a href="${whatsappUrl(brand.name)}" class="btn btn-whatsapp" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Inquiry
            </a>
          </div>
        </div>
      </section>`;
  }

  function renderBrandPage(slug) {
    const catalog = window.BRAND_CATALOG;
    const brand = catalog?.[slug];
    const root = document.getElementById('brand-page-root');
    if (!brand || !root) {
      if (root) {
        root.innerHTML = `
          <section class="section">
            <div class="container">
              <h1>Brand Not Found</h1>
              <p>This brand page is being prepared. <a href="${base()}contact.html">Contact us</a> for sourcing assistance.</p>
            </div>
          </section>`;
      }
      return;
    }

    document.title = `${brand.name} — Engines, Gearboxes & Half-Cuts | AsiaPower`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = `AsiaPower supplies ${brand.name} engines, gearboxes, chassis parts and half-cuts for global export. Request a B2B sourcing quote.`;
    window.AsiaPowerSEO?.refresh?.();

    root.innerHTML = `
      <section class="brand-detail-hero">
        <div class="container">
          <div class="page-hero__breadcrumb">
            <a href="${base()}index.html">Home</a> /
            <a href="${base()}brands.html">Brands</a> /
            <span>${brand.name}</span>
          </div>
          <div class="brand-detail-hero__inner">
            <div class="brand-detail-hero__mark" aria-hidden="true">${brand.initial}</div>
            <div>
              <span class="brand-detail-hero__label">${brand.origin} · Global Powertrain Sourcing</span>
              <h1>${brand.name}</h1>
              <p class="brand-detail-hero__lead">${brand.lead}</p>
              <div class="brand-detail-hero__actions">
                <a href="${quoteUrl(brand.slug)}" class="btn btn-accent">Request ${brand.name} Quote</a>
                <a href="${whatsappUrl(brand.name)}" class="btn btn-outline-light" target="_blank" rel="noopener">WhatsApp Inquiry</a>
                <a href="${base()}brands.html" class="btn btn-ghost-light">All Brands</a>
              </div>
            </div>
          </div>
        </div>
      </section>
      <nav class="brand-detail-nav" aria-label="${brand.name} page sections">
        <div class="container brand-detail-nav__inner">
          <a href="#overview" class="brand-detail-nav__link">Overview</a>
          <a href="#categories" class="brand-detail-nav__link">Categories</a>
          <a href="#engines" class="brand-detail-nav__link">Engines</a>
          <a href="#quote" class="brand-detail-nav__link">Request Quote</a>
        </div>
      </nav>
      ${renderOverview(brand)}
      ${renderProductCategories(brand)}
      ${renderPopularEngines(brand)}
      ${renderQuoteSection(brand)}`;

    initBrandDetailNav();
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

  document.addEventListener('DOMContentLoaded', () => {
    const slug = document.body.dataset.brand;
    if (slug) renderBrandPage(slug);
  });
})();

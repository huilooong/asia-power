/**
 * AsiaPower — SEO Engine Detail Page Renderer
 */
(function () {
  'use strict';

  let currentSlug = '';

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function base() {
    return window.SitePaths ? window.SitePaths.base() : '../';
  }

  function absoluteUrl(path) {
    if (window.AsiaPowerSEO?.absoluteUrl) return window.AsiaPowerSEO.absoluteUrl(path);
    return new URL(path, window.location.href).href;
  }

  function upsertMeta(attr, key, content) {
    if (!content) return;
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.content = content;
  }

  function upsertJsonLd(id, data) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function quoteButton(engine, className, label) {
    window.CatalogLeadUtils?.ensureCatalogLeadScripts?.();
    const text = label || t('engine.requestQuote', 'Request Quote');
    return window.CatalogLeadUtils?.leadLink?.({
      category: 'engine',
      brand: engine.brand,
      brandSlug: engine.brandSlug,
      product: engine.code,
      intent: 'price',
      className: className || 'btn btn-accent',
      label: text,
    }) || `<a href="${base()}contact.html?brand=${engine.brandSlug}&product=${encodeURIComponent(engine.code)}" class="${className || 'btn btn-accent'}">${text}</a>`;
  }

  function exportStatusLabels() {
    const labels = window.ENGINE_EXPORT_STATUS || [
      'Available', 'Ready for Export', 'EXW Available', 'CIF Available',
    ];
    return labels.map(label => window.PublicI18n?.translateExportStatus?.(label) || label);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderEngineDetail(slug) {
    window.CatalogLeadUtils?.ensureCatalogLeadScripts?.();
    const engine = window.SEO_ENGINES?.[slug];
    const root = document.getElementById('engine-detail-root');
    if (!engine || !root) return;

    currentSlug = slug;
    document.title = engine.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = engine.description;
    window.AsiaPowerSEO?.refresh?.();

    const b = base();
    const canonical = absoluteUrl(`${b}engines/${engine.slug}.html`);
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;

    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:title', engine.title);
    upsertMeta('property', 'og:description', engine.description);

    const label = window.EngineCardLabel;
    const h1 = label?.formatEngineDetailH1?.(engine)
      || `${engine.brand} ${engine.code} ${engine.displacement || ''} ${engine.fuel || ''} Engine`.replace(/\s+/g, ' ').trim();
    const primaryLine = label?.formatEngineCodeDisplacementFuel?.(engine)
      || [engine.code, engine.displacement, engine.fuel].filter(Boolean).join(' · ');
    const vehicleList = label?.formatCompatibleVehiclesList?.(engine.applications, engine.brand) || [];
    const compatHtml = vehicleList.length
      ? `<section class="engine-detail__compat">
          <h2>${t('engine.compatibleVehicles', 'Compatible Vehicles')}</h2>
          <p class="engine-detail__compat-note">${t(
            'engine.compatDisclaimer',
            'Applications may vary by year, market and specification. Confirm by engine photo, engine number or VIN before ordering.',
          )}</p>
          <ul class="engine-detail__compat-list">
            ${vehicleList.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}
          </ul>
        </section>`
      : '';
    // Keep raw applications text only in muted note when unstructured leftovers exist
    const parsed = label?.parseStructuredApplications?.(engine.applications, engine.brand);
    const leftoverNote = parsed?.rejected?.length
      ? `<p class="engine-detail__apps-note">${escapeHtml(t('engine.applicationsNote', 'Additional application notes'))}: ${escapeHtml(parsed.rejected.join('; '))}</p>`
      : '';

    const seoTitle = `${h1.replace(/\s+Engine$/i, '')} Engine Supplier | AsiaPower`;
    const seoDesc = vehicleList.length
      ? `${h1}. Compatible vehicles may include ${vehicleList.slice(0, 4).join(', ')}. Confirm specification before ordering.`
      : `${h1}. Sourced for global export through AsiaPower. Confirm specification before ordering.`;

    document.title = seoTitle;
    if (meta) meta.content = seoDesc;
    upsertMeta('property', 'og:title', seoTitle);
    upsertMeta('property', 'og:description', seoDesc);

    upsertJsonLd('schema-engine-product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: h1,
      description: seoDesc,
      brand: { '@type': 'Brand', name: engine.brand },
      category: 'Used Automotive Engine',
      url: canonical,
      offers: {
        '@type': 'Offer',
        availability: 'https://schema.org/InStock',
        priceCurrency: 'USD',
        seller: { '@type': 'Organization', name: 'AsiaPower' },
      },
    });

    root.innerHTML = `
      <section class="page-hero page-hero--catalog">
        <div class="container">
          <div class="page-hero__breadcrumb">
            <a href="${b}index.html">${t('engine.home', 'Home')}</a> /
            <a href="${b}brands.html">${t('engine.brands', 'Brands')}</a> /
            <a href="${b}brands/${engine.brandSlug}.html">${engine.brand}</a> /
            <a href="${b}engines/">${t('engine.engines', 'Engines')}</a> /
            <span>${engine.code}</span>
          </div>
          <h1>${escapeHtml(h1)}</h1>
          ${window.InquiryCta?.render?.({ context: { product: `${engine.brand} ${engine.code}`, category: 'engine' }, variant: 'catalog-hero' }) || ''}
          <p>${escapeHtml(primaryLine)}. ${t('engine.sourcedFor', "Sourced for global export through AsiaPower's China-based supply network.")}</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="engine-detail">
            <div class="engine-detail__main">
              <span class="section-eyebrow">${engine.origin} · ${t('engine.engineModel', 'Engine Model')}</span>
              <h2 class="engine-detail__code">${escapeHtml(primaryLine)}</h2>
              <dl class="engine-detail__specs">
                <div><dt>${t('spec.brand', 'Brand')}</dt><dd><a href="${b}brands/${engine.brandSlug}.html">${engine.brand}</a></dd></div>
                <div><dt>${t('engine.displacement', 'Displacement')}</dt><dd>${engine.displacement || '—'}</dd></div>
                <div><dt>${t('engine.fuelType', 'Fuel Type')}</dt><dd>${engine.fuel || '—'}</dd></div>
              </dl>
              ${compatHtml}
              ${leftoverNote}
              <ul class="engine-model__status engine-detail__status" aria-label="${t('engine.exportAvailability', 'Export availability')}">
                ${exportStatusLabels().map(s => `<li class="engine-model__status-item">${s}</li>`).join('')}
              </ul>
              <div class="engine-detail__actions">
                ${quoteButton(engine, 'btn btn-accent')}
                <a href="${b}brands/${engine.brandSlug}.html#engines" class="btn btn-outline-navy">${t('engine.allBrandEngines', 'All')} ${engine.brand} ${t('engine.categoryEngines', 'Engines')}</a>
              </div>
              <ol class="hc-item-detail__process" aria-label="${t('hc.buyProcessTitle', 'How buying works')}">
                <li>${escapeHtml(t('hc.buyProcessInspect', 'Inspect — Confirm photos, VIN/engine code and condition before quote.'))}</li>
                <li>${escapeHtml(t('hc.buyProcessQuote', 'Quote — EXW price plus CIF options to your destination port on request.'))}</li>
                <li>${escapeHtml(t('hc.buyProcessLogistics', 'Logistics — Crating, export docs and ocean freight coordinated after order confirm.'))}</li>
                <li>${escapeHtml(t('hc.buyProcessPayment', 'Payment — Terms confirmed in writing before shipment; inventory held after deposit as agreed.'))}</li>
              </ol>
            </div>
            <aside class="engine-detail__aside">
              <h3>${t('engine.browseBrand', 'Browse')} ${engine.brand}</h3>
              <ul class="engine-detail__links">
                <li><a href="${b}brands/${engine.brandSlug}.html#engines">${engine.brand} ${t('engine.brandEngines', 'Engines')}</a></li>
                <li><a href="${b}brands/${engine.brandSlug}.html#gearboxes">${engine.brand} ${t('engine.brandGearboxes', 'Gearboxes')}</a></li>
                <li><a href="${b}brands/${engine.brandSlug}.html#chassis">${engine.brand} ${t('engine.brandChassis', 'Chassis Parts')}</a></li>
                <li><a href="${b}brands/${engine.brandSlug}.html#halfcuts">${engine.brand} ${t('engine.brandHalfCuts', 'Half-Cuts')}</a></li>
              </ul>
              <h3>${t('engine.productCatalog', 'Product Catalog')}</h3>
              <ul class="engine-detail__links">
                <li><a href="${b}engines/">${t('engine.allEngineModels', 'All Engine Models')}</a></li>
                <li><a href="${b}gearboxes/">${t('engine.gearboxes', 'Gearboxes')}</a></li>
                <li><a href="${b}half-cuts/">${t('engine.halfCuts', 'Half-Cuts')}</a></li>
                <li><a href="${b}chassis-parts/">${t('engine.chassisParts', 'Chassis Parts')}</a></li>
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section class="cta-block">
        <div class="container cta-block__inner">
          <div>
            <h2>${t('engine.needExportPrefix', 'Need')} ${engine.brand} ${engine.code} ${t('engine.needExportSuffix', 'for Export?')}</h2>
            <p>${t('engine.quoteLead', 'Send your requirements — EXW/CIF quotation within 24 hours.')}</p>
          </div>
          ${quoteButton(engine, 'btn btn-accent', t('engine.contactTeam', 'Contact Sourcing Team'))}
        </div>
      </section>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const slug = document.body.dataset.engine;
    if (slug) renderEngineDetail(slug);
  });

  window.addEventListener('asiapower:langchange', () => {
    if (currentSlug) renderEngineDetail(currentSlug);
  });
})();

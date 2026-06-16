/**
 * AsiaPower — SEO Engine Detail Page Renderer
 */
(function () {
  'use strict';

  function base() {
    return window.SitePaths ? window.SitePaths.base() : '../';
  }

  function renderEngineDetail(slug) {
    const engine = window.SEO_ENGINES?.[slug];
    const root = document.getElementById('engine-detail-root');
    if (!engine || !root) return;

    document.title = engine.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = engine.description;
    window.AsiaPowerSEO?.refresh?.();

    const status = window.ENGINE_EXPORT_STATUS || [
      'Available', 'Ready for Export', 'FOB Available', 'CIF Available',
    ];

    root.innerHTML = `
      <section class="page-hero page-hero--catalog">
        <div class="container">
          <div class="page-hero__breadcrumb">
            <a href="${base()}index.html">Home</a> /
            <a href="${base()}brands.html">Brands</a> /
            <a href="${base()}brands/${engine.brandSlug}.html">${engine.brand}</a> /
            <a href="${base()}engines/index.html">Engines</a> /
            <span>${engine.code}</span>
          </div>
          <h1>${engine.brand} ${engine.code} Engine</h1>
          <p>${engine.displacement} ${engine.fuel} — ${engine.applications}. Sourced for global export through AsiaPower's China-based supply network.</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="engine-detail">
            <div class="engine-detail__main">
              <span class="section-eyebrow">${engine.origin} · Engine Model</span>
              <h2 class="engine-detail__code">${engine.code}</h2>
              <dl class="engine-detail__specs">
                <div><dt>Brand</dt><dd><a href="${base()}brands/${engine.brandSlug}.html">${engine.brand}</a></dd></div>
                <div><dt>Displacement</dt><dd>${engine.displacement}</dd></div>
                <div><dt>Fuel Type</dt><dd>${engine.fuel}</dd></div>
                <div><dt>Applications</dt><dd>${engine.applications}</dd></div>
              </dl>
              <ul class="engine-model__status engine-detail__status" aria-label="Export availability">
                ${status.map(s => `<li class="engine-model__status-item">${s}</li>`).join('')}
              </ul>
              <div class="engine-detail__actions">
                <a href="${base()}contact.html?brand=${engine.brandSlug}&product=${encodeURIComponent(engine.code)}" class="btn btn-accent">Request Quote</a>
                <a href="${base()}brands/${engine.brandSlug}.html#engines" class="btn btn-outline-navy">All ${engine.brand} Engines</a>
              </div>
            </div>
            <aside class="engine-detail__aside">
              <h3>Browse ${engine.brand}</h3>
              <ul class="engine-detail__links">
                <li><a href="${base()}brands/${engine.brandSlug}.html#engines">${engine.brand} Engines</a></li>
                <li><a href="${base()}brands/${engine.brandSlug}.html#gearboxes">${engine.brand} Gearboxes</a></li>
                <li><a href="${base()}brands/${engine.brandSlug}.html#chassis">${engine.brand} Chassis Parts</a></li>
                <li><a href="${base()}brands/${engine.brandSlug}.html#halfcuts">${engine.brand} Half-Cuts</a></li>
              </ul>
              <h3>Product Catalog</h3>
              <ul class="engine-detail__links">
                <li><a href="${base()}engines/index.html">All Engine Models</a></li>
                <li><a href="${base()}gearboxes/index.html">Gearboxes</a></li>
                <li><a href="${base()}half-cuts/index.html">Half-Cuts</a></li>
                <li><a href="${base()}chassis-parts/index.html">Chassis Parts</a></li>
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section class="cta-block">
        <div class="container cta-block__inner">
          <div>
            <h2>Need ${engine.brand} ${engine.code} for Export?</h2>
            <p>Send your requirements — FOB/CIF quotation within 24 hours.</p>
          </div>
          <a href="${base()}contact.html?brand=${engine.brandSlug}&product=${encodeURIComponent(engine.code)}" class="btn btn-accent">Contact Sourcing Team</a>
        </div>
      </section>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const slug = document.body.dataset.engine;
    if (slug) renderEngineDetail(slug);
  });
})();

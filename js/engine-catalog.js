/**
 * AsiaPower — Engine Catalog Rendering
 */
(function () {
  'use strict';

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function base() {
    return window.SitePaths ? window.SitePaths.base() : '';
  }

  function quoteUrl(slug, code) {
    return `${base()}contact.html?brand=${encodeURIComponent(slug)}&product=${encodeURIComponent(code)}`;
  }

  function quoteLink(brandSlug, brandName, code) {
    window.CatalogLeadUtils?.ensureCatalogLeadScripts?.();
    const lead = window.CatalogLeadUtils?.leadLink?.({
      category: 'engine',
      brand: brandName,
      brandSlug,
      product: code,
      intent: 'price',
      className: 'engine-model__quote-link',
      label: t('engine.requestQuote', 'Request Quote'),
    });
    if (lead) return lead;
    return `<a href="${quoteUrl(brandSlug, code)}" class="engine-model__quote-link">${t('engine.requestQuote', 'Request Quote')}</a>`;
  }

  function quoteButton(brandSlug, brandName, code, className) {
    window.CatalogLeadUtils?.ensureCatalogLeadScripts?.();
    const lead = window.CatalogLeadUtils?.leadLink?.({
      category: 'engine',
      brand: brandName,
      brandSlug,
      product: code,
      intent: 'price',
      className: className || 'btn btn-navy btn-sm',
      label: t('engine.requestQuote', 'Request Quote'),
    });
    if (lead) return lead;
    return `<a href="${quoteUrl(brandSlug, code)}" class="${className || 'btn btn-navy btn-sm'}">${t('engine.requestQuote', 'Request Quote')}</a>`;
  }

  function modelUrl(brandSlug, code) {
    const page = window.SitePaths?.enginePagePath?.(brandSlug, code);
    if (page) return base() + page;
    return quoteUrl(brandSlug, code);
  }

  function exportStatusLabels() {
    const labels = window.ENGINE_EXPORT_STATUS || [
      'Available',
      'Ready for Export',
      'FOB Available',
      'CIF Available',
    ];
    return labels.map(label => window.PublicI18n?.translateExportStatus?.(label) || label);
  }

  function renderExportStatus() {
    return `
      <ul class="engine-model__status" aria-label="${t('engine.exportAvailability', 'Export availability')}">
        ${exportStatusLabels().map(label => `<li class="engine-model__status-item">${label}</li>`).join('')}
      </ul>`;
  }

  function renderEngineModelCard(brandSlug, brandName, model) {
    const url = modelUrl(brandSlug, model.code);
    const hasPage = window.SitePaths?.enginePagePath?.(brandSlug, model.code);
    const ctaLabel = hasPage ? t('engine.viewModel', 'View Model →') : t('engine.requestQuote', 'Request Quote');
    return `
      <article class="engine-model" data-filter-tags="${model.type} ${brandSlug}">
        <div class="engine-model__header">
          <span class="engine-model__brand">${brandName}</span>
          <span class="engine-model__fuel">${model.fuel}</span>
        </div>
        <h3 class="engine-model__code"><a href="${url}">${model.code}</a></h3>
        <p class="engine-model__displacement">${model.displacement}</p>
        <p class="engine-model__apps">${model.applications}</p>
        ${renderExportStatus()}
        <div class="engine-model__footer">
          <a href="${url}" class="btn btn-navy btn-sm">${ctaLabel}</a>
          ${quoteLink(brandSlug, brandName, model.code)}
        </div>
      </article>`;
  }

  function renderEngineCatalogSection(brandData, options) {
    const opts = options || {};
    const showHeader = opts.showHeader !== false;

    const cards = brandData.models
      .map(m => renderEngineModelCard(brandData.slug, brandData.name, m))
      .join('');

    const header = showHeader ? `
      <div class="engine-catalog__brand-header">
        <div>
          <h2 class="engine-catalog__brand-name">${brandData.name}</h2>
          <p class="engine-catalog__brand-meta">${brandData.origin} · ${brandData.models.length} ${t('engine.modelsListed', 'engine models listed')}</p>
        </div>
        <a href="${base()}${brandData.landingPage || 'brands.html'}" class="engine-catalog__brand-link">${t('engine.viewBrand', 'View')} ${brandData.name} →</a>
      </div>` : '';

    return `
      <section class="engine-catalog" id="engines-${brandData.slug}" data-brand="${brandData.slug}">
        ${header}
        <div class="engine-catalog__grid">
          ${cards}
        </div>
      </section>`;
  }

  function renderBrandEngineSection(brandSlug, brandName) {
    const brandData = window.getBrandEngines?.(brandSlug);
    if (!brandData) return '';

    const cards = brandData.models
      .map(m => renderEngineModelCard(brandSlug, brandName, m))
      .join('');

    return `
      <section class="brand-detail-section" id="engines">
        <div class="container">
          <div class="brand-detail-section__header">
            <span class="section-eyebrow">Category 01</span>
            <h2>${brandName} ${t('engine.categoryEngines', 'Engines')}</h2>
            <p>${t('engine.catalogFor', 'Engine model catalog — available for global export.')} <a href="${base()}engines/#engines-${brandSlug}">${t('engine.viewFullList', 'View full')} ${brandName} ${t('engine.categoryEngines', 'Engines').toLowerCase()}</a>.</p>
          </div>
          <div class="engine-catalog__grid">
            ${cards}
          </div>
        </div>
      </section>`;
  }

  window.EngineCatalog = {
    renderEngineModelCard,
    renderEngineCatalogSection,
    renderBrandEngineSection,
    renderExportStatus,
    quoteLink,
    quoteButton,
    quoteUrl,
    modelUrl,
    base,
  };
})();

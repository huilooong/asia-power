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
      'EXW Available',
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

  function renderEngineModelCard(brandSlug, brandName, model, opts) {
    const options = opts || {};
    const url = modelUrl(brandSlug, model.code);
    if (options.listMode) {
      const hub = window.AsiaPowerEbayCatalogHub;
      const fullTitle = `${brandName} ${model.code}`.trim();
      if (hub?.renderPartsListRow) {
        const fuelKey = { petrol: 'engines.petrol', diesel: 'engines.diesel', hybrid: 'engines.hybrid' }[model.type];
        const fuelLabel = fuelKey ? t(fuelKey, model.fuel || model.type) : (model.fuel || '');
        const metaParts = [fuelLabel, model.displacement].filter(Boolean);
        return hub.renderPartsListRow({
          brandSlug,
          brandName,
          title: fullTitle,
          url,
          filterTags: `${model.type} ${brandSlug}`,
          meta: metaParts.join(' · '),
        });
      }
      return `
      <article class="engine-model ebay-listing-row ebay-listing-row--parts" data-filter-tags="${model.type} ${brandSlug}">
        <a class="ebay-listing-row__photo ebay-listing-row__photo--placeholder" href="${url}" aria-hidden="true">
          <svg class="ebay-listing-row__photo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.75"/><path d="M21 17l-5-5-4 4-2-2-4 4"/></svg>
        </a>
        <div class="ebay-listing-row__main">
          <h3 class="ebay-listing-row__title"><a href="${url}">${fullTitle}</a></h3>
        </div>
        <div class="ebay-listing-row__aside">
          <p class="ebay-listing-row__price ebay-listing-row__price--enquiry">${t('hc.priceOnEnquiry', 'Quote on enquiry')} <span class="ap-exw-badge" translate="no">EXW</span></p>
        </div>
      </article>`;
    }
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
      .map(m => renderEngineModelCard(brandData.slug, brandData.name, m, opts))
      .join('');

    const header = showHeader ? `
      <div class="engine-catalog__brand-header">
        <div>
          <h2 class="engine-catalog__brand-name">${brandData.name}</h2>
          ${opts.listMode ? '' : `<p class="engine-catalog__brand-meta">${brandData.origin} · ${brandData.models.length} ${t('engine.modelsListed', 'engine models listed')}</p>`}
        </div>
        ${opts.listMode ? '' : `<a href="${base()}${brandData.landingPage || 'brands.html'}" class="engine-catalog__brand-link">${t('engine.viewBrand', 'View')} ${brandData.name} →</a>`}
      </div>` : '';

    const gridClass = opts.listMode ? 'ebay-listing-list' : 'engine-catalog__grid';

    return `
      <section class="engine-catalog" id="engines-${brandData.slug}" data-brand="${brandData.slug}">
        ${header}
        <div class="${gridClass}">
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

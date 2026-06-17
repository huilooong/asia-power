/**
 * AsiaPower — Half-Cut Detail Page
 */
(function () {
  'use strict';

  function base() {
    return window.SitePaths?.base?.() || '../';
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

  function renderHalfCutDetail(slug) {
    const item = window.getHalfCutBySlug?.(slug);
    const root = document.getElementById('half-cut-detail-root');
    if (!item || !root) {
      if (root) {
        root.innerHTML = `
          <section class="section">
            <div class="container">
              <h1>Half Cut Not Found</h1>
              <p>This listing is unavailable. <a href="${base()}half-cuts/">Browse half-cut inventory</a> or <a href="${base()}contact.html">contact us</a>.</p>
            </div>
          </section>`;
      }
      return;
    }

    const b = base();
    const u = window.HalfCutUtils;
    const title = u.seoTitle(item);
    const description = u.seoDescription(item);

    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = description;

    const canonical = absoluteUrl(`${b}half-cuts/detail.html?slug=${encodeURIComponent(item.slug)}`);
    window.AsiaPowerSEO?.refresh?.();
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) canonicalLink.href = canonical;
    upsertMeta('property', 'og:url', canonical);

    upsertJsonLd('schema-halfcut-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl(`${b}index.html`) },
        { '@type': 'ListItem', position: 2, name: 'Half-Cuts', item: absoluteUrl(`${b}half-cuts/`) },
        { '@type': 'ListItem', position: 3, name: item.title, item: canonical },
      ],
    });

    upsertJsonLd('schema-halfcut-product', u.productJsonLd(item, canonical));

    const engineUrl = u.enginePageUrl(b, item);
    const brandUrl = `${b}brands/${item.brandSlug}.html#halfcuts-inventory`;
    const thumbUrl = u.firstPhotoUrl(item);
    const gallery = u.hasPhotos(item)
      ? `<div class="half-cut-gallery" role="list">${item.photos.map((photo, index) => {
          const url = u.photoUrl(photo);
          const label = typeof photo === 'object' && photo.label ? photo.label : `Photo ${index + 1}`;
          return `<figure class="half-cut-gallery__item" role="listitem"><img src="${url}" alt="${label}" loading="lazy"><figcaption>${label}</figcaption></figure>`;
        }).join('')}</div>`
      : '<p class="half-cut-card__photos-note">Photos on request</p>';
    const supplierNotice = item.supplierVerified
      ? '<p class="half-cut-supplier-notice">Supplier verified listing — inventory confirmed by AsiaPower supplier network before publication.</p>'
      : '';

    const vinRow = item.maskedVin
      ? `<div><dt>VIN</dt><dd class="half-cut-detail__vin">${item.maskedVin}</dd></div>`
      : '';
    const conditionRow = item.vehicleCondition
      ? `<div><dt>Condition</dt><dd>${item.vehicleCondition}</dd></div>`
      : '';

    const ctaHeading = item.status === 'Sold'
      ? `Similar ${item.brand} ${item.model} Half Cut`
      : `Export ${item.brand} ${item.model} Half Cut`;

    const ctaText = item.status === 'Sold'
      ? `Stock ID <strong>${item.stockId}</strong> is sold. Reference this listing when requesting a similar unit.`
      : item.status === 'Reserved' || item.status === 'In Transit'
        ? `Stock ID <strong>${item.stockId}</strong> is ${item.status.toLowerCase()}. Confirm availability or request a similar unit before export.`
        : `Reference Stock ID <strong>${item.stockId}</strong> for FOB/CIF quotation — availability confirmed on enquiry.`;

    const ctaButton = item.status === 'Available'
      ? `<a href="${u.requestPriceUrl(b, item)}" class="btn btn-accent">Contact Sourcing Team</a>`
      : `<a href="${u.similarUnitUrl(item)}" class="btn btn-accent" target="_blank" rel="noopener noreferrer">Request Similar Unit</a>`;

    root.innerHTML = `
      <section class="page-hero page-hero--catalog">
        <div class="container">
          <div class="page-hero__breadcrumb">
            <a href="${b}index.html">Home</a> /
            <a href="${b}half-cuts/">Half-Cuts</a> /
            <a href="${brandUrl}">${item.brand}</a> /
            <span>${item.stockId}</span>
          </div>
          <h1>${item.title}</h1>
          <p>${u.heroIntro(item)}</p>
          <p class="half-cut-disclaimer half-cut-disclaimer--hero">${u.INVENTORY_DISCLAIMER}</p>
          ${supplierNotice}
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="engine-detail half-cut-detail">
            <div class="engine-detail__main">
              <span class="section-eyebrow">${item.origin} · Half Cut · ${item.status}</span>
              <h2 class="half-cut-detail__stock-id">${item.stockId}</h2>
              ${gallery}
              <dl class="engine-detail__specs half-cut-detail__specs">
                <div><dt>Brand</dt><dd><a href="${brandUrl}">${item.brand}</a></dd></div>
                <div><dt>Model</dt><dd>${item.model}</dd></div>
                <div><dt>Year</dt><dd>${item.year}</dd></div>
                <div><dt>Engine Code</dt><dd>${engineUrl ? `<a href="${engineUrl}">${item.engineCode}</a>` : item.engineCode}</dd></div>
                <div><dt>Transmission</dt><dd>${item.transmissionCode}</dd></div>
                <div><dt>Drivetrain</dt><dd>${item.drivetrain}</dd></div>
                <div><dt>Mileage</dt><dd>${item.mileage}</dd></div>
                ${vinRow}
                ${conditionRow}
                <div><dt>Origin</dt><dd>${item.origin}</dd></div>
                <div><dt>Status</dt><dd><span class="half-cut-card__status half-cut-card__status--${u.statusSlug(item.status)}">${item.status}</span></dd></div>
              </dl>
              <h3 class="half-cut-detail__parts-title">Included Parts</h3>
              <ul class="half-cut-detail__parts">
                ${item.includedParts.map(part => `<li>${part}</li>`).join('')}
              </ul>
              <div class="engine-detail__actions half-cut-detail__actions">
                ${u.renderDetailActions(item, b)}
              </div>
            </div>
            <aside class="engine-detail__aside">
              <h3>Browse ${item.brand}</h3>
              <ul class="engine-detail__links">
                <li><a href="${brandUrl}">${item.brand} Half-Cut Listings</a></li>
                <li><a href="${b}brands/${item.brandSlug}.html#engines">${item.brand} Engines</a></li>
                <li><a href="${b}brands/${item.brandSlug}.html#gearboxes">${item.brand} Gearboxes</a></li>
              </ul>
              <h3>Catalog</h3>
              <ul class="engine-detail__links">
                <li><a href="${b}half-cuts/">All Half Cuts</a></li>
                ${engineUrl ? `<li><a href="${engineUrl}">${item.engineCode} Engine Page</a></li>` : ''}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section class="cta-block">
        <div class="container cta-block__inner">
          <div>
            <h2>${ctaHeading}</h2>
            <p>${ctaText}</p>
          </div>
          ${ctaButton}
        </div>
      </section>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (slug) renderHalfCutDetail(slug);
  });
})();

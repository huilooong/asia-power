/**
 * AsiaPower — Shared Layout Components
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
    if (!path || path.startsWith('http') || path.startsWith('mailto') || path.startsWith('#')) {
      return path;
    }
    return siteBase() + path;
  }

  function currentPageId() {
    const page = document.body.dataset.page;
    if (page) {
      if (page.startsWith('brand-')) return 'brands';
      if (page.startsWith('engine-')) return '';
      if (page === 'truckheads') return 'trucks';
      if (page === 'halfcuts') return 'brands';
      return page;
    }
    const file = window.location.pathname.split('/').pop() || 'index.html';
    const map = {
      'index.html': 'home',
      'brands.html': 'brands',
      'supplier-portal.html': 'supplier',
      'about.html': 'about',
      'contact.html': 'contact',
    };
    return map[file] || '';
  }

  function iconSvg(name) {
    const icons = {
      phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
      mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
      whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    };
    return icons[name] || '';
  }

  function getConfig() {
    return window.ASIAPOWER || (typeof ASIAPOWER !== 'undefined' ? ASIAPOWER : null);
  }

  function i18n() {
    return window.PublicI18n;
  }

  function t(key, fallback) {
    const pub = i18n();
    return pub ? pub.t(key, fallback) : fallback;
  }

  function navLabel(item) {
    const pub = i18n();
    return pub ? pub.translateNavLabel(item) : item.label;
  }

  function renderSkipLink() {
    return `<a class="skip-link" href="#main-content">${t('skipLink', 'Skip to main content')}</a>`;
  }

  /** Admin / supplier upload tools — not public marketing pages. */
  function isInternalToolPage() {
    const page = document.body?.dataset?.page || '';
    if (page === 'supplier-upload' || page === 'admin-review' || page === 'admin-inventory' || page === 'admin-leads' || page === 'admin-analytics') {
      return true;
    }
    const path = window.location.pathname;
    return path.includes('/admin/') || path.includes('/supplier-portal/half-cut-upload') || path.includes('/supplier-portal/truck-upload');
  }

  function renderTopBar() {
    // Top bar disabled sitewide (public + internal) — minimal header via #site-header only.
    return '';
  }

  function logoImg(className, attrs, variant) {
    const c = getConfig();
    if (!c) return '';
    const extra = attrs || '';
    const isFooter = variant === 'footer';
    const logo = isFooter && c.logoFooter ? c.logoFooter : c.logo;
    const srcSetRaw = isFooter && c.logoFooterSrcSet ? c.logoFooterSrcSet : c.logoSrcSet;
    const srcset = srcSetRaw
      ? srcSetRaw.split(',').map(part => {
          const [file, width] = part.trim().split(/\s+/);
          return `${href(file)} ${width || ''}`.trim();
        }).join(', ')
      : '';
    const sizesRaw = isFooter && c.footerLogoSizes ? c.footerLogoSizes : c.logoSizes;
    const sizes = sizesRaw ? ` sizes="${sizesRaw}"` : '';
    const srcsetAttr = srcset ? ` srcset="${srcset}"${sizes}` : '';
    const width = isFooter && c.logoFooterWidth ? c.logoFooterWidth : 320;
    const height = isFooter && c.logoFooterHeight ? c.logoFooterHeight : 39;
    return `<img src="${href(logo)}"${srcsetAttr} alt="AsiaPower" class="${className}" width="${width}" height="${height}" decoding="async"${extra}>`;
  }

  function renderHeader(activeId) {
    const c = getConfig();
    if (!c) return '';
    const pub = i18n();
    const links = c.nav.map(item =>
      `<a href="${href(item.href)}" class="nav__link${item.id === activeId ? ' active' : ''}">${navLabel(item)}</a>`
    ).join('');
    const switcher = pub ? pub.renderLangSwitcher() : '';

    return `
      <header class="header">
        <div class="container header__inner">
          <a href="${href('index.html')}" class="logo header__logo" aria-label="AsiaPower Home">
            ${logoImg('logo__img', ' fetchpriority="high"')}
          </a>
          <button class="menu-toggle" type="button" aria-label="${t('nav.openMenu', 'Open menu')}" aria-expanded="false" aria-controls="main-nav">
            <span></span><span></span><span></span>
          </button>
          <nav class="nav" id="main-nav" aria-label="Main navigation">
            <div class="nav__logo">
              ${logoImg('logo__img', '')}
            </div>
            ${links}
            ${switcher}
          </nav>
        </div>
      </header>`;
  }

  function renderFooterSeo(c) {
    const engines = (c.seoEngines || []).map(item =>
      `<li><a href="${href(`engines/${item.slug}.html`)}">${item.code}</a></li>`
    ).join('');
    const brands = (c.seoBrands || []).map(item =>
      `<li><a href="${href(item.href)}">${item.name}</a></li>`
    ).join('');
    const products = (c.seoProducts || []).map(item =>
      `<li><a href="${href(item.href)}">${item.label}</a></li>`
    ).join('');

    return `
      <div class="footer__seo">
        <div class="footer__seo-grid">
          <div class="footer__seo-col">
            <h4>${t('footer.popularEngines', 'Popular Engine Models')}</h4>
            <ul class="footer__seo-links">${engines}</ul>
          </div>
          <div class="footer__seo-col">
            <h4>${t('footer.popularBrands', 'Popular Brands')}</h4>
            <ul class="footer__seo-links">${brands}</ul>
          </div>
          <div class="footer__seo-col">
            <h4>${t('footer.productCatalog', 'Product Catalog')}</h4>
            <ul class="footer__seo-links">${products}</ul>
          </div>
        </div>
      </div>`;
  }

  function renderFooter() {
    const c = getConfig();
    if (!c) return '';
    const showFooterContact = isInternalToolPage();
    const navLinks = c.nav.map(item => `<li><a href="${href(item.href)}">${navLabel(item)}</a></li>`).join('');

    return `
      <footer class="footer">
        <div class="footer__cta">
          <div class="container footer__cta-inner">
            <div>
              <h3>${t('footer.ctaTitle', 'Need Powertrain Parts Shipped Globally?')}</h3>
              <p>${t('footer.ctaLead', 'Send your vehicle details — we respond within 24 hours with FOB/CIF pricing.')}</p>
            </div>
            <div class="footer__cta-actions">
              <a href="contact.html?product=truck" class="btn btn-accent">${t('footer.requestQuote', 'Request Truck Quote')}</a>
              <a href="https://wa.me/${c.whatsapp}?text=${encodeURIComponent(c.whatsappTruckMessage || c.whatsappMessage)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-light">
                ${iconSvg('whatsapp')} ${t('footer.whatsapp', 'WhatsApp Us')}
              </a>
            </div>
          </div>
        </div>
        <div class="container">
          ${renderFooterSeo(c)}
          <div class="footer__grid">
            <div class="footer__col footer__col--brand">
              <a href="${href('index.html')}" class="logo logo--footer">
                ${logoImg('logo__img', ' loading="lazy"', 'footer')}
              </a>
              <p class="footer__about">${t('footer.about', 'AsiaPower is a global powertrain sourcing platform — connecting importers, workshops and fleet operators to a verified China-based supply network for Japanese, Korean and Chinese vehicle applications.')}</p>
            </div>
            <div class="footer__col">
              <h4>${t('footer.nav', 'Navigation')}</h4>
              <ul>${navLinks}</ul>
            </div>
            <div class="footer__col">
              <h4>${t('footer.startHere', 'Start Here')}</h4>
              <ul>
                <li><a href="${href('brands.html')}">${t('footer.brandDirectory', 'Brand Directory')}</a></li>
                <li><a href="${href('guides/')}">${t('footer.buyerGuides', 'Buyer Guides')}</a></li>
                <li><a href="${href('supplier-portal.html')}">${t('footer.supplierPortal', 'Supplier Portal')}</a></li>
                <li><a href="${href('contact.html')}">${t('footer.contactUs', 'Contact Us')}</a></li>
              </ul>
            </div>
            <div class="footer__col">
              <h4>${t('footer.offices', 'Our Offices')}</h4>
              <div class="footer__office">
                <strong>${c.offices.china.flag} ${c.offices.china.label}</strong>
                <p>${c.offices.china.address}</p>
              </div>
              <div class="footer__office">
                <strong>${c.offices.ghana.flag} ${c.offices.ghana.label}</strong>
                <p>${c.offices.ghana.address}</p>
              </div>
              ${showFooterContact ? `<div class="footer__contact">
                <a href="https://wa.me/${c.whatsapp}" target="_blank" rel="noopener noreferrer">${iconSvg('whatsapp')} ${c.whatsappDisplay}</a>
                <a href="mailto:${c.email}">${iconSvg('mail')} ${c.email}</a>
              </div>` : ''}
            </div>
          </div>
          <div class="footer__bottom">
            <span>&copy; ${new Date().getFullYear()} ${c.company}. ${t('footer.rights', 'All rights reserved.')}</span>
            <span><a href="${href('supplier-portal.html')}">${t('footer.supplierReg', 'Supplier Registration')}</a></span>
          </div>
        </div>
      </footer>`;
  }

  function renderWhatsApp() {
    const c = getConfig();
    if (!c) return '';
    if (document.body.dataset.page === 'home') return '';
    return `
      <div class="whatsapp-float">
        <span class="whatsapp-float__label">${t('whatsapp.label', 'Chat on WhatsApp')}</span>
        <a href="https://wa.me/${c.whatsapp}?text=${encodeURIComponent(c.whatsappTruckMessage || c.whatsappMessage)}" target="_blank" rel="noopener noreferrer" class="whatsapp-float__btn" aria-label="${t('whatsapp.label', 'Chat on WhatsApp')}">
          ${iconSvg('whatsapp')}
        </a>
      </div>`;
  }

  function renderAppBottomNav(activeId) {
    const items = [
      { id: 'home', label: 'Home', href: 'index.html', icon: 'H' },
      { id: 'products', label: 'Products', href: 'engines/', icon: 'P' },
      { id: 'brands', label: 'Brands', href: 'brands.html', icon: 'B' },
      { id: 'contact', label: 'Contact', href: 'contact.html', icon: 'C' },
      { id: 'app', label: 'App', href: 'app.html', icon: 'A' },
    ];
    const page = document.body.dataset.page || activeId;
    const path = window.location.pathname;
    const current = page === 'engines' || page === 'gearboxes' || page === 'halfcuts' ? 'products'
      : path.endsWith('/app.html') || path.endsWith('app.html') ? 'app'
      : activeId;
    const links = items.map(item => `
      <a class="app-bottom-nav__item${item.id === current ? ' active' : ''}" href="${href(item.href)}" aria-label="${item.label}">
        <span class="app-bottom-nav__icon" aria-hidden="true">${item.icon}</span>
        <span class="app-bottom-nav__label">${item.label}</span>
      </a>`).join('');

    return `<nav class="app-bottom-nav" aria-label="Mobile app navigation">${links}</nav>`;
  }

  function injectLayout() {
    const activeId = currentPageId();
    const topBar = document.getElementById('site-topbar');
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    const wa = document.getElementById('site-whatsapp');

    if (topBar) {
      topBar.innerHTML = renderTopBar();
      topBar.classList.toggle('site-topbar--hidden', !topBar.innerHTML.trim());
    }
    if (!document.querySelector('.skip-link')) {
      document.body.insertAdjacentHTML('afterbegin', renderSkipLink());
    }
    if (header) header.innerHTML = renderHeader(activeId);
    if (footer) footer.innerHTML = renderFooter();
    if (wa) wa.innerHTML = renderWhatsApp();
    document.querySelectorAll('.app-bottom-nav').forEach((nav) => nav.remove());
    if (!isInternalToolPage()) {
      document.body.insertAdjacentHTML('beforeend', renderAppBottomNav(activeId));
    }

    const pub = i18n();
    if (pub) {
      pub.bindLangSwitcher(header);
      pub.applyDataI18n(document.getElementById('main-content'));
    }

    window.dispatchEvent(new CustomEvent('asiapower:layoutrefresh'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLayout);
  } else {
    injectLayout();
  }

  window.addEventListener('asiapower:langchange', injectLayout);
})();

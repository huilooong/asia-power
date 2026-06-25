/**
 * AsiaPower — SEO meta tags, Open Graph, and JSON-LD
 */
(function () {
  'use strict';

  function siteBase() {
    return window.SitePaths?.base?.() || '';
  }

  function absoluteUrl(path) {
    if (!path) return window.location.href;
    if (path.startsWith('http')) return path;
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    try {
      return new URL(path, base).href;
    } catch {
      return window.location.href;
    }
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

  function upsertLink(rel, href) {
    if (!href) return;
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.href = href;
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

  function isInternalPage() {
    const p = window.location.pathname || '';
    return /\/admin\//i.test(p) || /\/supplier-portal\/(?:half-cut|truck)-upload/i.test(p);
  }

  function pageMeta() {
    if (isInternalPage()) {
      upsertMeta('name', 'robots', 'noindex, nofollow');
      return;
    }
    const title = document.title || 'AsiaPower';
    const desc = document.querySelector('meta[name="description"]')?.content
      || 'Global powertrain sourcing platform for engines, gearboxes, chassis parts and half-cuts.';
    const c = window.ASIAPOWER || {};
    const siteUrl = (c.siteUrl || window.location.origin).replace(/\/$/, '');
    const canonical = window.location.href.split('#')[0].split('?')[0];
    const image = absoluteUrl(siteBase() + (c.logo || 'assets/logo.png'));

    upsertLink('canonical', canonical);
    upsertLink('sitemap', absoluteUrl(siteBase() + 'sitemap.xml'));
    upsertMeta('name', 'robots', 'index, follow');
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', c.company || 'AsiaPower');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:image', image);
    const lang = window.PublicI18n?.getLang?.() || 'en';
    const locale = { en: 'en_US', zh: 'zh_CN', fr: 'fr_FR', ar: 'ar_SA' }[lang] || 'en_US';
    upsertMeta('property', 'og:locale', locale);
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', desc);
    upsertMeta('name', 'twitter:image', image);

    upsertJsonLd('schema-organization', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: c.company || 'AsiaPower',
      url: siteUrl,
      logo: absoluteUrl(siteBase() + (c.logo || 'assets/logo.png')),
      description: desc,
      contactPoint: [{
        '@type': 'ContactPoint',
        contactType: 'sales',
        availableLanguage: ['English', 'Chinese', 'French', 'Arabic'],
        url: `https://wa.me/${c.whatsapp || ''}`,
      }],
      ...(c.merchantListing?.returnPolicy ? { hasMerchantReturnPolicy: c.merchantListing.returnPolicy } : {}),
      ...(c.merchantListing?.shippingDetails ? { shippingDetails: c.merchantListing.shippingDetails } : {}),
    });

    upsertJsonLd('schema-website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: c.company || 'AsiaPower',
      url: siteUrl,
      description: c.tagline || 'Global Powertrain Sourcing Platform',
    });
  }

  window.AsiaPowerSEO = { refresh: pageMeta, absoluteUrl };
  window.addEventListener('asiapower:langchange', pageMeta);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pageMeta);
  } else {
    pageMeta();
  }
})();

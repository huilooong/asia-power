/**
 * AsiaPower brand presentation policy.
 *
 * Automotive makes are rendered in uppercase in visible public-page copy only.
 * Source inventory objects, URLs, form values, metadata and JSON-LD are untouched.
 */
(function () {
  'use strict';

  const STATIC_BRANDS = [
    'Mercedes-Benz', 'Mercedes Benz', 'Rolls-Royce', 'Land Rover', 'Range Rover',
    'Great Wall', 'Li Auto', 'Alfa Romeo', 'Aston Martin', 'General Motors',
    'Toyota', 'Lexus', 'Honda', 'Acura', 'Nissan', 'Infiniti', 'Mitsubishi',
    'Mazda', 'Subaru', 'Suzuki', 'Isuzu', 'Daihatsu', 'Hino', 'Hyundai', 'Kia',
    'Genesis', 'Daewoo', 'SsangYong', 'BMW', 'Audi', 'Volkswagen', 'Porsche',
    'Volvo', 'Scania', 'Renault', 'Peugeot', 'Citroën', 'Citroen', 'Fiat',
    'Iveco', 'Ford', 'Chevrolet', 'Cadillac', 'Buick', 'GMC', 'Jeep', 'Chrysler',
    'Dodge', 'RAM', 'Jaguar', 'Bentley', 'MINI', 'Tesla', 'BYD', 'Geely', 'Chery',
    'GWM', 'Haval', 'Tank', 'Jetour', 'Hongqi', 'Dongfeng', 'Foton', 'Sinotruk',
    'Howo', 'Shacman', 'JAC', 'FAW', 'BAIC', 'SAIC', 'Maxus', 'Wuling', 'Changan',
    'GAC', 'Aion', 'Zeekr', 'NIO', 'Xpeng', 'Leapmotor', 'Fangchengbao', 'JMC',
    'Yutong', 'King Long', 'Golden Dragon', 'Chery Jaguar Land Rover'
  ];
  const SKIP_SELECTOR = [
    'script', 'style', 'noscript', 'textarea', 'code', 'pre', 'template',
    '[contenteditable="true"]', '[data-brand-display="off"]'
  ].join(',');
  const brands = new Set(STATIC_BRANDS);
  let brandPattern = null;
  let observer = null;

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function rebuildPattern() {
    const alternatives = Array.from(brands)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    brandPattern = alternatives.length
      ? new RegExp(`(^|[^A-Za-z0-9])(${alternatives.join('|')})(?=$|[^A-Za-z0-9])`, 'gi')
      : null;
  }

  function registerBrand(value) {
    const brand = String(value || '').trim();
    if (!brand || brand.length > 48 || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(brand)) return false;
    const before = brands.size;
    brands.add(brand);
    if (brands.size !== before) brandPattern = null;
    return brands.size !== before;
  }

  function registerBrandsFromPage(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('[data-brand]').forEach((element) => registerBrand(element.getAttribute('data-brand')));
    const lists = [window.HALF_CUT_LIST, window.HALF_CUTS, window.INVENTORY_ITEMS];
    lists.forEach((list) => {
      if (Array.isArray(list)) list.forEach((item) => registerBrand(item?.brand || item?.make));
    });
  }

  function uppercaseBrandTokens(value) {
    const text = String(value ?? '');
    if (!text) return text;
    if (!brandPattern) rebuildPattern();
    return brandPattern
      ? text.replace(brandPattern, (_match, prefix, make) => `${prefix}${String(make).toUpperCase()}`)
      : text;
  }

  function shouldSkipTextNode(node) {
    const parent = node?.parentElement;
    return !parent || Boolean(parent.closest(SKIP_SELECTOR));
  }

  function processTextNode(node) {
    if (shouldSkipTextNode(node)) return false;
    const next = uppercaseBrandTokens(node.nodeValue);
    if (next === node.nodeValue) return false;
    node.nodeValue = next;
    return true;
  }

  function processRoot(root) {
    if (!root) return 0;
    registerBrandsFromPage(root.nodeType === 1 || root.nodeType === 9 ? root : root.parentElement);
    if (root.nodeType === 3) return processTextNode(root) ? 1 : 0;
    if (!root.ownerDocument && root.nodeType !== 9) return 0;
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node = walker.nextNode();
    while (node) {
      if (processTextNode(node)) count += 1;
      node = walker.nextNode();
    }
    return count;
  }

  function isPublicPage() {
    const page = document.body?.dataset?.page || '';
    const path = window.location.pathname || '';
    return !page.startsWith('admin-')
      && page !== 'supplier-upload'
      && !path.includes('/admin/')
      && !path.includes('/supplier-portal/half-cut-upload')
      && !path.includes('/supplier-portal/truck-upload')
      && !path.includes('/supplier-portal/passenger-parts-upload');
  }

  function start() {
    if (!document.body || !isPublicPage()) return;
    processRoot(document.body);
    observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'characterData') processTextNode(record.target);
        record.addedNodes?.forEach((node) => processRoot(node));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.AsiaPowerBrandDisplay = {
    uppercaseBrandTokens,
    registerBrand,
    processRoot,
    stop() {
      observer?.disconnect();
      observer = null;
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

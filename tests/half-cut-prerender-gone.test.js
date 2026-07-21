'use strict';

const assert = require('assert');
const {
  catalogHomeForDetailPath,
  renderMissingCatalogDetailPage,
} = require('../server/lib/half-cut-prerender.js');

assert.strictEqual(catalogHomeForDetailPath('/half-cuts/detail.html'), '/half-cuts/');
assert.strictEqual(catalogHomeForDetailPath('/trucks/detail.html'), '/trucks/');
assert.strictEqual(catalogHomeForDetailPath('/machinery/detail.html'), '/machinery/');

const html = renderMissingCatalogDetailPage({
  siteUrl: 'https://asia-power.com',
  detailPath: '/half-cuts/detail.html',
  slug: 'mitsubishi-pajero-2019-4m41-half-cut-hc250026',
});

assert.match(html, /rel="canonical" href="https:\/\/asia-power\.com\/half-cuts\/"/);
assert.match(html, /name="robots" content="noindex, follow"/);
assert.match(html, /Listing unavailable/);
assert.match(html, /data-missing-slug="mitsubishi-pajero-2019-4m41-half-cut-hc250026"/);
assert.doesNotMatch(html, /Half Cut Detail \| AsiaPower/);

console.log('half-cut-prerender-gone.test.js OK');

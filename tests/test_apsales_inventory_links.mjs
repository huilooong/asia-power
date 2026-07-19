import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryPageUrl,
  detailPageUrl,
  enrichInventoryMatch,
  SITE_ORIGIN,
} from '../deploy/apsales-live-draft/apsales-inventory-links.mjs';

test('categoryPageUrl: part intent maps to catalog section', () => {
  assert.equal(categoryPageUrl('engine'), `${SITE_ORIGIN}/engines/`);
  assert.equal(categoryPageUrl('half_cut'), `${SITE_ORIGIN}/half-cuts/`);
  assert.equal(categoryPageUrl(null, 'Truck'), `${SITE_ORIGIN}/trucks/`);
});

test('detailPageUrl + enrichInventoryMatch include slug URLs', () => {
  const item = {
    stockId: 'HC250583',
    slug: 'haval-h6-2013-4g69-s4m-half-cut-hc250583',
    title: 'Haval H6 Half Cut',
    priceUsd: 1800,
    vehicleCondition: 'Running Vehicle',
    vehicleCategory: 'Passenger',
    engineCode: '4G69',
  };
  const url = detailPageUrl(item);
  assert.match(url, /half-cuts\/detail\.html\?slug=haval-h6/);
  const m = enrichInventoryMatch(item);
  assert.equal(m.stock_id, 'HC250583');
  assert.equal(m.price_usd, 1800);
  assert.equal(m.detail_url, url);
  assert.ok(m.category_url);
});

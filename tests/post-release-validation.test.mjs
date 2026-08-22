import assert from 'node:assert/strict';
import test from 'node:test';

const source = await import('../scripts/lib/post-release-validation.mjs');

test('public validation module loads after route/cache guard changes', () => {
  assert.equal(typeof source.runPublicPostReleaseValidation, 'function');
  assert.equal(typeof source.attemptCloudflarePurge, 'function');
});

test('used-cars sitemap entries are covered by SEO validation', () => {
  assert.equal(source.classifyInventoryLoc('https://asia-power.com/used-cars/detail.html?slug=hc250241'), 'used_car');
  assert.equal(source.classifyInventoryLoc('https://asia-power.com/half-cuts/detail.html?slug=hc250241'), 'half_cut');
});

test('critical release assets require the short cache policy', () => {
  assert.equal(source.hasShortCachePolicy('public, max-age=60, must-revalidate'), true);
  assert.equal(source.hasShortCachePolicy('public, max-age=14400, must-revalidate'), false);
  assert.equal(source.hasShortCachePolicy('public, max-age=31536000, immutable'), false);
});

test('shared client-rendered header and JSON-LD logo count as homepage logo signals', () => {
  assert.equal(source.hasLogo('<div id="site-header"></div><script src="js/components.js"></script>'), true);
  assert.equal(source.hasLogo('<script type="application/ld+json">{"logo":{"url":"/assets/asia-power-og.svg"}}</script>'), true);
  assert.equal(source.hasLogo('<main>AsiaPower</main>'), false);
});

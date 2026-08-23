import assert from 'node:assert/strict';
import http from 'node:http';
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

test('shared header logo signal requires the mount, component script, and logo markup', () => {
  const html = '<div id="site-header"></div><script src="js/components.js?v=release"></script>';
  const components = '<a class="ebay-header__logo ap-logo">AsiaPower</a>';

  assert.equal(source.hasSharedHeaderLogoSignal(html, components), true);
  assert.equal(source.hasSharedHeaderLogoSignal('<script src="js/components.js"></script>', components), false);
  assert.equal(source.hasSharedHeaderLogoSignal('<div id="site-header"></div>', components), false);
  assert.equal(source.hasSharedHeaderLogoSignal(html, '<nav>AsiaPower</nav>'), false);
  assert.equal(source.hasLogo('<script type="application/ld+json">{"logo":{"url":"/assets/asia-power-og.svg"}}</script>'), false);
});

test('homepage validation accepts a verified logo from the fetched shared header component', async (t) => {
  const homepage = `<!doctype html>
    <html>
      <head>
        <title>AsiaPower Shared Header Validation</title>
        <link rel="canonical" href="https://asia-power.com/">
        <script type="application/ld+json">{"@type":"Organization","name":"AsiaPower"}</script>
      </head>
      <body class="page-home-v4">
        <div id="site-header"></div>
        <script src="/js/components.js?v=release"></script>
      </body>
    </html>`;
  const components = '<a class="ebay-header__logo ap-logo">AsiaPower</a>';
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(homepage);
      return;
    }
    if (req.url?.startsWith('/js/components.js')) {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end(components);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  }));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const report = await source.runPublicPostReleaseValidation({
    baseUrl: `http://127.0.0.1:${address.port}`,
    pages: [{ id: 'homepage', url: '/', kind: 'html', requireHomeHybrid: true }],
  });
  const logoCheck = report.checks.find((check) => check.name === 'homepage_logo');

  assert.equal(report.status, 'pass');
  assert.equal(logoCheck?.status, 'pass');
  assert.match(logoCheck?.detail || '', /shared header logo present/);
});

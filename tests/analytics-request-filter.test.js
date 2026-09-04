'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isProbeRequest } = require('../server/lib/analytics-request-filter');
const { createSiteAnalytics } = require('../server/lib/site-analytics');

test('excludes the observed WordPress probe and common scanner paths', () => {
  for (const target of ['/?rest_route=%2Fbatch%2Fv1', '/?%72est_route=/wp/v2/users', '/wp-admin/', '/wp-json/wp/v2/', '/.git/config', '/%2eenv', '/.env.production', '/xmlrpc.php', '/?file=../../../../var/www/html/.env']) {
    assert.equal(isProbeRequest(target), true, target);
  }
});

test('retains inventory queries, slug URLs, campaign tags and ordinary pages', () => {
  for (const target of ['/', '/engines/g4kd.html', '/half-cuts/?q=2AZ-FE', '/?utm_source=google&gclid=sample', '/used-cars/detail.html?slug=byd-seal', '/?q=wp-admin', '/guides/rest_route.html']) {
    assert.equal(isProbeRequest(target), false, target);
  }
});

test('page tracking applies the filter while retaining public inventory traffic', () => {
  const analytics = createSiteAnalytics('/tmp/unused-analytics-filter-test');
  assert.equal(analytics.shouldTrackPage('/?rest_route=%2Fbatch%2Fv1'), false);
  assert.equal(analytics.shouldTrackPage('/wp-admin/'), false);
  assert.equal(analytics.shouldTrackPage('/half-cuts/?q=G4KD'), true);
  assert.equal(analytics.shouldTrackPage('/api/half-cuts/public'), false);
});

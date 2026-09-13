import test from 'node:test';
import assert from 'node:assert/strict';
import { VALID_TARGETS, TARGET_SOURCE_FILES, TARGET_REMOTE_PATHS } from '../scripts/lib/release-manager.mjs';

test('APBD repair release snapshots precisely the two files it publishes', () => {
  assert.ok(VALID_TARGETS.includes('api-apbd'));
  assert.deepEqual(TARGET_SOURCE_FILES['api-apbd'], ['deploy/inventory-site-server.js', 'server/lib/apbd-admin.js']);
  assert.deepEqual(TARGET_REMOTE_PATHS['api-apbd'], [
    '/root/.openclaw/workspace/inventory-site/server.js',
    '/root/.openclaw/workspace/inventory-site/lib/apbd-admin.js',
  ]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TARGET_SOURCE_FILES, TARGET_REMOTE_PATHS, VALID_TARGETS } from '../scripts/lib/release-manager.mjs';
const manifest = JSON.parse(fs.readFileSync(new URL('../deploy/apsales-ai-control-manifest.json', import.meta.url)));

test('narrow release target covers every staged and backed-up file, without data or scheduler changes', () => {
  assert.ok(VALID_TARGETS.includes('apsales-ai-control'));
  assert.deepEqual(TARGET_REMOTE_PATHS['apsales-ai-control'], manifest.files.map(f => f.remote));
  assert.deepEqual(new Set(TARGET_SOURCE_FILES['apsales-ai-control']), new Set(manifest.files.map(f => f.source)));
  assert.equal(new Set(manifest.files.map(f => f.remote)).size, manifest.files.length);
  for (const file of manifest.files) {
    assert.ok(fs.existsSync(new URL('../' + file.source, import.meta.url)), file.source);
    assert.doesNotMatch(file.remote, /\/memory\/|\/data\/|\.env$|\/etc\//);
  }
});

test('every new relative module imported by bridge or session is in the runtime release', () => {
  for (const source of ['bridge.mjs', 'apsales-whatsapp-session.mjs']) {
    const text = fs.readFileSync(new URL('../deploy/apsales-live-draft/' + source, import.meta.url), 'utf8');
    for (const name of ['apsales-reply-control.mjs', 'apsales-turn-policy.mjs', 'apsales-human-takeover.mjs']) {
      if (text.includes('./' + name)) assert.ok(manifest.files.some(f => f.remote === '/root/.openclaw/extensions/apsales-live-draft/' + name));
    }
  }
});

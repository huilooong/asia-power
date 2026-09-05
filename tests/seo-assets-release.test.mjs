import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {SEO_ASSETS_FILES,buildSeoAssetsInstallScript} from '../scripts/lib/seo-assets-release.mjs';
test('scoped installer validates shell, old hash, rollback and HTTP readiness',()=>{
 const script=buildSeoAssetsInstallScript('REL-test-seo-assets',SEO_ASSETS_FILES.map(()=> 'a'.repeat(64)));
 assert.equal(spawnSync('bash',['-n'],{input:script,encoding:'utf8'}).status,0);
 assert.match(script,/trap rollback ERR/);assert.match(script,/test "\$ready" = 1/);assert.match(script,/e3f777686ad018148df1d167500ec7660e4777639af2903576eba25b4f8be2fa/);
 assert.equal(SEO_ASSETS_FILES.length,18);assert.ok(SEO_ASSETS_FILES.every(x=>x[2]));assert.ok(!SEO_ASSETS_FILES.some(x=>x[0].includes('approved.json')));
});

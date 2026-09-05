import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {SEO_TRAFFIC_FILES,buildSeoTrafficInstallScript} from '../scripts/lib/seo-traffic-release.mjs';

test('release is limited to approved storefront, analytics and required style files',()=>{
  assert.deepEqual(SEO_TRAFFIC_FILES.map(x=>x[1]),['public/robots.txt','lib/analytics-request-filter.js','lib/site-analytics.js','public/engines/g4kd.html','public/css/sitewide-secondary-v1.css']);
});
test('install validates baseline before atomic replacement and arms rollback',()=>{
  const script=buildSeoTrafficInstallScript('REL-20260905-seo-traffic-test',Array(5).fill('a'.repeat(64)));
  assert.equal(spawnSync('bash',['-n'],{input:script,encoding:'utf8'}).status,0);
  assert.ok(script.indexOf('test ! -e')<script.indexOf('trap rollback ERR'));
  assert.ok(script.indexOf('trap rollback ERR')<script.indexOf('.seo014.tmp'));
  assert.ok(script.includes('SEO_TRAFFIC_ROLLED_BACK'));
  assert.ok(!script.includes('rm -'));
});
test('rejects malformed release input before building shell commands',()=>{
  assert.throws(()=>buildSeoTrafficInstallScript('bad;command',[]));
  assert.throws(()=>buildSeoTrafficInstallScript('REL-test',['$(bad)']));
});
test('editorial page preserves inquiry fields, tracking and canonical; drops internal copy',()=>{
  const html=fs.readFileSync(new URL('../engines/g4kd.html',import.meta.url),'utf8');
  assert.ok(html.includes('<!-- editorial-engine-page: G4KD -->'));
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
  for(const text of ['data-form="contact-enquiry"','G-PB2J3VRX5J','name="engine_code" value="G4KD"','js/main.js','id="inquiry"']) assert.ok(html.includes(text),text);
  assert.ok(!/repository|inventory signals|quote-preview|noindex/i.test(html));
});

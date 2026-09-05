#!/usr/bin/env node
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const base = (process.argv[2] || 'https://asia-power.com').replace(/\/$/,'');
let count = 0;
function get(route, expected = 200) {
  const r = spawnSync('curl',['-sS','--max-time','25','--retry','1','-A','AsiaPower-SEO-Verification-bot/1.0','-w','\n%{http_code}',base+route],{encoding:'utf8',maxBuffer:15*1024*1024});
  assert.equal(r.status,0,`${route}: transport failed`);
  const split=r.stdout.lastIndexOf('\n'), status=Number(r.stdout.slice(split+1));
  assert.ok((Array.isArray(expected)?expected:[expected]).includes(status),`${route}: HTTP ${status}`);
  count++;
  return r.stdout.slice(0,split);
}
const robots=get('/robots.txt');
for(const rule of ['Allow: /api/half-cuts/public$','Allow: /api/half-cuts/public/item?','Disallow: /api/','Disallow: /data/','Disallow: /admin/']) assert.ok(robots.includes(rule),rule);
const html=get('/engines/g4kd.html');
assert.ok(html.includes('<!-- editorial-engine-page: G4KD -->'));
assert.ok(!/repository|inventory signals|quote-preview|noindex/i.test(html));
assert.equal((html.match(/<h1\b/g)||[]).length,1);
assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
assert.ok(html.includes('https://asia-power.com/engines/g4kd.html'));
assert.ok(html.includes('data-form="contact-enquiry"'));
assert.ok(html.includes('G-PB2J3VRX5J'));
assert.ok(html.includes('name="engine_code" value="G4KD"'));
assert.ok(html.includes('data-ebay-shell="1"'));
for (const match of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) {
  const url=new URL(match[1],base+'/engines/g4kd.html');
  assert.ok(get(url.pathname+url.search).length>0, url.pathname);
}
const stock=JSON.parse(get('/api/half-cuts/public'));
assert.ok(Array.isArray(stock.approved) && stock.approved.length>0);
get('/api/admin/buyers',[401,403]);
get('/api/half-cuts/state',[401,403]);
get('/');
get('/trucks/');
console.log(JSON.stringify({status:'pass',http_checks:count,robots:'pass',editorial_page:'pass',form_and_analytics:'preserved',public_inventory:'nonempty',admin:'protected'}));

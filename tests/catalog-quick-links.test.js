const {test}=require('node:test');const assert=require('node:assert/strict');
const {buildCatalogQuickLinks,injectCatalogSeo}=require('../server/lib/catalog-list-prerender');
const item=(n,extra={})=>({slug:`truck-${n}`,stockId:`HC${n}`,brand:'FAW',model:'J6',engineCode:'CA6',vehicleCategory:'truck',status:'Available',...extra});
test('links use current public category stock and correct detail routes',()=>{
 const html=buildCatalogQuickLinks({approved:[item(1),item(2,{status:'Sold'}),item(3,{vehicleCategory:'passenger'})]},'https://asia-power.com','trucks');
 assert.match(html,/\/trucks\/detail.html\?slug=truck-1/);assert.doesNotMatch(html,/truck-2|truck-3/);
});
test('links are bounded and escape user-provided titles',()=>{
 const html=buildCatalogQuickLinks({approved:Array.from({length:40},(_,i)=>item(i,{model:'<script>alert(1)</script>'}))},'https://asia-power.com','trucks');
 assert.equal((html.match(/<li>/g)||[]).length,24);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
test('no fabricated inventory and no duplicate quick links on reinjection',()=>{
 assert.equal(buildCatalogQuickLinks({approved:[]},'https://asia-power.com','trucks'),'');
 const input='<html><head></head><body><main><div id="half-cut-catalog-root"></div></main></body></html>';
 const first=injectCatalogSeo(input,{approved:[item(1)]},'https://asia-power.com','trucks');
 const twice=injectCatalogSeo(first,{approved:[item(1)]},'https://asia-power.com','trucks');
 assert.equal((twice.match(/id="catalog-stock-links"/g)||[]).length,1);assert.match(first,/<div id="half-cut-catalog-root"><\/div>/);
});

test('G4KD guide is linked when matching stock exists beyond first 24 items',()=>{
 const rows=Array.from({length:25},(_,i)=>item(i));rows[24].engineCode='G4KD';
 const html=buildCatalogQuickLinks({approved:rows},'https://asia-power.com','engines');
 assert.match(html,/href="\/engines\/g4kd.html"/);
});

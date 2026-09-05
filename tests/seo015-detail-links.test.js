const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const vm=require('vm');
const {buildDetailRootHtml}=require('../server/lib/half-cut-seo');
const source=fs.readFileSync('js/half-cut-detail.js','utf8');const helper=source.slice(source.indexOf('  function brandInventoryUrl'),source.indexOf('  function upsertJsonLd'));
const client=vm.runInNewContext(helper+'; brandInventoryUrl',{window:{HalfCutUtils:{isExportableUsedCarItem:i=>i.vehicleListingType==='used'}}});
for(const [category,route] of [['truck','trucks'],['machinery','machinery'],['passenger','half-cuts']])test(`server and browser brand links resolve ${category} catalog`,()=>{
 const item={stockId:'HCtest',slug:'test',brandSlug:'brand & test',brand:'Test',model:'Model',vehicleCategory:category,status:'Available',photos:[]};
 const html=buildDetailRootHtml(item,'https://asia-power.com');
 assert.match(html,new RegExp(route+'/\\?brand=brand%20%26%20test'));assert.doesNotMatch(html,/brands\//);
 assert.equal(client(item,'../'),`../${route}/?brand=brand%20%26%20test`);
});
test('detail templates invalidate the changed browser script',()=>{
 for(const dir of ['half-cuts','trucks','machinery','used-cars'])assert.match(fs.readFileSync(`${dir}/detail.html`,'utf8'),/half-cut-detail\.js\?v=seo015-links-20260905/);
});

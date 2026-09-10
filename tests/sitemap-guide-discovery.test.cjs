const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildSitemapXml}=require('../server/lib/sitemap');
test('discovers nested public guide pages, canonical directory indexes and excludes noindex',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ap-sitemap-guides-'));
 try{for(const [name,body] of Object.entries({'guides/index.html':'<h1>Guides</h1>','guides/engines/index.html':'<h1>Engines</h1>','guides/engines/m260-920.html':'<h1>M260.920</h1>','guides/engine-index.html':'<h1>Engine index</h1>','guides/engines/draft.html':'<meta content="noindex,follow" name="robots">','guides/.private/hidden.html':'<h1>Private</h1>'})){const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,body)}
 const xml=buildSitemapXml({publicDir:root,siteUrl:'https://asia-power.com',approved:[]});
 for(const loc of ['/guides/','/guides/engines/','/guides/engines/m260-920.html','/guides/engine-index.html'])assert.equal(xml.split(`<loc>https://asia-power.com${loc}</loc>`).length-1,1);
 assert(!xml.includes('/draft.html'));assert(!xml.includes('/.private/'));assert(!xml.includes('/guides/index.html'));
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

'use strict';
// Run under a Release Manager release after backup. Repairs only this audited approved record.
const fs=require('fs');const path=require('path');const assert=require('assert/strict');const {spawnSync}=require('child_process');
const root=process.cwd(), releaseId=process.argv[2];
assert.match(releaseId||'',/^REL-[A-Za-z0-9-]+$/);
const rel=path.join(root,'releases',releaseId);assert.ok(fs.existsSync(path.join(rel,'snapshots')));
require(path.join(root,'lib/load-env')).loadEnv(root);
const media=require(path.join(root,'lib/media-storage'));
const file=path.join(root,'data/half-cut-approved.json');const stockId='HC250571';
(async()=>{
 let all=JSON.parse(fs.readFileSync(file));const original=all.find(x=>x.stockId===stockId);assert.ok(original);
 assert.equal(original.slug,'mercedes-benz-e-2010-271-860-half-cut-hc250571');assert.equal(original.photos.length,3);
 const filenames=['photo-1783905215779-898ae12e','photo-1783905221251-989053b5','photo-1783905234848-fd8ad01e'];
 if(original.photos.every(p=>p.url.startsWith('/uploads/photos/'))){console.log('SEO015_MEDIA_ALREADY_PUBLIC');return;}
 original.photos.forEach((p,i)=>assert.ok(p.url.startsWith('/uploads/pending/photos/'+filenames[i]+'_full.webp?')));
 fs.writeFileSync(path.join(rel,'media-HC250571-before.json'),JSON.stringify({stockId,photos:original.photos},null,2),{mode:0o600,flag:'wx'});
 const r2=require(path.join(root,'lib/r2-storage'));assert.ok(r2.isEnabled());
 for(const photo of original.photos){for(const field of ['url','thumbUrl']){
   const from=photo[field].split('?')[0].slice(1), to=from.replace('uploads/pending/','uploads/');
   const source=await r2.getObjectBuffer(from), existing=await r2.getObjectBuffer(to);
   assert.ok(source && source.length>0,'approved image source unavailable');
   assert.ok(!existing || source.equals(existing),'public destination differs; refusing overwrite');
 }}
 const promoted=await media.promoteRecordMediaAsync(root,original);
 for(const p of promoted.photos){
  for(const field of ['url','thumbUrl']){
   assert.ok(p[field].startsWith('/uploads/photos/'));assert.ok(!p[field].includes('?'));
   const r=spawnSync('curl',['-sS','-L','-I','--max-time','20','-o','/dev/null','-w','%{http_code}','https://asia-power.com'+p[field]],{encoding:'utf8'});
   assert.equal(r.status,0);assert.equal(r.stdout,'200');
  }
 }
 // Re-read after network I/O; preserve concurrent changes to every other record and field.
 all=JSON.parse(fs.readFileSync(file));const index=all.findIndex(x=>x.stockId===stockId);
 assert.ok(index>=0);assert.deepEqual(all[index].photos,original.photos);
 all[index]={...all[index],photos:promoted.photos};
 const temp=file+'.seo015.tmp';fs.writeFileSync(temp,JSON.stringify(all,null,2)+'\n',{mode:fs.statSync(file).mode});fs.renameSync(temp,file);
 console.log(JSON.stringify({stockId,photos:3,publicFilesVerified:6,otherFields:'preserved',status:'repaired'}));
})().catch(e=>{console.error(e.message);process.exitCode=1});

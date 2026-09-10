import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {VALID_TARGETS,TARGET_SOURCE_FILES,generateReleaseId,runPreDeployValidation,snapshotRemotePaths,runPostDeployValidation,buildReleaseRecord,writeReleaseJson,printDeploymentSummary} from './lib/release-manager.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),remote='root@159.65.86.24',site='/root/.openclaw/workspace/inventory-site',target='site-content';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/site-content-manifest.json')));
const run=(cmd,args,input)=>{let r=spawnSync(cmd,args,{cwd:root,input,encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error((r.stderr||r.stdout||cmd).slice(-4000));return r.stdout};
for(const e of manifest){if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,e.local))).digest('hex')!==e.sha256)throw Error('Manifest drift: '+e.local)}
VALID_TARGETS.push(target);TARGET_SOURCE_FILES[target]=manifest.map(e=>e.local);
const id=generateReleaseId(target,run('git',['rev-parse','--short','HEAD']).trim()),timestamp=new Date().toISOString(),localDir=path.join(root,'releases',id),rel=site+'/releases/'+id;console.log('Release:',id);
const pre=runPreDeployValidation({root,target,remote,allowDirty:false,yes:process.argv.includes('--yes'),releaseId:id});console.log(JSON.stringify(pre.checks));if(pre.status==='fail')throw Error('Predeploy failed');
const snapshots=[site+'/public/guides',...manifest.filter(e=>!e.remote.includes('/public/guides/')).map(e=>e.remote)];if(!snapshotRemotePaths({remote,releaseId:id,paths:snapshots}))throw Error('Snapshot failed');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ap-content-release-'));for(const [i,e] of manifest.entries())fs.copyFileSync(path.join(root,e.local),path.join(temp,String(i)));fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(manifest));run('tar',['-czf',temp+'.tar.gz','-C',temp,'.']);run('rsync',['-a',temp+'.tar.gz',remote+':'+rel+'/payload.tar.gz']);run('ssh',[remote,`mkdir -p '${rel}/staging'; tar -xzf '${rel}/payload.tar.gz' -C '${rel}/staging'`]);
const installer=String.raw`import json,hashlib,os,shutil,subprocess,sys
from pathlib import Path
rel=Path(sys.argv[1]);site=Path('/root/.openclaw/workspace/inventory-site');rows=json.loads((rel/'staging/manifest.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def restore():
 for i,e in enumerate(rows):
  dst=Path(e['remote']);backup=rel/'originals'/str(i)
  if backup.exists():shutil.copy2(backup,dst)
  elif e['before'] is None and dst.exists():
   (rel/'withdrawn').mkdir(exist_ok=True);shutil.move(str(dst),str(rel/'withdrawn'/str(i)))
 subprocess.run(['systemctl','restart','inventory-site.service'],check=True)
if '--restore' in sys.argv:restore();print('RESTORED');sys.exit(0)
for i,e in enumerate(rows):
 assert sha(Path(e['remote']))==e['before'],'Production changed since baseline: '+e['remote']
 assert sha(rel/'staging'/str(i))==e['sha256'],'Staging mismatch'
(rel/'originals').mkdir(exist_ok=True)
for i,e in enumerate(rows):
 if e['before'] is not None:shutil.copy2(e['remote'],rel/'originals'/str(i))
try:
 for i,e in enumerate(rows):
  dst=Path(e['remote']);dst.parent.mkdir(parents=True,exist_ok=True);tmp=dst.with_name(dst.name+'.content-release-tmp');shutil.copy2(rel/'staging'/str(i),tmp);os.replace(tmp,dst)
 for e in rows:assert sha(Path(e['remote']))==e['sha256']
 subprocess.run(['node','--check',str(site/'lib/sitemap.js')],check=True)
 if any(e['local']=='server/lib/sitemap.js' for e in rows):subprocess.run(['systemctl','restart','inventory-site.service'],check=True)
 subprocess.run(['systemctl','is-active','inventory-site.service'],check=True)
except Exception:
 restore();raise
print('INSTALLED '+str(len(rows)))
`;
run('ssh',[remote,`cat > '${rel}/install.py'`],installer);console.log(run('ssh',[remote,'python3',rel+'/install.py',rel]));
let post=await runPostDeployValidation({root,target,remote,baseUrl:'https://asia-power.com',releaseId:id});
post.checks.push({name:'scoped_hash_verification',status:'pass',detail:`${manifest.length} staged and installed SHA-256 matches; all previous hashes checked before installation.`});
for(const url of ['/','/guides/','/guides/engines/','/guides/engines/dsva.html','/guides/engines/dtka.html','/engine-guides-sitemap.xml','/sitemap.xml']){try{let r=await fetch('https://asia-power.com'+url);let text=await r.text();const marker=url==='/guides/engines/'?'finder-form':url==='/sitemap.xml'?'dsva.html':null;post.checks.push({name:'public '+url,status:r.ok&&(!marker||text.includes(marker))?'pass':'fail',detail:String(r.status)+(marker?' / '+marker:'')})}catch(e){post.checks.push({name:'public '+url,status:'fail',detail:e.message})}}
post.status=post.checks.some(c=>c.status==='fail')?'fail':'pass';
const record=buildReleaseRecord({releaseId:id,git:pre.git,target,remote,timestamp,changedFiles:manifest.map(e=>e.local),pre,post,backupPath:pre.backup_path,backupMode:pre.backup_mode,localReleaseJson:path.join(localDir,'release.json')});record.scoped_manifest=manifest;record.restore_command=`ssh ${remote} python3 ${rel}/install.py ${rel} --restore`;record.recovery.restore_command=record.restore_command;writeReleaseJson({remote,release:record,localDir});printDeploymentSummary(record);if(post.status==='fail'){console.error(JSON.stringify(post.checks));process.exitCode=1}

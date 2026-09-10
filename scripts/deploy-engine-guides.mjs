#!/usr/bin/env node
/** Scoped engine-guide release using OPS-005 Release Manager. No service/config mutation. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateReleaseId,runPreDeployValidation,runPostDeployValidation,snapshotRemotePaths,buildReleaseRecord,writeReleaseJson,printDeploymentSummary} from './lib/release-manager.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REPORT='docs/reports/engine-guides-20260910';
const REMOTE='root@159.65.86.24';
const PUBLIC='/root/.openclaw/workspace/inventory-site/public';
const BASE='https://asia-power.com';
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,REPORT,'release-manifest.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function run(cmd,args,options={}){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:12*1024*1024,...options});if(r.status!==0)throw Error(`${cmd} failed: ${(r.stderr||r.stdout||r.error||'').toString().slice(-1600)}`);return r.stdout;}
function sshPython(code){return run('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=20',REMOTE,'python3','-'],{input:code});}
function assertManifest(){
 if(manifest.length!==57 || new Set(manifest.map(x=>x.path)).size!==57)throw Error('Unexpected manifest count');
 for(const m of manifest){if(!/^(guides\/engines\/[a-z0-9-]+\.html|guides\/index\.html|engines\/index\.html|robots\.txt|engine-guides-sitemap\.xml)$/.test(m.path))throw Error('Path outside release scope');if(sha(fs.readFileSync(path.join(ROOT,m.path)))!==m.sha256)throw Error('Source hash mismatch: '+m.path);}
}
assertManifest();
run('python3',['scripts/validate-engine-guides.py'],{cwd:ROOT});
const short=run('git',['rev-parse','--short','HEAD'],{cwd:ROOT}).trim();
const releaseId=generateReleaseId('engine-guides',short);
console.log('Release',releaseId,'—',manifest.length,'static files');
if(!process.argv.includes('--yes'))throw Error('Use --yes for the user-authorized release');
const pre=runPreDeployValidation({root:ROOT,target:'engine-guides',remote:REMOTE,allowDirty:false,yes:true,releaseId});
console.log(JSON.stringify(pre.checks,null,2));
if(pre.status!=='pass')throw Error('Release Manager preflight failed');
const releaseDir=`/root/.openclaw/workspace/inventory-site/releases/${releaseId}`;
const manifestLiteral=JSON.stringify(JSON.stringify(manifest));
const common=`import pathlib,json,hashlib,os,shutil\nmanifest=json.loads(${manifestLiteral})\nroot=pathlib.Path(${JSON.stringify(PUBLIC)})\nrelease=pathlib.Path(${JSON.stringify(releaseDir)})\ndef digest(p): return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None\n`;
const baseline=common+`for m in manifest:\n p=root/m['path']\n if p.is_symlink(): raise RuntimeError('Symlink target forbidden: '+m['path'])\n if digest(p)!=m['before_sha256']: raise RuntimeError('Live content changed since review: '+m['path'])\nprint('BASELINES_OK')\n`;
console.log(sshPython(baseline).trim());
if(!snapshotRemotePaths({remote:REMOTE,releaseId,paths:manifest.map(m=>PUBLIC+'/'+m.path)}))throw Error('Snapshot failed');
run('ssh',['-o','BatchMode=yes',REMOTE,`mkdir -p '${releaseDir}/payload'`]);
// An explicit files list prevents unrelated work or deletions entering this release.
run('rsync',['-a','--files-from=-',ROOT+'/',REMOTE+':'+releaseDir+'/payload/'],{input:manifest.map(m=>m.path).join('\n')+'\n'});
console.log(sshPython(common+`(release/'manifest.json').write_text(json.dumps(manifest,indent=2))\nfor m in manifest:\n if digest(release/'payload'/m['path'])!=m['sha256']: raise RuntimeError('Staged hash mismatch')\nprint('STAGED_HASHES_OK')\n`).trim());
// All preconditions are checked before the first write. Failures restore only this transaction.
const install=common+`stage=release/'payload'\nsnaps=release/'snapshots'\ndef snap(p): return snaps/str(p).lstrip('/').replace('/','_')\nfor m in manifest:\n p=root/m['path']\n if digest(p)!=m['before_sha256']: raise RuntimeError('Concurrent update: '+m['path'])\n if digest(stage/m['path'])!=m['sha256']: raise RuntimeError('Staged hash mismatch: '+m['path'])\n if m['before_sha256'] and digest(snap(p))!=m['before_sha256']: raise RuntimeError('Backup hash mismatch: '+m['path'])\nwritten=[]\ntry:\n for m in manifest:\n  p=root/m['path'];p.parent.mkdir(parents=True,exist_ok=True)\n  temp=p.with_name(p.name+'.'+release.name+'.tmp')\n  shutil.copyfile(stage/m['path'],temp);os.chmod(temp,0o644);os.replace(temp,p);written.append(m)\n for m in manifest:\n  if digest(root/m['path'])!=m['sha256']: raise RuntimeError('Installed hash mismatch')\nexcept Exception:\n for m in reversed(written):\n  p=root/m['path']\n  if m['before_sha256']: shutil.copyfile(snap(p),p)\n  elif p.exists():\n   dest=release/'rolled-back-new'/m['path'];dest.parent.mkdir(parents=True,exist_ok=True);os.replace(p,dest)\n raise\nprint('INSTALLED_57_HASHES_OK')\n`;
console.log(sshPython(install).trim());
// Store a hash-guarded rollback script. Newly introduced files are moved, not discarded.
const rollback=common+`snaps=release/'snapshots'\nfor m in manifest:\n if digest(root/m['path'])!=m['sha256']: raise RuntimeError('Later change detected; manual review required: '+m['path'])\nfor m in reversed(manifest):\n p=root/m['path']\n if m['before_sha256']:\n  old=snaps/str(p).lstrip('/').replace('/','_')\n  if digest(old)!=m['before_sha256']: raise RuntimeError('Backup mismatch')\n  temp=p.with_name(p.name+'.restore.tmp');shutil.copyfile(old,temp);os.chmod(temp,0o644);os.replace(temp,p)\n else:\n  dest=release/'rolled-back-new'/m['path'];dest.parent.mkdir(parents=True,exist_ok=True);os.replace(p,dest)\nprint('ROLLBACK_OK')\n`;
sshPython(`import pathlib\np=pathlib.Path(${JSON.stringify(releaseDir+'/rollback.py')})\np.write_text(${JSON.stringify(rollback)})\n`);
const post=await runPostDeployValidation({root:ROOT,target:'engine-guides',remote:REMOTE,baseUrl:BASE,releaseId});
post.checks.push({name:'all_remote_file_hashes',status:'pass',detail:'57/57 installed hashes match reviewed release'});
// Public-edge reads use curl; Python's default user agent is rejected by existing edge rules.
let publicChecks=[];
for(const m of manifest){
 const route='/'+m.path.replace(/index\.html$/,'');
 try{
  const text=run('curl',['--fail','--silent','--show-error','--location','--max-time','20',BASE+route]);
  const good=m.path.startsWith('guides/engines/')?text.includes('Start with the engine code.')||text.includes('Engine applications &amp; buying guide'):m.path.endsWith('index.html')?text.includes('engine-guides-20260910:start'):m.path==='robots.txt'?text.includes('Sitemap: '+BASE+'/engine-guides-sitemap.xml'):text.includes('<urlset')&&text.includes('/guides/engines/byd472qc.html');
  publicChecks.push({path:m.path,status:good?'pass':'fail',detail:good?'HTTP 200 and expected content':'Unexpected public content'});
 }catch(e){publicChecks.push({path:m.path,status:'fail',detail:e.message});}
}
post.checks.push({name:'all_public_routes',status:publicChecks.every(x=>x.status==='pass')?'pass':'fail',detail:`${publicChecks.filter(x=>x.status==='pass').length}/${manifest.length} public routes contain expected content`});
post.status=post.checks.some(x=>x.status==='fail')?'fail':'pass';
const localDir=path.join(ROOT,'releases',releaseId);
const release=buildReleaseRecord({releaseId,git:pre.git,target:'engine-guides',remote:REMOTE,timestamp:new Date().toISOString(),changedFiles:manifest.map(m=>m.path),pre,post,backupPath:pre.backup_path,backupMode:pre.backup_mode,localReleaseJson:path.join(localDir,'release.json')});
release.recovery.restore_command=`ssh ${REMOTE} python3 ${releaseDir}/rollback.py`;
release.public_routes=publicChecks;release.manifest=manifest;
writeReleaseJson({remote:REMOTE,release,localDir});
printDeploymentSummary(release);
console.log(JSON.stringify({release_id:releaseId,status:post.status,public_failures:publicChecks.filter(x=>x.status==='fail')},null,2));
if(post.status!=='pass')process.exitCode=1;

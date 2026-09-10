import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateReleaseId,runPreDeployValidation,snapshotRemotePaths,TARGET_REMOTE_PATHS,runPostDeployValidation,buildReleaseRecord,writeReleaseJson,printDeploymentSummary} from './lib/release-manager.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), remote='root@159.65.86.24', site='/root/.openclaw/workspace/inventory-site';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/product-layout-manifest.json')));
function run(cmd,args,input){const x=spawnSync(cmd,args,{input,encoding:'utf8',cwd:root});if(x.status!==0)throw Error((x.stderr||x.stdout||cmd).slice(-3000));return x.stdout;}
const target='product-layout',id=generateReleaseId(target,run('git',['rev-parse','--short','HEAD']).trim()),timestamp=new Date().toISOString();
console.log('Release:',id);
const pre=runPreDeployValidation({root,target,remote,allowDirty:false,yes:process.argv.includes('--yes'),releaseId:id});
console.log(JSON.stringify(pre.checks));if(pre.status==='fail')throw Error('Predeploy failed');
if(!snapshotRemotePaths({remote,releaseId:id,paths:TARGET_REMOTE_PATHS[target]}))throw Error('Snapshot failed');
const rel=`${site}/releases/${id}`;
run('ssh',[remote,'mkdir','-p',rel+'/staging']);
let checks='',install='',restore='',verify='';
for(const [i,[f,old]] of Object.entries(manifest).entries()){
 const dest=site+'/public/'+f, snap=dest.slice(1).replaceAll('/','_'),hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
 run('rsync',['-a',path.join(root,f),`${remote}:${rel}/staging/${i}`]);
 checks+=`test "$(sha256sum '${dest}' | cut -d ' ' -f1)" = '${old}'\ntest "$(sha256sum '${rel}/staging/${i}' | cut -d ' ' -f1)" = '${hash}'\n`;
 restore+=`cp -a '${rel}/snapshots/${snap}' '${dest}'\n`;
 install+=`cp '${rel}/staging/${i}' '${dest}.layout.tmp'\nmv '${dest}.layout.tmp' '${dest}'\n`;
 verify+=`test "$(sha256sum '${dest}' | cut -d ' ' -f1)" = '${hash}'\n`;
}
run('ssh',[remote,'bash','-s'],`set -euo pipefail\n${checks}\nrollback(){ trap - ERR; ${restore}\nexit 1; }\ntrap rollback ERR\n${install}\n${verify}\nnode --check '${site}/public/js/half-cut-detail.js'\ntrap - ERR\necho INSTALLED\n`);
const post=await runPostDeployValidation({root,target,remote,baseUrl:'https://asia-power.com',releaseId:id});
post.checks.push({name:'deployed_hashes',status:'pass',detail:'All eight deployed files match staged SHA-256; prior hashes checked before install.'});
const record=buildReleaseRecord({releaseId:id,git:pre.git,target,remote,timestamp,changedFiles:pre.changed_files,pre,post,backupPath:pre.backup_path,backupMode:pre.backup_mode,localReleaseJson:path.join(root,'releases',id,'release.json')});
writeReleaseJson({remote,release:record,localDir:path.join(root,'releases',id)});printDeploymentSummary(record);if(post.status==='fail')process.exit(1);

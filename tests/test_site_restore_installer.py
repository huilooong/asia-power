from pathlib import Path
import re,tempfile,json,hashlib,subprocess,os
s=Path('scripts/deploy-site-restore.mjs').read_text();installer=re.search(r'const installer=String.raw`(.*?)`;',s,re.S).group(1)
with tempfile.TemporaryDirectory() as td:
 d=Path(td);(d/'staging').mkdir();(d/'bin').mkdir();stub=d/'bin/systemctl';stub.write_text('#!/bin/sh\nexit 0\n');stub.chmod(0o755);env=dict(os.environ,PATH=str(d/'bin')+':'+os.environ['PATH']);target=d/'page.html';target.write_text('old');(d/'staging/0').write_text('new');h=lambda b:hashlib.sha256(b.encode()).hexdigest();row={'local':'page.html','remote':str(target),'before':h('old'),'sha256':h('new')};(d/'staging/manifest.json').write_text(json.dumps([row]));(d/'install.py').write_text(installer)
 target.write_text('drift');p=subprocess.run(['python3',str(d/'install.py'),str(d)],capture_output=True,env=env);assert p.returncode!=0 and target.read_text()=='drift';print('PASS baseline drift blocks without overwrite')
 target.write_text('old');p=subprocess.run(['python3',str(d/'install.py'),str(d)],capture_output=True,env=env);assert p.returncode==0 and target.read_text()=='new';print('PASS install verifies payload and preserves old file')
 target.write_text('later');p=subprocess.run(['python3',str(d/'install.py'),str(d),'--restore'],capture_output=True,env=env);assert p.returncode!=0 and target.read_text()=='later';print('PASS rollback refuses later change')
 target.write_text('new');p=subprocess.run(['python3',str(d/'install.py'),str(d),'--restore'],capture_output=True,env=env);assert p.returncode==0 and target.read_text()=='old';print('PASS scoped rollback restores old file')

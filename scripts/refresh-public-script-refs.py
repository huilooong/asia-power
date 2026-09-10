import json,subprocess,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
script=r'''from pathlib import Path
import re,json
root=Path('/root/.openclaw/workspace/inventory-site/public');out={}
for p in root.rglob('*.html'):
 rel=str(p.relative_to(root))
 if any(x.startswith('.') for x in p.relative_to(root).parts):continue
 if any(x in p.relative_to(root).parts for x in ['admin','supplier-portal','buyer-portal','uploads','data','docs','node_modules']):continue
 text=p.read_text(errors='replace')
 if re.search(r'(?:src|href)=["\'][^"\']*js/(?:path-utils|public-i18n)\.js',text):out[rel]=text
print(json.dumps(out))'''
raw=json.loads(subprocess.check_output(['ssh','-o','BatchMode=yes','root@159.65.86.24','python3','-'],input=script.encode()))
changed=[]
for rel,text in raw.items():
 p=root/rel
 # Own source already includes the released edits; merge references into that version.
 new=re.sub(r'((?:src|href)=["\'][^"\']*js/(?:path-utils|public-i18n)\.js)(?:\?[^"\']*)?(["\'])',r'\1?v=site-content-language-20260910\2',text)
 if new!=text:p.parent.mkdir(parents=True,exist_ok=True);p.write_text(new);changed.append(rel)
(root/'scripts/site-content-cache-pages.json').write_text(json.dumps(changed,indent=2));print('Public page resource references:',len(changed))

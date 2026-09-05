#!/usr/bin/env python3
"""Reject a release whose page/script/style dependencies are neither deployed nor live."""
import argparse,concurrent.futures,json,sys
from pathlib import Path
from urllib.parse import urlsplit
from importlib.util import spec_from_file_location,module_from_spec
spec=spec_from_file_location('audit',Path(__file__).with_name('audit-public-assets.py'));audit=module_from_spec(spec);spec.loader.exec_module(audit)

def references(content,url,content_type=""):
 suffix=Path(urlsplit(url).path).suffix
 if 'text/html' in content_type:suffix='.html'
 if suffix=='.html':
  page=audit.Page();page.feed(content);return page.resources+audit.css_refs(content)+audit.js_refs(content)
 if suffix=='.css':return audit.css_refs(content)
 if suffix=='.js':return audit.js_refs(content)
 return []
def check(root,planned,fetcher=audit.fetch,seeds=None):
 root=Path(root).resolve();paths={}
 for rel in planned:
  p=(root/rel).resolve()
  if not p.is_relative_to(root) or not p.is_file():continue
  if rel.startswith(('server/','deploy/','scripts/','tests/','docs/','agents/')):continue
  paths['/'+rel]=p
 todo={audit.ORIGIN+k for k in paths if Path(k).suffix in ['.html','.js','.css']} | set(seeds or []);seen=set();failures=[];remote_count=0
 while todo:
  batch=todo-seen;todo=set();seen.update(batch)
  def read(u):
   p=paths.get(urlsplit(u).path)
   if p:return {'url':u,'status':200,'type':{'.css':'text/css','.js':'application/javascript','.html':'text/html'}.get(p.suffix,''),'_body':p.read_bytes(),'planned':True}
   return fetcher(u)
  with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
   for r in pool.map(read,sorted(batch)):
    u=r['url'];suffix=Path(urlsplit(u).path).suffix
    if not r.get('planned'):remote_count+=1
    wrong=(suffix=='.css' and 'text/css' not in r['type']) or (suffix=='.js' and not any(t in r['type'] for t in ['javascript','ecmascript']))
    if r['status']!=200 or wrong:
     failures.append({'url':u,'status':r['status'],'type':r['type'],'reason':'missing or wrong content type'});continue
    content=r.get('_body',b'').decode(errors='replace')
    for raw in references(content,u,r['type']):
     base=audit.ORIGIN+'/' if suffix=='.js' else u
     dep=audit.resolve(raw,base)
     if dep and Path(urlsplit(dep).path).suffix.lower() in ['.css','.js','.svg','.png','.jpg','.jpeg','.webp','.woff','.woff2','.ico'] and dep not in seen:todo.add(dep)
 return {'status':'fail' if failures else 'pass','checked':len(seen),'remote_checked':remote_count,'failures':failures}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--root',required=True);args=parser.parse_args();result=check(args.root,json.load(sys.stdin));print(json.dumps(result));sys.exit(result['status']!='pass')

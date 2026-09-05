#!/usr/bin/env python3
"""Read-only crawl of published pages and their resource graph; never submits forms."""
import argparse,concurrent.futures,hashlib,json,re,subprocess,time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin,urlsplit,urlunsplit,unquote
import xml.etree.ElementTree as ET

ORIGIN='https://asia-power.com'
class Page(HTMLParser):
 def __init__(self):
  super().__init__();self.resources=[];self.links=[];self.canonical=[];self.title='';self.in_title=False;self.h1=0;self.robots=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='title':self.in_title=True
  if tag=='h1':self.h1+=1
  if tag=='meta' and a.get('name','').lower()=='robots':self.robots.append(a.get('content',''))
  if tag=='a' and a.get('href'):self.links.append(a['href'])
  if tag=='link':
   rel=a.get('rel','').split()
   if 'canonical' in rel:self.canonical.append(a.get('href',''))
   if any(x in rel for x in ['stylesheet','icon','manifest','preload','modulepreload']):self.resources.append(a.get('href',''))
  if tag in ['script','img','source','video','audio','iframe','input','embed']:
   for key in ['src','poster']:
    if a.get(key):self.resources.append(a[key])
   if a.get('srcset') and not a['srcset'].startswith('data:'):
    self.resources.extend(x.strip().split()[0] for x in a['srcset'].split(',') if x.strip())
  if a.get('style'):self.resources.extend(css_refs(a['style']))
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
 def handle_data(self,data):
  if self.in_title:self.title+=data

def css_refs(text):return re.findall(r'url\(\s*[\"\']?([^\)\"\']+)',text)+re.findall(r'@import\s+[\"\']([^\"\']+)',text)
def js_refs(text):
 # Statically resolvable resource strings only; expressions are reported separately by browser smoke tests.
 return re.findall(r'[\"\'`]((?:/|\./|\.\./)?(?:css|js|assets)/[^\"\'\s<>`+{}]+\.(?:css|js|png|jpe?g|webp|svg|woff2?)(?:\?[^\"\'\s<>`]*)?)[\"\'`]',text)
def resolve(raw,base):
 if not raw or unquote(raw).startswith('#') or raw.startswith(('data:','blob:','javascript:','mailto:','tel:','#')):return None
 raw=raw.split('?')[0] if '${' in raw else raw
 u=urlsplit(urljoin(base,raw.strip()))
 if u.hostname not in ['asia-power.com','www.asia-power.com']:return None
 return urlunsplit(('https','asia-power.com',u.path or '/',u.query,''))
def page_link(u):
 p=urlsplit(u).path
 return not p.startswith(('/cdn-cgi/l/email-protection','/api/','/admin/','/data/','/docs/','/reports/','/uploads/','/login','/supplier-portal','/buyer-portal')) and (p.endswith(('/','.html')) or '.' not in p.split('/')[-1])
def fetch(u):
 t=time.time(); binary=bool(re.search(r'\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp4|pdf)$',urlsplit(u).path,re.I)); r=subprocess.run(['curl']+(['--head'] if binary else [])+['-sS','-L','--max-time','30','--retry','1','--retry-delay','1','-A','AsiaPower-Asset-Audit-bot/1.0','-w','\n%{http_code}\t%{content_type}\t%{url_effective}',u],capture_output=True)
 data,_,tail=r.stdout.rpartition(b'\n'); bits=tail.decode(errors='replace').split('\t');status=int(bits[0]) if bits and bits[0].isdigit() else 0
 return {'url':u,'status':status,'type':bits[1] if len(bits)>1 else '', 'final':bits[2] if len(bits)>2 else u,'method':'HEAD' if binary else 'GET','bytes':None if binary else len(data),'ms':round((time.time()-t)*1000),'error':r.stderr.decode(errors='replace')[:200] if r.returncode else '', '_body':data}
def run(output,seeds_file=None):
 output=Path(output);output.mkdir(parents=True,exist_ok=True)
 sitemap=fetch(ORIGIN+'/sitemap.xml');assert sitemap['status']==200
 seeds={e.text for e in ET.fromstring(sitemap['_body']).iter() if e.tag.endswith('loc') and e.text}
 sitemap_count=len(seeds)
 if seeds_file:seeds.update(json.loads(Path(seeds_file).read_text()))
 todo={u:'page' for u in seeds};seen={};parents={};external=set();rounds=0
 while todo:
  batch=todo;todo={};rounds+=1
  with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
   futures=[pool.submit(fetch,u) for u in batch]
   for n,future in enumerate(concurrent.futures.as_completed(futures),1):
    r=future.result()
    u=r['url'];kind=batch[u];body=r.pop('_body');r['kind']=kind;seen[u]=r
    if r['status']!=200:continue
    suffix=Path(urlsplit(u).path).suffix.lower()
    if kind=='asset' and ((suffix=='.css' and 'text/css' not in r['type']) or (suffix=='.js' and not any(t in r['type'] for t in ['javascript','ecmascript']))):r['wrong_mime']=True
    content=body.decode(errors='replace');refs=[]
    if 'html' in r['type']:
     if kind=='asset':r['unexpected_html']=True;continue
     p=Page();p.feed(content);r.update(title=p.title,h1=p.h1,canonical=p.canonical,robots=p.robots)
     refs +=[(raw,'asset') for raw in p.resources+css_refs(content)+js_refs(content)]
     refs +=[(raw,'page') for raw in p.links]
    elif 'css' in r['type'] or urlsplit(u).path.endswith('.css'):refs +=[(raw,'asset') for raw in css_refs(content)]
    elif 'javascript' in r['type'] or urlsplit(u).path.endswith('.js'):refs +=[(raw,'asset') for raw in js_refs(content)]
    for raw,k in refs:
     # JS resource strings like css/foo are rooted by the site's loader.
     base=ORIGIN+'/' if kind=='asset' and urlsplit(u).path.endswith('.js') else r['final']
     target=resolve(raw,base)
     if not target:
      if raw.startswith(('https://','http://','//')):external.add(raw)
      continue
     if k=='page' and not page_link(target):continue
     parents.setdefault(target,set()).add(u)
     if target not in seen and target not in batch:todo[target]=k
    if n%100==0:print(f'round {rounds}: {n}/{len(batch)} checked',flush=True)
  (output/f'checkpoint-{rounds}.json').write_text(json.dumps({'results':seen,'pending':todo}))
  print(f'completed round {rounds}: {len(seen)} URLs, next {len(todo)}',flush=True)
  if len(seen)+len(todo)>12000:raise RuntimeError('Unexpected crawl expansion; inspect seeds')
 results=[dict(r,sources=sorted(parents.get(u,[]))) for u,r in sorted(seen.items())]
 failures=[r for r in results if r['status']!=200 or r.get('unexpected_html') or r.get('wrong_mime')]
 report={'checked_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sitemap_pages':sitemap_count,'initial_seed_pages':len(seeds),'checked':len(results),'pages':sum(r['kind']=='page' for r in results),'assets':sum(r['kind']=='asset' for r in results),'failures':failures,'external_resources_not_checked':sorted(external),'results':results}
 serialized=json.dumps(report,ensure_ascii=False,indent=2)
 serialized=re.sub(r'([?&](?:access|exp)=)[A-Za-z0-9%._-]+',r'\1REDACTED',serialized)
 (output/'audit.json').write_text(serialized+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['results','external_resources_not_checked','failures']}));print('FAILURES',len(failures));return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--seeds');a=p.parse_args();run(a.output,a.seeds)

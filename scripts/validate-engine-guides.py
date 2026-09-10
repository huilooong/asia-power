#!/usr/bin/env python3
"""Validate all released engine guide HTML, evidence rows, links and structured data."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse,unquote
import json,re,hashlib,sys,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1];R=ROOT/'docs/reports/engine-guides-20260910'
class Doc(HTMLParser):
 def __init__(self,t):
  super().__init__();self.ids=[];self.links=[];self.assets=[];self.h1=0;self.canonical=[];self.ld=[];self.scripts=[];self.text=[];self.capture=None;self.buf='';self.feed(t)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='h1':self.h1+=1
  if tag=='a' and a.get('href'):self.links.append(a['href'])
  if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a['href'])
  if tag=='link' and a.get('rel')=='stylesheet':self.assets.append(a['href'])
  if tag in ['script','img'] and a.get('src'):self.assets.append(a['src'])
  if tag=='script' and not a.get('src'):self.capture='ld' if a.get('type')=='application/ld+json' else 'js';self.buf=''
 def handle_data(self,t):
  if self.capture:self.buf+=t
  else:self.text.append(t)
 def handle_endtag(self,tag):
  if tag=='script' and self.capture:
   (self.ld if self.capture=='ld' else self.scripts).append(self.buf);self.capture=None
live_assets={x['path']:x for x in json.loads((R/'live-asset-check.json').read_text())}
manifest=json.loads((R/'release-manifest.json').read_text());d=json.loads((R/'engine-verification.json').read_text());errors=[];pages=[]
check=lambda cond,msg:errors.append(msg) if not cond else None
check(len(d['engines'])==52,'engine count')
check(len({e['code'] for e in d['engines']})==52,'duplicate engine codes')
check(not set(d['removed']) & {e['code'] for e in d['engines']},'removed priority codes included')
check('L13Z' not in {e['code'] for e in d['engines']},'ambiguous unsuffixed content code')
for e in d['engines']:
 check(bool(e['applications']),e['code']+': missing applications')
 for a in e['applications']:
  for key in ['vehicle','dates','variant','market','source']:check(bool(a.get(key)),e['code']+': missing '+key)
  check(a['source'] in d['sources'],e['code']+': unknown source')
for m in manifest:
 p=ROOT/m['path'];b=p.read_bytes();check(hashlib.sha256(b).hexdigest()==m['sha256'],str(p)+': hash')
 if not p.suffix=='.html':continue
 t=b.decode();doc=Doc(t);isguide=m['path'].startswith('guides/engines/')
 check(doc.h1==1,m['path']+': h1 count')
 check(len(doc.ids)==len(set(doc.ids)),m['path']+': duplicate ids')
 check(len(doc.canonical)==1,m['path']+': canonical count')
 if isguide:
  expected='https://asia-power.com/'+m['path'].replace('index.html','')
  check(doc.canonical==[expected],m['path']+': wrong canonical')
  check('<meta name="robots" content="index,follow">' in t,m['path']+': robots')
  check(bool(doc.ld),m['path']+': missing structured data')
 for ld in doc.ld:
  try:json.loads(ld)
  except Exception:errors.append(m['path']+': invalid JSON-LD')
 for href in doc.links+doc.assets:
  u=urlparse(href)
  if u.scheme or u.netloc:continue
  if href.startswith('#'):
   check(unquote(u.fragment) in doc.ids,m['path']+': missing anchor '+href);continue
  target=(ROOT/u.path.lstrip('/')) if u.path.startswith('/') else p.parent/u.path
  if u.path.endswith('/'):target=target/'index.html'
  rel=str(target.resolve().relative_to(ROOT))
  remote_verified=(not isguide and rel in live_assets and live_assets[rel].get('status')==200)
  check(target.exists() or remote_verified,m['path']+': missing local link '+href)
 if isguide and p.name!='index.html':
  code=p.stem.upper();check(code in t,m['path']+': code missing')
  check('data-guide-enquiry="'+code+'"' in t,m['path']+': missing tracked inquiry')
  check(bool(re.search(r'<table>',t)),m['path']+': missing application table')
  check(not any(x in t for x in ['QixiuBao','UNVERIFIED','HC250','current_stock_verified','historical_rows']),m['path']+': internal provenance leak')
  check(not re.search(r'guaranteed stock|guaranteed fit|all models fit|\bInStock\b',t,re.I),m['path']+': unsupported sales claim')
  pages.append(dict(code=code,words=len(' '.join(doc.text).split()),internal_links=len(doc.links),status='pass'))
xml=ET.parse(ROOT/'engine-guides-sitemap.xml');urls=[e.text for e in xml.findall('.//{*}loc')]
check(len(urls)==53 and len(set(urls))==53,'sitemap count')
check('Sitemap: https://asia-power.com/engine-guides-sitemap.xml' in (ROOT/'robots.txt').read_text(),'robots sitemap declaration')
result=dict(status='fail' if errors else 'pass',articles=len(pages),application_rows=sum(len(e['applications']) for e in d['engines']),release_files=len(manifest),errors=errors,pages=pages)
if '--write' in sys.argv:(R/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='pages'},indent=2));sys.exit(bool(errors))

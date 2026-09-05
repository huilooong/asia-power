#!/usr/bin/env python3
import importlib.util,json
from pathlib import Path
spec=importlib.util.spec_from_file_location('guard',Path(__file__).with_name('check-release-assets.py'));guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
urls=[guard.audit.ORIGIN+'/'+p+'/' for p in ['half-cuts','trucks','machinery','engines','gearboxes']]
cache={}
def fetch(u):
 if u not in cache:cache[u]=guard.audit.fetch(u)
 return cache[u]
result=guard.check(Path(__file__).resolve().parents[1],[],fetch,seeds=urls)
assert result['status']=='pass',result
pages=[]
for u in urls:
 r=cache[u];html=r['_body'].decode();p=guard.audit.Page();p.feed(html)
 assert html.count('id="catalog-stock-links"')==1,u
 assert 'Browse recent listings in this category' in html,u
 assert 'detail.html?slug=' in html,u
 assert not any('noindex' in x for x in p.robots),u
 pages.append({'url':u,'quick_links':'pass','noindex':False})
print(json.dumps({'status':'pass','asset_dependencies':result,'catalogs':pages}))
# Revisit the sources of every real audit failure, rather than pretending retired URLs should return 200.
before=json.loads((Path(__file__).resolve().parents[1]/'docs/reports/seo-015-site-assets/before/audit.json').read_text())
ignored=['/cdn-cgi/l/email-protection','/css/%23n']
broken={r['url'] for r in before['failures'] if not any(x in r['url'] for x in ignored)}
sources={u for r in before['failures'] if r['url'] in broken for u in r['sources']}
import concurrent.futures
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for r in pool.map(fetch,sorted(sources)):
  assert r['status']==200,r['url'];html=r['_body'].decode();p=guard.audit.Page();p.feed(html)
  resolved={guard.audit.resolve(raw,r['url']) for raw in p.links+p.resources}
  assert not (resolved & broken),(r['url'],resolved & broken)
  assert '/uploads/pending/photos/' not in html,r['url']
item=fetch(guard.audit.ORIGIN+'/api/half-cuts/public')
stock=next(x for x in json.loads(item['_body'])['approved'] if x['stockId']=='HC250571')
assert len(stock['photos'])==3
for p in stock['photos']:
 for key in ['url','thumbUrl']:
  assert p[key].startswith('/uploads/photos/'),p[key]
  assert fetch(guard.audit.ORIGIN+p[key])['status']==200,p[key]
# CSS/JS variants across the entire initial crawl, even if not in this release's pages.
critical=[r['url'] for r in before['results'] if r['url'].split('?')[0].endswith(('.css','.js')) and '/css/%23n' not in r['url']]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for r in pool.map(fetch,critical):
  assert r['status']==200,r['url'];assert 'html' not in r['type'],r['url']
print(json.dumps({'status':'pass','repaired_source_pages':len(sources),'critical_resource_urls':len(critical),'restored_product_photos':3,'public_photo_files':6}))

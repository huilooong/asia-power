#!/usr/bin/env python3
"""Expand exact, single-code VAG application records from archived source rows."""
import json,re,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];R=ROOT/'docs/reports/engine-guides-20260910';p=R/'engine-verification.json';d=json.loads(p.read_text());existing={e['code']:e for e in d['engines']};before=set(existing);groups=collections.defaultdict(list);pending=[]
def brand(m):return 'Audi' if '/ AUDI' in m else 'Volkswagen' if '/ VW' in m else 'Skoda'
def market(m):
 return 'China catalogue — '+('imported '+brand(m) if '进口' in m else 'FAW Audi' if 'FAW.AUDI' in m else 'SAIC Audi' if 'AUDI (SAIC)' in m else 'FAW Volkswagen' if 'FAW.VW' in m else 'SAIC '+brand(m))
def date(v):return v[5:7]+'/'+v[:4]
for suffix,part in [('live','hu6013z'),('w712-95','w712/95'),('w719-45','w719/45'),('hu7029z','hu7029z'),('hu7024z','hu7024z')]:
 d['sources']['mann-vag-'+suffix]={'url':'https://www.mann-filter.com/cn-zh/catalog/search-results/product.html/'+part+'_mann-filter.html','title':'MANN-FILTER China application catalogue — '+part.upper(),'scope':'Single-code application records, accessed 10 September 2026. Imported catalogue coverage is not proof of China homologation or engine interchangeability.'}
for r in json.loads((R/'vag-evidence/online-rows.json').read_text()):
 c=r.get('engineCode','');start=r.get('vehicleManufacturedFrom','');end=r.get('vehicleManufacturedTo','');variant=r.get('displayVariant',r.get('vehicleName',''))
 if not re.fullmatch('[A-Z]{3,4}',c) or not '1990'<=start<='2026-09-10' or end<'2010' or re.search(r'TDI|SDI|diesel',variant,re.I):pending.append(r);continue
 # Do not present a PHEV system rating as the combustion engine output.
 power=r.get('kw','')+' kW catalogue rating'+(' (hybrid; engine/system basis not specified)' if re.search(r'hybrid|PHEV|TFSI e|GTE',variant,re.I) else '')
 a={'vehicle':brand(r['vehicleMake'])+' '+r['vehicleModel']+' — '+variant,'dates':date(start)+('–'+date(end) if not end.startswith('9999') else '; end not stated'),'variant':power,'market':market(r['vehicleMake']),'source':r['source']}
 groups[c].append((a,brand(r['vehicleMake']),r.get('ccm','')))
# Supplement historic Chinese joint-venture applications. Exclude malformed/grouped code cells.
for r in json.loads((R/'vag-evidence/pdf-rows.json').read_text()):
 c=r['code']
 if '进口' in r['maker'] or not re.fullmatch('[A-Z]{3,4}',c) or re.search(r'TDI|1.9D',r['vehicle']) or ('(B7)' in r['model'] and '(B8)' in r['vehicle']):continue
 # Current online records take precedence for the same code + model.
 if any(r['model'] in a['vehicle'] for a,_,_ in groups[c]):continue
 def olddate(v):return v[:2]+'/'+('20' if int(v[-2:])<40 else '19')+v[-2:]
 a={'vehicle':brand(r['maker'])+' '+r['model']+' — '+r['vehicle'],'dates':olddate(r['start'])+('–'+olddate(r['end']) if r['end'] else '; end not stated in 2020 catalogue'),'variant':r['kw']+' kW catalogue rating','market':market(r['maker']),'source':'mann','page':r['page']}
 groups[c].append((a,brand(r['maker']),''))
for c,rows in groups.items():
 apps=list({json.dumps(a,sort_keys=True):a for a,_,_ in rows}.values());brands=sorted({b for _,b,_ in rows});ccms={v for _,_,v in rows if v.isdigit()};models=list(dict.fromkeys(a['vehicle'].split(' — ')[0] for a in apps));disp=next(iter(ccms))+' cm³ (catalogue)' if len(ccms)==1 else 'Confirm exact donor displacement'
 prior=existing.get(c)
 if prior:
  # Preserve other-market evidence while refreshing this source-backed China subset.
  for a in prior['applications']:
   if a.get('source','').startswith('mann-vag-'):continue
   if a not in apps and not any(a['vehicle'] in n['vehicle'] for n in apps):apps.append(a)
  # Existing CSSA China applications beyond this source subset remain valid.
  if c=='CSSA':
   for a in prior['applications']:
    if not any(a['vehicle'] in n['vehicle'] for n in apps):apps.append(a)
 short='This source uses a three-letter identification code. Do not assume a four-letter suffix or merge it with similarly named variants.' if len(c)==3 else 'Keep all four letters when ordering; a shortened three-letter listing does not identify the same variant by itself.'
 existing[c]={'code':c,'brand':'Volkswagen / Audi / Skoda','application_brands':brands,'displacement':disp,'applications':apps,'buyer_focus':f"{c} is documented for {', '.join(models[:5])}. "+short,'question':f'How should I identify a {c} donor engine?','answer':f"Start with the {c} marking, then match the model and application date shown above. "+short+' EA211 and EA888 are family labels, not substitutes for the recorded code. Confirm ECU, transmission, emissions equipment and the supplied components against the donor VIN.','status':'verified_documented_applications','stock':'Confirm offered unit','sourcing_note':f"Search Chinese donor stock using {c} and the donor model together. "+'The Chinese joint-venture and imported catalogue records above are separate sourcing leads. A shared code or filter application does not establish assembly interchangeability. Request current photos and an itemized offer for the exact unit.','expansion_batch':'vag-china-20260910'}
existing['BSE']['application_brands']=['Volkswagen']
d['engines']=list(existing.values());added=sorted((set(existing)-before)|set(d.get('vag_expansion',{}).get('added_codes',[])));vag=[e for e in d['engines'] if e['brand']=='Volkswagen / Audi / Skoda'];stats={'added_codes':added,'added':len(added),'total_guides':len(existing),'vag_guides':len(vag),'brand_article_counts':{b:sum(b in e.get('application_brands',[]) for e in vag) for b in ['Volkswagen','Audi','Skoda']},'note':'Brand counts overlap for shared engine codes. Coverage is a sourced selection, not an exhaustive China-market register. Grouped code cells remain candidates.'};d['vag_expansion']=stats;p.write_text(json.dumps(d,ensure_ascii=False,indent=2));(R/'vag-evidence/summary.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2));(R/'vag-evidence/pending-grouped-records.json').write_text(json.dumps(pending,ensure_ascii=False,indent=2));print(json.dumps(stats,ensure_ascii=False))

#!/usr/bin/env python3
"""Apply manually reviewed application records; never infer fitment from source text hits."""
import csv,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/reports/engine-africa-expansion-20260910';BASE=ROOT/'docs/reports/engine-guides-20260910'
data=json.loads((BASE/'engine-verification.json').read_text());entries=list(csv.DictReader(open(P/'verified-additions.tsv'),delimiter='\t'));source_rows=json.loads((P/'reviewed-source-rows.json').read_text())
existing={e['code']:e for e in data['engines']};raw_candidates={e['code']:e for e in json.loads((P/'candidate-screen.json').read_text())}
data['sources']['denso-sa']={'url':'https://assets.denso-sales.co.za/production/products/DENSO-Sales-South-Africa-service-parts-catalogue-2026.pdf','title':'DENSO South Africa service-parts catalogue 2026','scope':'Selected application rows only; inconsistent rows are excluded. Catalogue coverage does not measure sales.'}
data['sources']['gud-sa']={'url':'https://www.gud.co.za/wp-content/uploads/pdftemp/Part_Z226_05237ace2c45a84c5de58fec1a099127.pdf','title':'GUD South Africa application catalogue Z226','scope':'2023 catalogue snapshot; component fitment is not complete-engine interchange approval.'}
data['sources']['fram-sa']={'url':'https://www.fram.co.za/wp-content/uploads/pdftemp/Part_PH4985a_7f1b9e870ce469ea8f20e0a89bbc9ef8.pdf','title':'FRAM South Africa application catalogue PH4985a','scope':'2023 catalogue snapshot; an open date does not mean current production.'}
imports={'BSE','CDAA','3RZ-FE','2AR-FE','1MZ-FE','2ZR-FXE','N52B30A','M271.820','M272.967','M274.920'}
def date(v):
 m,y=v.split('/');return m+'/'+str(1900+int(y) if int(y)>26 else 2000+int(y))
for e in entries:
 code=e['code'];apps=[]
 for r in source_rows[code]:
  ds=re.findall(r'\d{2}/\d{2}',r['application_dates_raw']);dates='–'.join(map(date,ds)) if len(ds)==2 else date(ds[0])+' onward; end not stated in 2020 catalogue'
  # Broad multi-code rows do not establish code-specific production boundaries.
  if code in {'BSE','N52B30A'} or (code=='M271.820' and '820/860' in r['engine_row']):dates+='; catalogue groups engine codes, verify exact version'
  if code=='K20A7' and '10/07' in r['application_dates_raw']:dates='Exact engine-specific year range requires VIN confirmation'
  apps.append({'vehicle':r['vehicle'],'dates':dates,'variant':e['displacement']+' petrol; confirm original vehicle specification','market':'China catalogue — imported-vehicle application' if code in imports else 'China-market application','source':'mann','page':r['page']})
 candidate=raw_candidates.get(code,{})
 supply='China-market applications provide donor-search leads, not proof of regular stock. Confirm the exact code and a specific offered unit before ordering.'
 if code in imports:supply='These imported-vehicle applications do not establish high-volume domestic donor supply in China. Ask for a unit-specific sourcing check before budgeting for shipment.'
 if candidate.get('china_public_parts_records',0):supply='China-origin engine or half-cut listings provide a sourcing lead for this code. Reconfirm the actual unit, identity, condition and availability with the seller; a listed record is not a stock audit.'
 existing[code]={'code':code,'brand':e['brand'],'displacement':e['displacement'],'applications':apps,'buyer_focus':e['buying_focus'],'question':f'What should I resolve first when comparing {code} quotations?','answer':e['buying_focus']+' Ask the receiving workshop to compare the offered unit with the original engine and record any parts that must transfer.','status':'verified_documented_applications','stock':'Confirmation required for each offered unit','extra_sources':[],'sourcing_note':supply,'expansion_batch':'africa-20260910'}
# Country-specific applications are explicitly reviewed; no automatic transfer from another market.
extra=[
 ('2H0','Chevrolet Orlando','2011 onward; end not stated','1.8 L','denso-sa',28),
 ('LMU','Chevrolet Aveo','2008 onward; end not stated','1.2 L','denso-sa',27),
 ('SQR372','Chery QQ3','2008 onward; end not stated','0.8 L','denso-sa',27),
 ('JL465Q5','Chana Star','2006 onward; end not stated','1.0 L','denso-sa',27),
 ('JL474Q','Chana Star','2006 onward; end not stated','1.3 L','denso-sa',27),
 ('LF-DE','Mazda3','2004–2009','2.0 L','denso-sa',39),
 ('LF-DE','Mazda6','2003–2005','2.0 L','denso-sa',39),
 ('ZY-VE','Mazda2','2007 onward; end not stated','1.5 L','denso-sa',39),
 ('TU5JP4','Citroen Berlingo','2001 onward; end not stated','1.6 L','denso-sa',29),
 ('RFN','Citroen C5','2001 onward; end not stated','2.0 L; catalogue designation EW10J4 / RFN','denso-sa',29),
 ('G4FA','Kia Rio','2011 onward; end not stated','1.4 L','denso-sa',36),
 ('G4EE','Kia Rio','2005 onward; end not stated','1.4 L','denso-sa',36),
 ('G4FD','Kia Sportage','2018–2022','1.6 L','denso-sa',37),
 ('QR20DE','Nissan X-Trail','2001 onward; end not stated','2.0 L','denso-sa',45),
 ('MR18DE','Nissan Tiida','2008 onward; end not stated','1.8 L','denso-sa',45),
 ('4A91','Mitsubishi Xpander NC1W','2021 onward; end not stated in 2023 catalogue','1.5 L','gud-sa',7),
 ('4G64','Mitsubishi Triton','2007–2017','2.4 L petrol','gud-sa',8),
 ('4G93','Mitsubishi Pajero iO','1998–2001','1.8 L','gud-sa',7),
 ('SQR477F','Chery J2','2013–2017','1.5 L','fram-sa',1),
 ('SQRE4G15B','Chery Tiggo 4 Pro','2021 onward; end not stated in 2023 catalogue','1.5 L; distinguish turbo E4T15B','fram-sa',1),
]
for c,v,y,var,s,p in extra:existing[c]['applications'].append({'vehicle':v,'dates':y,'variant':var,'market':'South Africa catalogue application; confirm original-market VIN','source':s,'page':p})
data['engines']=list(existing.values());data['expansion']={'date':'2026-09-10','added_codes':len(entries),'source':'docs/reports/engine-africa-expansion-20260910/reviewed-source-rows.json','note':'Country application evidence and China supply leads are separate; no continent-wide best-seller claim.'}
(BASE/'engine-verification.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(P/'release-scope.json').write_text(json.dumps({'expected_articles':len(existing),'expected_public_files':len(existing)+5,'added_codes':len(entries),'application_rows':sum(len(e['applications']) for e in existing.values())},indent=2)+'\n')
print(json.dumps(data['expansion']));print('Applications',sum(len(e['applications']) for e in existing.values()))

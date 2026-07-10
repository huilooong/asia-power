# OPS: Public vehicle names in English

## Problem
Public catalog / homepage showed Chinese brand/model/title for QXB and other listings (e.g. 哈弗, 帝豪GL).

## Fix
- `server/lib/half-cut-public.js` — translate brand/model and build English `title` in `toPublicItem`
- `server/lib/vin/zh-en-seed.js` — expanded brand/model ZH→EN seed
- `server/lib/half-cut-vehicle-title-i18n.js` — seed merged into lexicon
- `js/home-v4-hybrid.js` — prefer API English title on cards

## Deploy
```bash
node scripts/deploy-production.mjs api --yes --allow-dirty
node scripts/deploy-production.mjs home --yes --allow-dirty
```

## Verify
```bash
curl -s 'https://asia-power.com/api/half-cuts/public?limit=20' | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const j=JSON.parse(d); const items=j.items||j.data||j;
  const cjk=(items||[]).filter(i=>/[\u4e00-\u9fff]/.test([i.brand,i.model,i.title].join(' ')));
  console.log('total', (items||[]).length, 'withCJK', cjk.length);
  cjk.slice(0,5).forEach(i=>console.log(i.stockId,i.brand,i.model,i.title));
});
"
```

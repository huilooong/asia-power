# OPS: QXB VIN decode — auto-learn missing brands (Land Rover)

## Problem
Supplier uploading Land Rover (路虎) could not complete upload:
1. `brand-dictionary` / `vehicle-catalog` had no Land Rover
2. `/api/vin/decode` returned **empty brand** when Chinese brand had no English translation
3. Supplier brand `<select>` could not accept unknown brands

## Policy (CEO 2026-07-10)
If 汽修宝 (QXB) successfully identifies a VIN, AsiaPower must not block save due to missing brand library.
Auto-add brand/model from QXB parse so supplier can save.

## Fix
| File | Change |
|------|--------|
| `server/lib/vin/decode-route.js` | Never blank brand/model after QXB success; return English when available |
| `server/lib/vin/localize.js` | Auto-learn brand/model into knowledge-base from QXB |
| `server/lib/vin/zh-en-seed.js` | Add 路虎→Land Rover, 捷豹→Jaguar + models |
| `js/vehicle-catalog.js` | Land Rover / Jaguar + `ensureBrandOption` |
| `js/supplier-half-cut-upload.js` | Inject decoded brand into select |

## Deploy
```bash
node scripts/deploy-production.mjs api --yes --allow-dirty
# static supplier upload assets:
rsync -av js/vehicle-catalog.js js/supplier-half-cut-upload.js \
  root@159.65.86.24:/root/.openclaw/workspace/inventory-site/public/js/
rsync -av supplier-portal/half-cut-upload.html supplier-portal/truck-upload.html \
  supplier-portal/truck-vehicle-upload.html supplier-portal/passenger-parts-upload.html \
  root@159.65.86.24:/root/.openclaw/workspace/inventory-site/public/supplier-portal/
```

## Verify
```bash
# Simulate QXB mapped brand (local)
node -e "..." # localize 路虎 → Land Rover

# Production decode (use real Land Rover VIN when available)
curl -sS -X POST https://asia-power.com/api/vin/decode \
  -H 'Content-Type: application/json' \
  -d '{"vin":"<17-char-land-rover-vin>"}'
# Expect: ok:true, brand:"Land Rover", model not empty
```

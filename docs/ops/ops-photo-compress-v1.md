# OPS — Supplier upload photo compression (new uploads only)

**Task ID:** `ops-photo-compress-v1`  
**Date:** 2026-07-10  
**Status:** **Production deployed**  
**Release ID:** `REL-20260710085831-api-76489479`  
**Scope:** Future supplier uploads only. No bulk rewrite/delete of historical R2/disk photos.

## Conclusion

Server-side `media-optimize.js` was a **stub** (pass-through). New supplier photos now compress with **sharp → WebP** before storage. All four supplier-portal upload pages share one client + one API path, so they get the **same** pipeline.

## Production deploy (2026-07-10)

| Item | Value |
|------|-------|
| Release ID | `REL-20260710085831-api-76489479` |
| Target | `api` (+ portal upload HTML/JS rsync) |
| Backup | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-085834.tar.gz` |
| Restore | `RESTORE_CONFIRM=REL-20260710085831-api-76489479 node scripts/release-restore.mjs REL-20260710085831-api-76489479` |
| Git | `76489479` |

### What was deployed

1. **API (Release Manager):** `node scripts/deploy-production.mjs api --yes --allow-dirty`
   - `server/lib/media-optimize.js`, `media-storage.js`, `half-cut-api.js`, `package.json` (sharp optionalDependency)
2. **Portal upload only (manual rsync, no login/Facebook):**
   - `supplier-portal/{half-cut,passenger-parts,truck,truck-vehicle}-upload.html`
   - `js/supplier-half-cut-upload.js`, `js/half-cut-supplier-i18n.js`

### Production verification

| Check | Result |
|-------|--------|
| `media-optimize.js` FULL_MAX_EDGE=1920 / FULL_QUALITY=82 | Pass |
| Client `PHOTO_MAX_DIM=1920` / WebP 0.82 / cache-bust `photo-compress-v1` | Pass (public URL 200) |
| `require('sharp')` on production | Pass |
| In-memory smoke: 3000×2000 JPEG → full WebP 1920×1280 + thumb 640×427 | **SMOKE_PASS** |
| `inventory-site.service` | active |
| Upload page `https://asia-power.com/supplier-portal/half-cut-upload.html` | 200 |
| Historical photos | Untouched (no bulk recompress) |

Note: deploy-time `npm install` logged a transient path error; sharp was already present and smoke-tested OK. Upload of a real supplier photo not run (avoid touching live inventory); server path is verified via smoke.

## Compression strategy (quality-first)

| Variant | Long edge | Format | Quality |
|---------|-----------|--------|---------|
| Full | ≤ 1920 | WebP | 82 |
| Thumb | ≤ 640 | WebP | 72 |

- **Server (source of truth):** `POST /api/half-cuts/upload/photo` → `saveOptimizedPhotoUpload` → `optimizeImageBuffer`
- **Client (pre-shrink):** canvas WebP ~0.82 / JPEG ~0.85, long edge ≤ 1920, compress if > 500 KB or oversized
- If sharp missing: upload still succeeds via original-file fallback (logged warning)

## Supplier upload entries covered

| Entry | Path | Covered? | How |
|-------|------|----------|-----|
| Passenger vehicle | `supplier-portal/half-cut-upload.html` | Yes | Shared `supplier-half-cut-upload.js` + media API |
| Passenger parts | `supplier-portal/passenger-parts-upload.html` | Yes | Same |
| Truck parts | `supplier-portal/truck-upload.html` | Yes | Same |
| Truck vehicle | `supplier-portal/truck-vehicle-upload.html` | Yes | Same |
| API photo upload | `POST /api/half-cuts/upload/photo` | Yes | Server sharp compress |
| Direct R2 presign | `/api/half-cuts/upload/presign` | N/A today | `directUpload=false` in `r2-storage.js`; if re-enabled later, promote path has `optimizePendingPhoto` |

**Not in this change:** QXB human-review / batch pipeline (`work/qxb-agent/*`) — separate upload path. Videos unchanged (separate script exists).

## Production storage snapshot (read-only, 2026-07-10)

| Location | Finding |
|----------|---------|
| Disk `uploads/photos` | ~3 MB (already small / few files) |
| R2 bucket | ~18.7k photo objects ≈ **2.86 GB**; ~75 photos > 2 MB (legacy originals) |
| R2 videos | ~48 objects ≈ 420 MB (out of scope) |

Historical large JPGs remain untouched per CEO.

## Local verification (real R2 samples)

| Sample | Before | Full WebP | Thumb WebP | Full size vs before |
|--------|--------|-----------|------------|---------------------|
| `photo-…af004901.jpg` | 4958 KB | 442 KB (1920×1440) | 52 KB | **8.9%** |
| `photo-…9af4961d.jpeg` | 4786 KB | 398 KB (1920×1440) | 43 KB | **8.3%** |
| `photo-…2940bcee_full.webp` (already small) | 263 KB | 258 KB | 42 KB | ~98% (already optimized) |

Command: `node` + `require('./server/lib/media-optimize')` against `tmp/photo-compress-samples/`.

## Files changed

| File | Change |
|------|--------|
| `server/lib/media-optimize.js` | Real sharp WebP full+thumb (+ promote/public helpers) |
| `server/lib/media-storage.js` | Promote uses optimized URL (not stale original) |
| `js/supplier-half-cut-upload.js` | Client max edge 1920; compress threshold 500 KB |
| `js/half-cut-supplier-i18n.js` | Hint: photos auto-compressed |
| `supplier-portal/*-upload.html` (×4) | Cache-bust `?v=photo-compress-v1` |
| `scripts/optimize-inventory-photos.mjs` | Optional offline script (**do not auto-run**) |

## Deploy note

```bash
node scripts/deploy-production.mjs api --yes --allow-dirty
# then portal upload HTML/JS only (do NOT use full portal target if OAuth/login work is in flight)
```

**Do not** run `optimize-inventory-photos.mjs` on full library unless CEO separately approves historical recompress.

## Next

1. ~~CEO says **可以上线** → deploy API + portal JS/HTML~~ **Done**
2. Optional: spot-check one real supplier upload on production (size + WebP `_full` / `_thumb`) when a safe test upload is available
3. Optional later: historical recompress script with dry-run + CEO approval

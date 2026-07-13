# APUI-VEHICLE-ENGINE-001 — Implementation Notes

**Date:** 2026-07-13  
**Phase:** Implement → test → deploy

## Boundaries honored

1. Compatible Vehicles only from **structured** application tokens  
2. Directory displacement backfill is **traceable** (`directory-derived`), exact code, no conflict, never mutates inventory  
3. No new API / vehicle pages / URL / inventory business logic  

## Coverage (measured locally)

| Metric | Count |
|--------|------:|
| Catalog models | 105 |
| Engines with structured Compatible Vehicles list | **103** |
| Engines with applications but **no** public structured list | **2** (1HZ, 1HD-FTE — series/turbo free-text) |
| Rejected application tokens (not shown as vehicle tags) | 17 |
| Half-Cut inventory displacement | 62 |
| Half-Cut **directory-derived** displacement | **113** |
| Half-Cut no displacement (safe degrade) | **292** |
| Directory conflict blocks | 0 |

## Key modules

- `js/engine-card-label.js` — parse + traceable resolve + formatters  
- `js/half-cut-directory.js` — Vehicle-first cards/rows/SEO  
- `js/engine-catalog.js` / `brand-page.js` / `home-hub.js` / `engine-detail.js` / `home-v4-hybrid.js` / `ebay-catalog-hub.js`

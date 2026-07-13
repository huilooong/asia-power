# APUI-VEHICLE-ENGINE-001 — Ship Report

**Date:** 2026-07-13  
**Status:** Implementing → Release

## Coverage (measured on `work/half-cut-approved-prod.json` + ENGINE_DIRECTORY)

| Metric | Count |
|--------|------:|
| Catalog engines with public structured Compatible Vehicles | **103 / 105** |
| Catalog engines with applications but no structured list | **2** (`1HZ`, `1HD-FTE`) |
| Rejected application tokens (body note only, not tags) | **17** |
| Half-Cut inventory displacement | **62** |
| Half-Cut directory-derived displacement (display-only) | **113** |
| Half-Cut no displacement (safe degrade) | **292** |
| Directory multi-version conflict blocks | **0** |

## Boundaries

- Compatible Vehicles: structured / free-text / ambiguous / near-dup separated; no guaranteed-fit wording from donor inventory
- Displacement: exact code, no conflict, `directory-derived` source, never mutates inventory
- No new API / vehicle pages / URL / inventory business logic

## Bugbot fixes applied

1. Deploy grep for `half-cuts/detail.html` accepts `vehicle-engine-001b`
2. Removed inventory-donor `Fits {brand} {model}` from engine inventory rows/cards — use directory structured apps only
3. Escaped Compatible Vehicles / rejected notes / H1 in `engine-detail.js`
4. Removed duplicate `engine-directory.js` load on `engines/index.html`

## Local validation

- `node --test tests/test_apui_vehicle_engine_001.js` → **9/9 PASS**

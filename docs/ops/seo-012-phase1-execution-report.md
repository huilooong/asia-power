# SEO-012 Phase 1 Execution Report

Status: Implemented locally, not deployed  
Date: 2026-07-16  
Scope: APSEO-012 Phase 1 technical indexing control

## Purpose

Execute the approved start of APSEO-012 Phase 1:

- canonical detail path policy
- sitemap inventory URL governance
- robots/sitemap HTTP behavior cleanup
- local validation before production review

## Files Modified

| File | Change |
| --- | --- |
| `server/lib/half-cut-seo.js` | Added shared `resolveDetailPath(item)` helper |
| `server/lib/inventory-catalog-seo.js` | Reused shared detail path helper for catalog ItemList URLs |
| `server/lib/sitemap.js` | Uses canonical detail path per inventory type; filters sold/noindex/test-like inventory; improves inventory `lastmod` source |
| `server/lib/half-cut-prerender.js` | Allows HEAD responses without sending HTML body |
| `deploy/inventory-site-server.js` | Redirects non-canonical detail paths to canonical path; supports HEAD `/sitemap.xml`; serves `.txt` as text/plain |
| `server/half-cut-local-server.js` | Serves `.txt` and `.xml` with explicit content types for local parity |

## Canonical Policy Implemented

| Inventory Type | Canonical Detail Path |
| --- | --- |
| Passenger / default inventory | `/half-cuts/detail.html?slug=...` |
| Truck inventory | `/trucks/detail.html?slug=...` |
| Machinery inventory | `/machinery/detail.html?slug=...` |

Production server behavior after deploy:

- Requesting the wrong detail path for a known slug returns 301 to the canonical path.
- Sitemap entries use the same canonical path helper.
- Catalog ItemList JSON-LD uses the same canonical path helper.
- Product detail prerender keeps the requested canonical path after redirect normalization.

## Sitemap Governance Implemented

Inventory sitemap entries now exclude:

- missing slug
- `status === "Sold"`
- `noindex`
- `excludeFromSitemap`
- obvious test/demo/QA records such as `test vehicle`, `test record`, `demo listing`, `qa stock`

Inventory `lastmod` now uses:

```text
updatedAt -> approvedAt -> listedAt -> createdAt -> fallback
```

## Validation

### Syntax / Module Checks

Passed:

```bash
node -e "require('./server/lib/half-cut-seo'); require('./server/lib/inventory-catalog-seo'); require('./server/lib/sitemap'); require('./server/lib/half-cut-prerender'); console.log('seo modules ok')"
node -c deploy/inventory-site-server.js
node -c server/half-cut-local-server.js
```

### Sitemap Generation Check

Passed:

```bash
node scripts/generate-sitemap.mjs
```

Result:

```text
[sitemap] wrote .../docs/dev-sitemap.xml (170 URLs, dev snapshot only)
```

The generated validation snapshot was removed after validation to avoid committing a transient artifact.

### Rule-Level Sample Check

Passed:

```json
{
  "passenger": "/half-cuts/detail.html?slug=toyota-camry-hc1",
  "truck": "/trucks/detail.html?slug=isuzu-100p-hc2",
  "machinery": "/machinery/detail.html?slug=lonking-loader-hc3",
  "testEligible": false
}
```

### Live Public Inventory Data Check

Used current public inventory from:

```text
https://asia-power.com/api/half-cuts/public
```

New local sitemap rule result:

```json
{
  "total": 694,
  "trucks": 55,
  "machinery": 4,
  "test": 0
}
```

Precision check against item `vehicleCategory`:

```json
{
  "entries": 524,
  "bad": []
}
```

Interpretation:

- 524 live inventory detail entries are eligible for sitemap inclusion.
- No eligible passenger/truck/machinery inventory entry was assigned to the wrong detail path.
- Obvious test-vehicle records are excluded.

## Not Yet Done

This work is not deployed.

Still required before production:

1. CEO confirms Phase 1 deployment.
2. Release Manager prepares release ID, backup, deploy and rollback plan.
3. Post-release validation checks:
   - `GET /sitemap.xml` returns 200 XML.
   - `HEAD /sitemap.xml` returns 200.
   - `GET /robots.txt` has `Content-Type: text/plain`.
   - Sample passenger/truck/machinery detail URLs have matching sitemap, canonical, Product JSON-LD URL and internal ItemList URL.
   - Non-canonical detail paths redirect to canonical paths.

## Rollback Impact

Rollback is code-only:

- revert the six modified code files
- redeploy previous release
- verify sitemap and detail pages return previous behavior

No data migration was introduced.

## Next Recommended Task

Prepare release validation script updates so OPS-005 can verify canonical-path consistency automatically after deployment.

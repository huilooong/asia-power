# SEO-012 Phase 1 Execution Report

Status: Production deployed; follow-up OPS-003 validation passed  
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

## Production Deployment

Deployment command:

```bash
DEPLOY_ALLOW_DIRTY=1 DEPLOY_ALLOW_UNPUSHED=1 node scripts/deploy-production.mjs api --yes --allow-dirty
```

Release:

| Field | Value |
| --- | --- |
| Release ID | `REL-20260716092859-api-75ab9974e` |
| Target | `api` |
| Backup | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260716-092901.tar.gz` |
| Restore command | `RESTORE_CONFIRM=REL-20260716092859-api-75ab9974e node scripts/release-restore.mjs REL-20260716092859-api-75ab9974e` |

Initial Release Manager results:

- PASS: nginx configuration test
- PASS: critical URL check
- PASS: `inventory-site.service` active
- PASS: public homepage/contact/brand/catalog checks
- PASS: `GET /robots.txt`
- PASS: `GET /sitemap.xml`
- FAIL: `config_js_release_id`

The failed check was caused by Cloudflare serving a cached `js/config.js?v=apcontact-002` whose `releaseId` still pointed to `REL-20260716040808-engines-9b6ee6e3a`. The deploy script also reported Cloudflare purge credentials missing, so this requires manual Cloudflare purge or cache expiry. This failure does not indicate that the SEO Phase 1 server code failed to deploy.

Follow-up OPS-003 validation:

```bash
node scripts/post-release-validation.mjs --base-url=https://asia-power.com --release-id=REL-20260716092859-api-75ab9974e
```

Result:

```text
[ops-003] status=pass pass=55 fail=0
```

Cloudflare purge still reports `manual_action_required` because Cloudflare purge credentials are not available to the deploy script, but public validation is now passing.

## Production SEO Validation

Passed after deployment:

| Check | Result |
| --- | --- |
| `HEAD /robots.txt` | HTTP 200, `Content-Type: text/plain; charset=utf-8` |
| `HEAD /sitemap.xml` | HTTP 200, `Content-Type: application/xml; charset=utf-8` |
| sitemap count | 711 URLs observed |
| sitemap truck canonical | `/trucks/detail.html?...` present |
| sitemap machinery canonical | `/machinery/detail.html?...` present |
| test vehicle sitemap count | 0 |
| truck slug under old half-cut URL | 301 to `/trucks/detail.html?...` |
| machinery slug under old half-cut URL | 301 to `/machinery/detail.html?...` |
| truck detail canonical | canonical and Product JSON-LD URL use `/trucks/detail.html?...` |
| machinery detail canonical | canonical and Product JSON-LD URL use `/machinery/detail.html?...` |

Samples:

- Truck: `volvo-xc60-2017-b4204t11-truck-cab-hc250581`
- Machinery: `dongfanghong-380-2005-machinery-tractor-hc250576`

## Still Open

1. Decide whether Phase 2 performance/cache changes should proceed.
2. Optional: configure Cloudflare purge credentials for Release Manager so future cache-bust validation does not depend on edge expiry timing.

## Release Validation Enhancement

Implemented after Phase 1 production deploy:

| File | Change |
| --- | --- |
| `scripts/lib/post-release-validation.mjs` | Added canonical SEO validation from live sitemap samples |

New OPS-003 checks include:

- `robots_content_type`
- `sitemap_content_type`
- `sitemap_head_http`
- `seo_sitemap_url_count`
- `seo_sitemap_test_like_urls`
- `seo_half_cut_canonical`
- `seo_half_cut_product_jsonld_url`
- `seo_truck_canonical`
- `seo_truck_product_jsonld_url`
- `seo_truck_legacy_redirect`
- `seo_machinery_canonical`
- `seo_machinery_product_jsonld_url`
- `seo_machinery_legacy_redirect`

Validation command:

```bash
node scripts/post-release-validation.mjs --base-url=https://asia-power.com --release-id=REL-20260716092859-api-75ab9974e
```

Result:

```text
[ops-003] status=pass pass=74 fail=0
```

This enhancement is local until the validation script itself is deployed/committed through the normal release workflow. The current production site already passes the enhanced local validation.

## Rollback Impact

Rollback is code-only:

- revert the six modified code files
- redeploy previous release
- verify sitemap and detail pages return previous behavior

No data migration was introduced.

## Next Recommended Task

Prepare release validation script updates so OPS-005 can verify canonical-path consistency automatically after deployment.

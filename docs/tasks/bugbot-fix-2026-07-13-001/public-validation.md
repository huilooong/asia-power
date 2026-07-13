# Public validation

## OPS-003

```
status=pass  pass=57  fail=0
purge=manual_action_required (Cloudflare Cache Purge token missing — known)
```

Snapshot copy: `ops-003-public-validation-snapshot.md`

## Targeted public checks (this fix)

| Check | Result |
|-------|--------|
| `brands.html` has `brand-stock-directory-v2` + inventory-store | PASS |
| `main.js?v=brand-stock-directory-v2` has hydrate + search indirection | PASS |
| `ebay-layout.css` dedicated parts contain | PASS |
| `components.js` `parts-photo-contain-v1` | PASS |
| Ford SVG UTF-8 `·` | PASS |
| `/api/half-cuts/public` HTTP 200 | PASS |
| Remote deploy greps (chrome script) | PASS |

## Brands live vs seed (evidence)

| Source | Countable brands |
|--------|------------------|
| Seed fallback | 9 |
| Live public API | ~53 |

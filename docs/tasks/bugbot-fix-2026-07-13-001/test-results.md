# Local / Diagnostics

## Local validation

See `local-validation.txt` (static checks + live API brand count).

| Check | Result |
|-------|--------|
| brands.html loads inventory-store v2 | PASS |
| hydrate + seed fallback warn path | PASS |
| CATALOG_PAGES includes brands | PASS |
| fit-contain → contain (parts pages) | PASS |
| parts-ph / banner / halfcut cover | PASS |
| no `!important` on contain declarations | PASS (comment mentions the word; CSS property has none) |
| SVG UTF-8 middle-dot | PASS |
| seed brands 9 / live brands 53 | PASS |
| AsiaPower-Brain symlink untouched | PASS |

## Diagnostics (IDE)

`ReadLints` on changed JS/CSS/HTML/deploy files: **no linter errors**.

## Bugbot re-review

| Pass | Result |
|------|--------|
| 1st (after initial fix) | 1 medium: search closure stale after hydrate → fixed via `brandsDirectoryApplyFilter` |
| 2nd | **Bugbot found no bugs** ([re-review](15baff48-9feb-43b0-b124-8eecb33a18ea)) |

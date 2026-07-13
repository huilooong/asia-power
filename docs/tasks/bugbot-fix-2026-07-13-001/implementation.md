# Implementation

## High-1 brands

1. `brands.html` loads: `half-cut-vin` → `inventory-layer` → `directory` → `media-api` → `inventory-store` → `main.js` (`brand-stock-directory-v2`).
2. `initBrandDirectory()` still runs immediately from seed → never blank.
3. `hydrateBrandDirectoryFromPublicStock()` calls `HalfCutInventoryStore.whenReady()`, then re-runs `initBrandDirectory()`. On failure: `console.warn` + keep seed.
4. `CATALOG_PAGES` includes `brands` so store auto-boots on this page.
5. Chrome deploy rsyncs the four hydrate scripts and asserts new markers.

## High-2 object-fit

1. Removed `.ap-listing-photo--fit-contain` from the page-level **cover** selector list.
2. Added equal-specificity **contain** block for fit-contain on engines / gearboxes / chassis / frontcuts only.
3. `--parts-ph`, banner, halfcut cover rules unchanged.
4. No `!important`. Mobile `@media` only changes grid/aspect; does not override fit.
5. Bumped `SITE_EBAY_LAYOUT_VER` / `SITE_COMPONENTS_VER` → `parts-photo-contain-v1`.

## Medium-1 SVG

- Only file with latin-1 middle-dot in `assets/**/*.svg`: Ford powertrain placeholder.
- Fixed to UTF-8 `·`. No other SVG peers needed change.

## Medium-2

- `AsiaPower-Brain` remains symlink to Obsidian Vault (APBRAIN-002). Not modified.

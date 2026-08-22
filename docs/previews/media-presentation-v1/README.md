# AsiaPower Media Presentation V1 Preview

## Purpose

Normalize customer-uploaded photos and prioritize real inventory video without modifying, replacing, reordering, filtering, or deleting any source media or inventory data.

## Preview

- Local URL: `http://127.0.0.1:43117/`
- Half-cut video card: `http://127.0.0.1:43117/half-cuts/?q=HC250172`
- YouTube-first detail: `http://127.0.0.1:43117/half-cuts/detail.html?slug=toyota-camry-2010-2az-fe-half-cut-hc250172`
- Hosted-video detail: `http://127.0.0.1:43117/used-cars/detail.html?slug=denza-n9-2026-byd479zqa-export-used-car-hc250639`

The preview serves the candidate worktree and proxies read-only public inventory/media requests to the current AsiaPower website. It does not write production data.

## Approved Presentation Rules

- Video is the primary cover whenever a listing has video.
- YouTube listings use the YouTube thumbnail plus a play affordance; catalog pages do not load full iframes.
- MP4/WebM listings use a muted, looped preview only while the media is in view and data-saver/reduced-motion are not active.
- Unsupported video formats retain the first original photo as poster with a video indicator.
- All customer photos use a 4:3 neutral matte canvas with `object-fit: contain` and no filters.
- Detail pages show video before the complete original photo gallery.
- Original media order, files, URLs, inventory values, SEO fields, and inquiry behavior remain unchanged.

## Shared Implementation

- Media renderer: `js/half-cut-directory.js`
- Homepage renderer: `js/home-v4-hybrid.js`
- Detail ordering: `js/half-cut-detail.js`
- Catalog/brand binding: `js/ebay-catalog-hub.js`, `js/brand-page.js`
- Shared presentation: `css/visual-consistency-v1.css`
- Language labels: `js/public-i18n.js`
- Exact deployment boundary: `scripts/lib/release-manager.mjs`, `scripts/deploy-production.mjs`

The shared renderers cover the homepage, half-cuts, engines, trucks, machinery, export used cars, brand inventory pages, product details, desktop, mobile, and EN/ZH/FR/AR presentation states.

## Deployment Impact

- Candidate release target: `visual-v1`
- Exact manifest: 199 HTML cache-key shells plus 11 shared assets (210 paths total)
- No `data/`, `server/`, `uploads/`, database, API contract, URL, canonical, structured-data, inventory, price, status, supplier, or inquiry-logic changes
- No production deployment has been performed for this candidate

## Rollback

Restore the 210-path Release Manager snapshot for the release ID, or redeploy the prior Git commit through the same `visual-v1` target. Original customer media and inventory records do not require restoration because they are not changed.

## Validation

- 55 focused Node regression tests passed
- 5 public-inventory Python tests passed
- JavaScript syntax and `git diff --check` passed
- Desktop preview passed for homepage, catalog, YouTube detail, and hosted-video detail
- 390 px preview passed for catalog video card and hosted-video detail
- RTL media placement passed in Arabic
- SEO/title/description/canonical/JSON-LD boundary tests passed

## Current Gate

Preview ready for CEO review. GitHub push and production deployment require separate explicit approval and must use the Release Manager sequence.

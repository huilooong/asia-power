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

- Candidate release targets: `api` for the two reviewed Chinese-to-international make aliases, then `visual-v1` for the site-wide presentation layer
- Exact manifest: 199 HTML cache-key shells plus 11 shared assets (210 paths total)
- Server change is limited to `腾势 → Denza` and `方程豹 → Fangchengbao` in the existing public-name seed; it does not write stored records or change the API schema
- No `data/`, `uploads/`, database, URL, canonical, structured-data, inventory, price, status, supplier, or inquiry-logic changes
- No production deployment has been performed for this candidate

## Rollback

Restore the Release Manager snapshots for the `api` and `visual-v1` release IDs, or redeploy the prior Git commit through the same targets. Original customer media and inventory records do not require restoration because they are not changed.

## Validation

- Controlled make-name matrix covers all 60 makes in the 599-record production snapshot.
- `FANGCHENGBAO` is fixed as `方程豹` in Chinese and remains the official uppercase trademark in EN/FR/AR; `方城堡` is blocked by regression coverage.
- 53 focused Node regression tests passed
- 5 public-inventory Python tests passed
- JavaScript syntax and `git diff --check` passed
- Desktop preview passed for homepage, catalog, YouTube detail, and hosted-video detail
- 390 px preview passed for catalog video card and hosted-video detail
- RTL media placement passed in Arabic
- SEO/title/description/canonical/JSON-LD boundary tests passed

## Current Gate

Preview ready for CEO review. GitHub push and production deployment require separate explicit approval and must use the Release Manager sequence.

# SEO-012 Next Phases Execution Report

Status: Implementation in progress; not deployed  
Date: 2026-07-16  
Branch: `codex/seo-next-phases`  
Scope: APSEO-012 follow-up content, internal linking, sitemap and release validation coverage

## Purpose

Start the post-Phase-1 SEO execution work with changes that can improve organic traffic without changing production infrastructure:

- create real guide pages already declared in the sitemap
- connect guide content from the homepage, catalog pages, country pages and footer
- extend release validation so guide pages are checked before future deployment

## Files Modified

| File | Change |
| --- | --- |
| `guides/index.html` | Added buyer guide hub |
| `guides/buying-used-engines-from-china.html` | Added used engine import checklist article |
| `guides/fob-vs-cif-shipping-guide.html` | Added FOB vs CIF shipping guide article |
| `index.html` | Added Guides link to homepage navigation and footer-style link list |
| `js/config.js` | Added Guides to public navigation and SEO product links |
| `js/components.js` | Added Guides to public footer links |
| `engines/index.html` | Added buying guide card in related paths |
| `ghana.html` | Added shipping guide CTA beside catalog links |
| `nigeria.html` | Added shipping guide CTA beside catalog links |
| `scripts/lib/post-release-validation.mjs` | Added guide pages to public validation and required sitemap guide URL checks |
| `engines/ghana-used-engines-from-china.html` | Added Ghana used-engine country-intent page |
| `engines/nigeria-used-engines-from-china.html` | Added Nigeria used-engine country-intent page |
| `engines/ghana-half-cut-engines.html` | Added related link to Ghana used-engine sourcing page |
| `engines/nigeria-half-cut-engines.html` | Added related link to Nigeria used-engine sourcing page |
| `scripts/deploy-production.mjs` | Added country engine pages to chrome deploy sync and remote gates |
| `scripts/lib/release-manager.mjs` | Added country engine pages to chrome source and snapshot paths |

## Content Added

### Guide Hub

URL:

```text
/guides/
```

Purpose:

- create a crawlable hub for buyer education content
- link buyers to high-intent guide articles
- give search engines a durable parent page for guide content

### Buying Used Engines From China

URL:

```text
/guides/buying-used-engines-from-china.html
```

Targets:

- used engines from China
- buying used engines from China
- used engine import checklist
- engine code and gearbox matching before quote

### FOB vs CIF Shipping Guide

URL:

```text
/guides/fob-vs-cif-shipping-guide.html
```

Targets:

- FOB vs CIF for used engines
- CIF shipping used engines from China
- Africa import shipping quote
- Tema, Lagos, Cotonou, Douala, Abidjan, Mombasa shipping intent

### Ghana Used Engines from China

URL:

```text
/engines/ghana-used-engines-from-china.html
```

Targets:

- used engines from China for Ghana
- Ghana used engine import
- Tema used engine CIF quote
- engine plus gearbox Ghana

### Nigeria Used Engines from China

URL:

```text
/engines/nigeria-used-engines-from-china.html
```

Targets:

- used engines from China for Nigeria
- Nigeria used engine import
- Lagos / Apapa used engine CIF quote
- engine plus gearbox Nigeria

## Validation Added

Release Manager now checks:

- `/guides/`
- `/guides/buying-used-engines-from-china.html`
- `/guides/fob-vs-cif-shipping-guide.html`
- `/engines/ghana-used-engines-from-china.html`
- `/engines/nigeria-used-engines-from-china.html`

For each guide page, existing public validation covers:

- HTTP status
- title presence
- canonical presence
- WhatsApp number safety
- resolved `config.js` WhatsApp safety
- `#site-whatsapp` mount

Sitemap validation now also fails if the sitemap is missing:

- `/guides/`
- `/guides/buying-used-engines-from-china.html`
- `/guides/fob-vs-cif-shipping-guide.html`
- `/engines/ghana-used-engines-from-china.html`
- `/engines/nigeria-used-engines-from-china.html`

## Validation Run

Passed:

```bash
node -c scripts/lib/post-release-validation.mjs
node -c js/config.js
node -c js/components.js
node -c server/half-cut-local-server.js
```

Passed local HTTP checks against `http://127.0.0.1:8799`:

| URL | Result |
| --- | --- |
| `/guides/` | HTTP 200, title present, canonical correct, JSON-LD present, WhatsApp CTA present |
| `/guides/buying-used-engines-from-china.html` | HTTP 200, title present, canonical correct, JSON-LD present, WhatsApp CTA present |
| `/guides/fob-vs-cif-shipping-guide.html` | HTTP 200, title present, canonical correct, JSON-LD present, WhatsApp CTA present |
| `/engines/ghana-used-engines-from-china.html` | Static validation passed: title present, canonical correct, JSON-LD present, WhatsApp CTA present, shared JS cache key present |
| `/engines/nigeria-used-engines-from-china.html` | Static validation passed: title present, canonical correct, JSON-LD present, WhatsApp CTA present, shared JS cache key present |
| `/sitemap.xml` | HTTP 200, XML content type, guide URLs present |
| `HEAD /sitemap.xml` | HTTP 200 |

Passed dynamic sitemap generation check:

```text
https://asia-power.com/guides/ present
https://asia-power.com/guides/buying-used-engines-from-china.html present
https://asia-power.com/guides/fob-vs-cif-shipping-guide.html present
https://asia-power.com/engines/ghana-used-engines-from-china.html present
https://asia-power.com/engines/nigeria-used-engines-from-china.html present
```

Full local OPS-003 was attempted, but the local public inventory API returned `approved: 0`, so the existing half-cut sitemap sample check cannot pass in this local environment. This should be re-run against production after deployment, where Phase 1 already validated live inventory samples.

## Not Deployed Yet

This work has not been deployed to production in this step.

Before deployment:

1. Run local syntax and static-page checks.
2. Run local server checks for guide pages and sitemap output.
3. Run Release Manager against a deployed release after CEO deploy confirmation.

## Current Recommended Next Batch

After the guide and country-engine batch is validated and deployed:

1. Add two model-intent pages from live demand:
   - Toyota engine import to Ghana
   - Hyundai/Kia engine import to Nigeria
2. Add Search Console query tracking once GSC data is available.
3. Review cache policy separately because that touches production behavior.

## Next Batch Execution — Model Intent Pages (2026-07-16)

Implemented locally:

- `/engines/toyota-engines-for-ghana-importers.html`
- `/engines/hyundai-kia-engines-for-nigeria-importers.html`

Internal links added:

- `/engines/`
- `/ghana.html`
- `/nigeria.html`
- `/engines/ghana-used-engines-from-china.html`
- `/engines/nigeria-used-engines-from-china.html`

Release and validation coverage updated:

- `scripts/deploy-production.mjs` now syncs and remote-checks both new model-intent pages in the `chrome` release path.
- `scripts/lib/release-manager.mjs` now snapshots and verifies both new public paths, plus the changed Ghana and Nigeria country landing pages.
- `scripts/lib/post-release-validation.mjs` now fetches both pages and requires both URLs in the production sitemap static-growth check.

Local validation passed:

```bash
node -c scripts/lib/post-release-validation.mjs
node -c scripts/deploy-production.mjs
node -c scripts/lib/release-manager.mjs
```

Static SEO checks passed for both pages:

- title present
- canonical URL exact
- JSON-LD present
- WhatsApp CTA uses `8616638801930`
- shared `config.js` cache key is `seo-guides-20260716`

Dynamic sitemap generation check passed:

```text
https://asia-power.com/engines/toyota-engines-for-ghana-importers.html present
https://asia-power.com/engines/hyundai-kia-engines-for-nigeria-importers.html present
```

Deployment status: deployed to production.

- Release ID: `REL-20260716161506-chrome-33eaeff3e`
- Deployed commit: `33eaeff3e2e7e5460b70cc9d42a270a4018a7ab7`
- Release Manager validation: pass
- Production sitemap count after deploy: 715 URLs
- New production pages verified:
  - `https://asia-power.com/engines/toyota-engines-for-ghana-importers.html`
  - `https://asia-power.com/engines/hyundai-kia-engines-for-nigeria-importers.html`

Production validation passed for both new pages:

- HTTP 200
- title present
- canonical exact
- WhatsApp CTA uses `8616638801930`
- `#site-whatsapp` mount present
- floating WhatsApp config resolved through `config.js?v=seo-guides-20260716`

## Next Step Execution — Search Console Query Tracking (2026-07-16)

Implemented a read-only Search Console query tracking framework. No production deployment is required for this step.

Added:

- `data/seo/gsc-query-watchlist.json`
- `scripts/seo-gsc-weekly-report.mjs`
- `docs/reports/seo/README.md`
- `docs/ops/seo-013-search-console-query-tracking.md`

The watchlist now tracks the guide, country-engine and model-intent pages added in this SEO phase, including:

- `/engines/toyota-engines-for-ghana-importers.html`
- `/engines/hyundai-kia-engines-for-nigeria-importers.html`

GSC data status:

- Historical GSC signals do exist in `docs/ops/seo-brand-query-asia-power-diagnosis-2026-07-15.md`: naked brand query `asia power` average position around 34, and Ghana intent queries average position around 2.1.
- No raw GSC export file was found in the repo during this step.
- The in-app browser was not authenticated for Search Console, and the Chrome extension browser was unavailable in this session.
- Therefore the framework now records known historical GSC signals and can generate a watchlist baseline immediately, but full query/page analysis still needs a raw GSC export or authenticated GSC session.

Validation:

```bash
node scripts/seo-gsc-weekly-report.mjs --watchlist-only --date 2026-07-16
```

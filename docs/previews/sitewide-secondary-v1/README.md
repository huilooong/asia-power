# AsiaPower Sitewide Secondary Pages V1

## Purpose

Unify public catalog, detail, brand, guide, market and company pages with the
homepage circular-economy design language while preserving URLs, SEO metadata,
inventory APIs, supplier data and enquiry behavior.

## Preview

Start the read-only preview server:

```bash
node docs/previews/sitewide-secondary-v1/server.mjs
```

Base URL: `http://127.0.0.1:8793/`

Representative routes:

- Catalog: `http://127.0.0.1:8793/half-cuts/?cat=used-cars&lang=en`
- Used-car detail: `http://127.0.0.1:8793/used-cars/detail.html?slug=fangchengbao-bao-5-2025-byd476zqf-export-used-car-hc250647&lang=en`
- Engine guide: `http://127.0.0.1:8793/engines/1nz-fe.html?lang=en`
- Brand page: `http://127.0.0.1:8793/brands/toyota.html?lang=en`
- About: `http://127.0.0.1:8793/about.html?lang=en`
- Contact: `http://127.0.0.1:8793/contact.html?lang=en`

The preview serves local UI files, proxies production GET/HEAD inventory and
media reads, and rejects mutating HTTP methods.

## Scope

- One shared navigation, sourcing search band, trust footer and responsive menu.
- Shared warm paper, ink, warm-gold, verified-green and WhatsApp-green tokens.
- Catalog cards and rows: media, official make, core spec, year/status, EXW,
  evidence, Get Quote, then WhatsApp.
- Product details: one primary Get Quote action, WhatsApp fast path, evidence-led
  media and quieter secondary actions.
- Full-width editorial layouts for engine content, guides, brand pages, company
  pages and market pages.
- Official make rendering: Chinese official names where mapped; uppercase Latin
  trademarks for English, French and Arabic. `FANGCHENGBAO` maps to `方程豹` and
  never to an automatic mistranslation.
- Mobile catalog facets collapse out of the content rail; filters remain above
  results. RTL honeypots no longer create horizontal scroll.

## Validation

- Final visual checks passed for the 1440px English catalog, 390px English
  catalog and 390px Arabic used-car detail states.
- Browser assertions: visible H1, shared header/footer, correct RTL, zero
  horizontal overflow, no broken completed images, 12px mobile search input,
  readable Arabic title wrapping and a non-crowded 1440px navigation.
- Focused Node regression tests cover the shared shell, official brand names,
  CTA hierarchy, representative public page families and Release Manager
  source/rollback boundaries.
- Cache-bust, PWA app-shell, JavaScript syntax and release-boundary checks must
  all pass again immediately before any approved production release.

## Deployment impact

UI and presentation only. No API contract, database schema, inventory record,
supplier ownership, URL route, SEO canonical, enquiry submission endpoint or
authentication logic is changed.

`chrome` in the Release Manager now includes the complete tracked sitewide
boundary: all engine HTML pages, all brand HTML pages, catalog/detail/static
shells, shared CSS/JS and exact component cache-key updates on portal/admin
shells. Rsync is merge-only and does not delete production-only files.

## Rollback

Production deployment remains blocked until CEO review and approval. When
approved, the required sequence is commit, push GitHub, then Release Manager.
The Release Manager snapshots the exact remote paths and records a release ID
for rollback.

## Preview files

```text
docs/previews/sitewide-secondary-v1/
├── README.md
├── server.mjs
├── catalog-desktop.png
├── catalog-mobile.png
├── detail-desktop.png
└── detail-ar-mobile.png
```

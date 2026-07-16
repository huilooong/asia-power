# APSEO-012 Site Traffic Action Plan

Status: Draft for CEO review  
Date: 2026-07-16  
Scope: asia-power.com SEO, organic traffic growth, public catalog pages, inventory detail pages, sitemap/canonical policy, server/cache behavior, measurement loop  
Owner: AsiaPower SEO / Growth  
Production impact: No production change in this document. Execution requires approval.

## Executive Summary

AsiaPower already has a working SEO foundation: public catalog pages, dynamic sitemap, robots.txt, structured data, GA4, internal analytics, Cloudflare/R2 media, and prerendered catalog/detail pages.

The next traffic gains should not come from blindly generating more pages. The priority is to turn the current site into a controlled organic traffic system:

```text
discoverable pages
  -> canonical clarity
  -> indexable high-quality pages
  -> search impressions
  -> clicks
  -> inquiries
  -> attributed follow-up
```

The highest-priority fixes are:

1. Unify sitemap, internal links, and canonical URLs for inventory detail pages.
2. Clean sitemap quality and avoid indexing duplicate/weak/test-like URLs.
3. Upgrade high-intent engine and country pages before scaling page count.
4. Improve server/cache/content-type behavior for crawl and user speed.
5. Build a weekly Search Console + inquiry attribution loop.

## Evidence Reviewed

### Live Site Evidence

Checked on 2026-07-16:

| Area | Evidence | Finding |
| --- | --- | --- |
| Homepage | `https://asia-power.com/` | HTTP 200, HTML served through Cloudflare |
| robots | `https://asia-power.com/robots.txt` | HTTP 200, sitemap declared, content type currently `application/octet-stream` |
| sitemap | `https://asia-power.com/sitemap.xml` | HTTP 200, about 721 URLs observed |
| catalog prerender | `https://asia-power.com/engines/` | `X-AsiaPower-Prerender: catalog-list-engines`, catalog JSON-LD present |
| detail prerender | sample detail slug `volvo-xc60-2017-b4204t11-truck-cab-hc250581` | title, meta description, canonical, Product JSON-LD, images and body content present in initial HTML |
| cache behavior | public HTML responses | mostly dynamic Cloudflare behavior; prerender HTML has `Cache-Control: public, max-age=300` |

### Code Evidence

Relevant files:

| File | Relevance |
| --- | --- |
| `server/lib/sitemap.js` | dynamic sitemap generation |
| `server/lib/half-cut-seo.js` | detail title/meta/canonical/Product JSON-LD helpers |
| `server/lib/half-cut-prerender.js` | inventory detail HTML prerender |
| `server/lib/inventory-catalog-seo.js` | catalog ItemList/FAQ/CollectionPage JSON-LD |
| `server/lib/catalog-list-prerender.js` | catalog page SEO injection |
| `deploy/inventory-site-server.js` | production server routes for detail/catalog prerender and sitemap |
| `deploy/nginx-asia-power.com` | Cloudflare/nginx proxy, API/static routing, media rules |
| `docs/product/seo/apseo-011-*` | existing 90-day SEO operating plan |
| `docs/ops/seo-brand-query-asia-power-diagnosis-2026-07-15.md` | brand query diagnosis |

### External Standard References

Used for judgment alignment:

- Google SEO Starter Guide: `https://developers.google.com/search/docs/fundamentals/seo-starter-guide`
- Google JavaScript SEO Basics: `https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics`
- Google Product Structured Data: `https://developers.google.com/search/docs/appearance/structured-data/product`
- Google Merchant Listing Structured Data: `https://developers.google.com/search/docs/appearance/structured-data/merchant-listing`
- Google Core Web Vitals: `https://developers.google.com/search/docs/appearance/core-web-vitals`

## Current Diagnosis

### What Is Already Good

1. Public SEO infrastructure exists.
2. Catalog pages are not pure JS shells; key catalog SEO JSON-LD is injected server-side.
3. Detail pages can prerender real product content for valid inventory slugs.
4. Media is served through public R2-backed URLs for approved uploads.
5. Site has GA4 plus internal lead/event tracking.
6. Existing APSEO-011 plan already defines a useful 90-day content direction.

### Main Problems

| Priority | Problem | Why It Matters |
| --- | --- | --- |
| P0 | Canonical/detail URL inconsistency risk | Same stock can appear under half-cut, truck, or machinery detail paths. If sitemap, internal links, schema URL, and canonical disagree, ranking signals split. |
| P0 | Sitemap quality is not sufficiently governed | More URLs do not mean more traffic. Weak, duplicate, sold, test-like, or non-canonical URLs can waste crawl budget and dilute quality. |
| P1 | Page generation is ahead of page quality | Existing pages need deeper buyer-useful content before further scaling. |
| P1 | Country and vehicle demand pages are under-leveraged | Ghana/Nigeria and vehicle-model searches are closer to buyer intent than naked brand terms. |
| P1 | Cache/server behavior is conservative | Public SEO pages can be faster without sacrificing inventory freshness. |
| P1 | Measurement loop is incomplete | Organic traffic must be tied to page, query, country, product type, WhatsApp/form action, and follow-up status. |
| P2 | Brand term confusion | `asia power` competes with electrical/geopolitical entities. This is a positioning issue, not primarily a technical SEO bug. |

## Action Plan

## Phase 1: Technical Indexing Control

Timeline: 3-5 working days after approval  
Goal: make Google see one canonical version of every important public page.

### APSEO-012-T01: Detail URL Canonical Policy

Define and enforce one canonical detail path per inventory type:

| Inventory Type | Canonical Path |
| --- | --- |
| passenger half-cut / front-cut / engine / gearbox derived stock | `/half-cuts/detail.html?slug=...` |
| truck cab / truck half-cut / truck engine stock | `/trucks/detail.html?slug=...` |
| machinery stock | `/machinery/detail.html?slug=...` |

Required implementation:

- Update dynamic sitemap detail URL generation to use `resolveDetailPath(item)`.
- Ensure catalog ItemList URLs use the same path.
- Ensure detail `canonicalUrl()` uses the same path.
- Ensure old valid alternate paths 301 to canonical path where safe.
- Add regression checks for a passenger, truck, and machinery slug.

Acceptance:

- A truck item has sitemap URL, internal ItemList URL, canonical URL, and Product JSON-LD `url` all under `/trucks/detail.html`.
- A machinery item has all signals under `/machinery/detail.html`.
- A passenger item has all signals under `/half-cuts/detail.html`.
- Non-canonical alternate detail path returns 301 or is not linked/indexed.

Gate:

- Requires CEO approval before production deploy.
- Requires Release Manager for deploy.

### APSEO-012-T02: Sitemap Governance

Create a sitemap inclusion policy:

| Page Type | Sitemap Rule |
| --- | --- |
| Core pages | include |
| Catalog hubs | include |
| High-quality static engine/country/guide pages | include |
| Available inventory detail | include |
| Reserved inventory detail | include if still commercially useful |
| Sold inventory detail | include only if page has useful reference content and similar-stock CTA; otherwise remove |
| Test/import QA records | exclude |
| Non-canonical duplicate URLs | exclude |
| Admin/supplier/API/data paths | exclude |

Required implementation:

- Add sitemap filters for status and record quality.
- Add `lastmod` from item `updatedAt`, `approvedAt`, or `listedAt`.
- Generate a sitemap audit report with counts by URL type and exclusions.

Acceptance:

- Sitemap contains only canonical URLs.
- Sitemap count by type is reported.
- No obvious test-like slugs are included unless explicitly approved as real stock.
- `lastmod` exists for inventory detail URLs.

Gate:

- Requires CEO approval before production deploy.
- Requires Release Manager for deploy.

### APSEO-012-T03: robots.txt and sitemap HTTP Behavior

Required implementation:

- Serve `robots.txt` with `Content-Type: text/plain; charset=utf-8`.
- Ensure `HEAD /sitemap.xml` returns 200 if practical.
- Keep `robots.txt` sitemap directive.

Acceptance:

- `curl -I https://asia-power.com/robots.txt` shows `text/plain`.
- `curl -I https://asia-power.com/sitemap.xml` returns 200.
- `GET /sitemap.xml` remains valid XML.

Gate:

- Requires production deploy approval.

## Phase 2: Performance and Crawl Efficiency

Timeline: 3-7 working days after Phase 1  
Goal: improve crawl speed and user experience without making inventory stale.

### APSEO-012-T04: Public Page Cache Policy

Recommended cache model:

| Asset/Page | Cache Policy |
| --- | --- |
| prerendered inventory detail HTML | `public, max-age=300, stale-while-revalidate=300` if supported |
| catalog hub HTML | `public, max-age=300-900` |
| static engine/country/guide pages | `public, max-age=3600` |
| versioned CSS/JS | `public, max-age=31536000, immutable` if filename or query version is reliable |
| unversioned config critical files | short cache with must-revalidate |
| approved media images | 7-30 days |
| pending/private uploads | private/noindex/short cache |

Acceptance:

- Public catalog/detail pages remain fresh within acceptable inventory window.
- Static assets show long-cache headers.
- No private supplier/admin/pending files become public-cacheable.

Gate:

- Requires Release Manager.
- CEO approval recommended because this changes production infra/cache behavior.

### APSEO-012-T05: Core Web Vitals Quick Wins

Required review/fixes:

- Add stable width/height or aspect-ratio to key product images.
- Preload or prioritize above-the-fold hero/listing image where useful.
- Avoid layout shift from late-rendered header/footer/WhatsApp widgets.
- Reduce redundant scripts on SEO landing pages.
- Confirm mobile layout for catalog and detail pages.

Acceptance:

- Lighthouse or equivalent report captured for homepage, `/engines/`, `/half-cuts/`, one detail page.
- No obvious CLS from image/container shifts.
- LCP element is identified and optimized.

Gate:

- If UI changes are visible, requires preview and CEO review before production.

## Phase 3: High-Intent Content Upgrades

Timeline: 2-4 weeks  
Goal: improve pages that can realistically attract qualified import buyers.

### APSEO-012-C01: Top Engine Page V2 Upgrades

Upgrade the first 16 priority engine pages from APSEO-011:

Tier S:

- G4FC
- R20A3
- 1ZR-FE
- G4NA
- HR16DE
- K24A8
- 651.955
- 2AZ-FE

Tier A:

- MR20DE
- G4GC
- 1AZ-FE
- G4KE
- QR25DE
- 1KD-FTV
- 2KD-FTV
- 2TR-FE

Each upgraded page must include:

- unique title/meta
- engine-code buyer intent
- compatible vehicle context without fake official specs
- AsiaPower inventory/sourcing proof
- related live stock links
- gearbox/half-cut matching guidance
- country CTA where relevant
- WhatsApp/form CTA
- FAQ schema where content supports it
- internal links in and out

Acceptance:

- 16 upgraded pages.
- Each page has at least 5 inbound internal links and 5 outbound contextual links.
- Each page has a visible inquiry path.
- No unverified official claims.

Gate:

- SEO template changes require CEO review before production.

### APSEO-012-C02: Ghana and Nigeria Country Pages

Create or upgrade:

- Ghana used engines from China
- Nigeria used engines from China
- Ghana half-cut engine sourcing
- Nigeria half-cut engine sourcing
- Ghana engine and gearbox sourcing
- Nigeria engine and gearbox sourcing

Each page must include:

- country-specific H1/title/meta
- relevant engine/gearbox/half-cut product paths
- common buyer questions
- destination port/shipping quote CTA
- WhatsApp/form action
- links to top engine pages and live catalog

Acceptance:

- 6 country pages ready.
- Sitemap includes canonical URLs.
- Internal links from homepage/catalog/footer or relevant hubs.
- Search Console submission list updated.

Gate:

- New production SEO pages require CEO approval.

### APSEO-012-C03: Buyer Guides for Conversion

Create or upgrade:

- Engine only vs half-cut vs engine + gearbox
- How to confirm engine code before buying
- FOB vs CIF for used engines and half-cuts
- Used engine import checklist for Ghana/Nigeria buyers

Acceptance:

- 4 guide pages.
- Each guide routes to at least 3 commercial CTAs.
- Each guide links to relevant inventory/category pages.

Gate:

- Content review before production.

## Phase 4: Measurement and Attribution

Timeline: start immediately after Phase 1; then weekly  
Goal: make traffic growth measurable, not vibes-based.

### APSEO-012-M01: Search Console Weekly Loop

Weekly review inputs:

- pages with impressions but low CTR
- pages indexed but no clicks
- discovered/crawled but not indexed
- queries by country and product type
- pages with organic visits but no inquiry

Weekly actions:

- rewrite titles/meta for low CTR pages
- add internal links to pages with impressions but weak ranking
- improve or remove pages with no index value
- feed winning queries into content backlog

Acceptance:

- Weekly report saved under `docs/reports/seo/` or `reports/`.
- At least 20 queries reviewed per cycle.
- At least 5 page actions per cycle.

Gate:

- Read-only reporting does not require production gate.
- Resulting production changes require normal review.

### APSEO-012-M02: Inquiry Attribution

Track for every website lead where possible:

- landing page
- referrer
- UTM
- country
- product category
- stock ID / engine code
- CTA type: WhatsApp, form, deposit, phone
- follow-up status

Acceptance:

- Contact lead records include page and source context.
- WhatsApp click events include page/product context.
- Organic inquiry report can answer: which SEO page generated which inquiry?

Gate:

- Customer data model or analytics schema changes require review.

## Phase 5: Brand Positioning and Off-Page Growth

Timeline: after Phase 1-3 foundation  
Goal: avoid wasting effort on low-ROI naked brand queries.

### APSEO-012-B01: Brand Query Positioning

Problem:

The naked query `asia power` is polluted by electrical equipment companies and geopolitical/power-index entities. AsiaPower should not measure SEO success mainly by this query.

Recommended positioning strings:

- `AsiaPower used engines`
- `AsiaPower half-cuts`
- `AsiaPower China powertrain sourcing`
- `asia-power.com used engines from China`
- `AsiaPower Ghana engine sourcing`

Optional homepage/about copy:

```text
AsiaPower sources used engines, gearboxes, half-cuts and export vehicles from China for global buyers.
```

Acceptance:

- Brand + category terms monitored separately from naked `asia power`.
- External profiles and posts use `AsiaPower (asia-power.com)` plus product category.

Gate:

- Homepage copy change requires CEO review if visible.

### APSEO-012-B02: External Distribution

Do not push generic homepage links. Promote high-intent pages:

- country pages
- top engine pages
- buyer guides
- live inventory examples

Channels:

- Facebook groups, only where account state allows
- WhatsApp buyer conversations
- email outreach
- Google Business / directory profiles if available
- supplier/customer PDFs or quote docs

Acceptance:

- External distribution log records URL, channel, audience, date, and result.
- No customer/private data leaked.
- No unapproved public posting.

Gate:

- Public posting/outreach requires approval according to workspace red lines.

## Proposed Execution Order

| Week | Focus | Deliverables |
| --- | --- | --- |
| Week 1 | Canonical and sitemap control | T01, T02, T03 |
| Week 2 | Cache/performance quick wins | T04, T05 |
| Weeks 2-4 | High-intent pages | C01 first 8 engine pages, C02 first 2 country pages |
| Weeks 4-6 | Conversion content | Remaining C01, C02, C03 |
| Weekly ongoing | Measurement | M01, M02 |
| After foundation | Distribution | B01, B02 |

## Risks and Controls

| Risk | Control |
| --- | --- |
| Duplicate URL signals continue | canonical policy test must block release |
| More pages dilute quality | Opportunity Ranking and sitemap inclusion gate |
| Cache serves stale inventory | short HTML cache, inventory APIs remain dynamic |
| Private supplier/admin data exposed | keep existing robots/noindex/security path rules, review media routes |
| SEO claims become inaccurate | no fake official specs, no unverified stock claims |
| Social/outreach creates compliance risk | require approval for public posting and outbound messaging |

## Review Questions for CEO

1. Approve Phase 1 technical SEO cleanup first?
2. Should Sold inventory remain indexable as reference pages, or be removed from sitemap by default?
3. Should truck/machinery detail pages be allowed as separate canonical paths, or should all inventory remain under one `/half-cuts/detail.html` path for simplicity?
4. Confirm Ghana + Nigeria as first country-page markets.
5. Confirm whether homepage/about copy can be adjusted to clarify `AsiaPower = used engines / half-cuts / China powertrain sourcing`.

## Completion Criteria for APSEO-012

APSEO-012 is complete when:

- sitemap contains only canonical, commercially useful URLs
- detail pages have consistent canonical/internal/schema URL signals
- top 16 engine pages are upgraded or explicitly deferred
- first 6 country pages are live or explicitly rejected
- weekly GSC loop is running
- organic inquiries can be tied back to landing page/source

## Deployment Notes

This document is a plan only.

Before any production execution:

1. CEO approves the relevant phase.
2. Implementation PR/change set is prepared.
3. Preview or validation output is created where required.
4. Release Manager handles production deployment under OPS-005.
5. Post-release validation records status and rollback path.

# APSEO-011 Product Review

## Executive Summary

APSEO-011 converts AsiaPower SEO from page generation into a measurable Google Traffic Operating System.

The existing foundation is strong enough to begin execution:

- 50 generated engine pages exist.
- Engine Intelligence V2 defines the target page quality.
- SEO-009 identified duplicate canonical issues and page quality gaps.
- APCGO validated Ghana/Nigeria company and content opportunities.
- Engine Opportunity Ranking defines how new engine pages should be prioritized.

The next 90 days should focus on execution:

```text
canonical clarity
  -> high-intent page upgrades
  -> Ghana/Nigeria country pages
  -> internal linking
  -> schema expansion
  -> Search Console iteration
  -> organic inquiries
```

## Deliverables

Created under:

```text
docs/product/seo/
```

Files:

1. `apseo-011-roadmap.md`
2. `apseo-011-execution-plan.md`
3. `apseo-011-kpi.md`
4. `apseo-011-review.md`

## Existing Architecture Reviewed

### SEO-009

Key finding:

```text
50 generated pages have basic SEO completeness, but duplicate legacy/code-first URLs are the highest-priority SEO issue.
```

APSEO-011 response:

- prioritize canonical cleanup
- make code-first engine URLs the canonical identity
- prevent duplicate self-canonical pages

### Engine Intelligence V2

Key finding:

```text
Engine pages need SEO, trust, conversion, internal linking, schema, and buyer-intelligence layers.
```

APSEO-011 response:

- upgrade first 16 engine pages to V2 quality
- add FAQ, ItemList, related engines, related vehicles, half-cut and gearbox sections
- improve CTA and inquiry paths

### APCGO Outputs

Key finding:

```text
Ghana + Nigeria have validated company, content, keyword, and distribution opportunities.
```

APSEO-011 response:

- prioritize Ghana/Nigeria country pages
- prioritize Toyota diesel, Hyundai/Kia, Nissan, Honda and half-cut keywords
- connect SEO output to APSales handoff and inquiries

### Production-001 / TASK-008

Key finding:

```text
The first 50 pages are technically complete and safe, but still V1 quality.
```

APSEO-011 response:

- use V1 pages as indexable foundation
- manually improve high-signal pages first
- only expand through Opportunity Ranking

## Strategic Decisions

### Decision 1: Do Not Scale Weak Pages Blindly

New engine pages should pass Opportunity Ranking before production.

Reason:

- prevents thin content
- avoids low-value index bloat
- focuses crawl budget and internal links

Measured by:

- indexed page rate
- pages with impressions
- organic clicks
- inquiry conversion

### Decision 2: Ghana + Nigeria First

Reason:

- APCGO already produced market evidence.
- Both markets align with engines, gearboxes, half cuts, fleets, and import demand.
- Country pages create inquiry paths for buyers who do not know engine codes.

Measured by:

- country page impressions
- country page clicks
- Ghana/Nigeria organic inquiries

### Decision 3: Code-First Engine Canonical

Reason:

- SEO-009 found duplicate engine URL families.
- One engine entity needs one canonical page.

Measured by:

- duplicate canonical issues reduced
- ranking concentration
- indexed canonical URLs

### Decision 4: Internal Linking Is A Production Workstream

Reason:

- Engine pages cannot rank as isolated files.
- Google needs crawl paths and topical relationships.
- Buyers need paths from knowledge to quote.

Measured by:

- internal links added
- orphan page count
- pages with 5+ inbound links
- crawl/index improvement

### Decision 5: Search Console Becomes Weekly Operating Input

Reason:

- APCGO estimates are directional.
- Real Google impressions, CTR and average position should drive updates.

Measured by:

- weekly GSC review cycles
- low-CTR pages improved
- query clusters discovered
- pages updated from GSC data

## Highest-Impact Work

### 1. Canonical Cleanup

Impact:

- indexing
- rankings

Why:

Duplicate legacy and code-first engine URLs split SEO signals.

### 2. First 16 Engine Page Upgrades

Impact:

- rankings
- clicks
- inquiries
- conversion

Why:

These pages combine inventory signals and business demand.

### 3. Ghana/Nigeria Country Pages

Impact:

- indexed pages
- clicks
- inquiries

Why:

Country searches have direct import and sourcing intent.

### 4. Engine + Gearbox + Half-Cut Buyer Guides

Impact:

- rankings
- conversion
- higher-value inquiries

Why:

Many buyers start with an engine request but need package guidance.

### 5. Search Console Optimization Loop

Impact:

- clicks
- rankings
- content refresh

Why:

Pages with impressions but weak CTR are the fastest measurable SEO wins.

## Risks

### Risk 1: Duplicate Canonicals Continue

If code-first and legacy URLs remain self-canonical, Google may split ranking signals.

Mitigation:

- make code-first URL canonical
- remove or canonicalize legacy duplicates
- keep sitemap clean

### Risk 2: Content Expansion Creates Thin Pages

If pages are expanded without evidence or inquiry path, index quality suffers.

Mitigation:

- use Opportunity Ranking
- require internal links
- require FAQ and CTA
- keep unverified fields explicit

### Risk 3: Search Console Data Is Not Connected

Without GSC, prioritization stays directional.

Mitigation:

- start with repository and APCGO signals
- connect GSC export as soon as available
- tag every keyword cluster manually until automated

### Risk 4: Traffic Does Not Convert

Traffic without inquiry capture is not valuable.

Mitigation:

- add visible WhatsApp CTA
- add inquiry form on all commercial pages
- track landing page attribution
- review high-click/no-inquiry pages weekly

## CTO Review Questions

1. Should code-first engine URLs be approved as the permanent canonical pattern?
2. Should the first 16 engine pages be approved for V2 upgrade planning?
3. Should Ghana and Nigeria be the first country SEO markets for APSEO-011?
4. Should Search Console data become a required weekly APCGO/APSEO input?
5. Should organic inquiry attribution be prioritized before aggressive content expansion?

## Recommendation

APSEO-011 should be approved for execution planning.

Recommended next step:

```text
APSEO-012 — Canonical Cleanup and First 16 Engine Page Upgrade Plan
```

Scope for APSEO-012:

- no deployment
- no Runtime changes
- prepare implementation plan for canonical cleanup
- prepare V2 upgrade requirements for first 16 engine pages
- define validation checklist before production changes

## Final Status

APSEO-011 is ready for CTO review.

Decision:

```text
READY FOR CTO REVIEW
```

# SEO-009 - Engine Landing Page Optimization

## 1. Scope

Objective: increase Google indexing and inquiry conversion for AsiaPower engine landing pages.

This review covers local engine detail pages under `engines/`.

No deployment was performed.
No nginx, deploy scripts, server infrastructure, backup, systemd, or production configuration files were modified.
No engine page HTML was modified in this task.

## 2. Page Inventory Reviewed

Total engine detail HTML pages reviewed:

```text
62
```

Breakdown:

- 50 TASK-008 code-first generated engine pages.
- 12 legacy brand-prefixed engine pages.

TASK-008 generated pages include examples such as:

- `engines/g4fc.html`
- `engines/g4na.html`
- `engines/2az-fe.html`
- `engines/1zz-fe.html`
- `engines/651-955.html`

Legacy brand-prefixed pages:

- `engines/honda-k24a.html`
- `engines/hyundai-g4kd.html`
- `engines/hyundai-g4na.html`
- `engines/nissan-hr15de.html`
- `engines/nissan-hr16de.html`
- `engines/nissan-qr25de.html`
- `engines/toyota-1kd-ftv.html`
- `engines/toyota-1nz-fe.html`
- `engines/toyota-1zz-fe.html`
- `engines/toyota-2kd-ftv.html`
- `engines/toyota-2nz-fe.html`
- `engines/toyota-2tr-fe.html`

## 3. Current SEO Baseline

Across all 62 engine detail pages:

- Title exists: 62 / 62
- Meta description exists: 62 / 62
- Canonical exists: 62 / 62
- JSON-LD exists: 50 / 62
- FAQ coverage exists: 50 / 62
- WhatsApp CTA exists: 62 / 62
- Related Engines section exists: 50 / 62
- Related Half Cuts section exists: 50 / 62
- Related Gearboxes section exists: 50 / 62

Across the 50 TASK-008 generated pages:

- Title exists: 50 / 50
- Meta description exists: 50 / 50
- Canonical exists: 50 / 50
- JSON-LD exists: 50 / 50
- FAQ coverage exists: 50 / 50
- WhatsApp CTA exists: 50 / 50
- Related Engines section exists: 50 / 50
- Related Half Cuts section exists: 50 / 50
- Related Gearboxes section exists: 50 / 50

Conclusion:

```text
TASK-008 solved basic page completeness for the first 50 engine pages.
SEO-009 should now focus on quality, canonical discipline, internal link depth, and conversion.
```

## 4. Critical SEO Issue: Duplicate Engine URLs

The highest-priority SEO problem is URL duplication between legacy brand-prefixed pages and new code-first pages.

Examples:

- `engines/g4na.html` and `engines/hyundai-g4na.html`
- `engines/g4kd.html` and `engines/hyundai-g4kd.html`
- `engines/k24a.html` and `engines/honda-k24a.html`
- `engines/hr15de.html` and `engines/nissan-hr15de.html`
- `engines/hr16de.html` and `engines/nissan-hr16de.html`
- `engines/qr25de.html` and `engines/nissan-qr25de.html`
- `engines/1kd-ftv.html` and `engines/toyota-1kd-ftv.html`
- `engines/1nz-fe.html` and `engines/toyota-1nz-fe.html`
- `engines/1zz-fe.html` and `engines/toyota-1zz-fe.html`
- `engines/2kd-ftv.html` and `engines/toyota-2kd-ftv.html`
- `engines/2nz-fe.html` and `engines/toyota-2nz-fe.html`
- `engines/2tr-fe.html` and `engines/toyota-2tr-fe.html`

Problem:

- Both URL families describe the same engine entity.
- Legacy pages self-canonicalize to the brand-prefixed URL.
- New pages self-canonicalize to the code-first URL.
- This splits ranking signals and creates Google index selection uncertainty.

Recommendation:

```text
Make code-first URLs the canonical engine identity.
```

Preferred canonical pattern:

```text
/engines/{engine-code}.html
```

Legacy brand-prefixed URLs should eventually become one of:

- 301 redirects to the code-first URL.
- Thin compatibility aliases with canonical pointing to the code-first URL.
- Removed from sitemap if they remain non-canonical.

Do not keep both URL sets as self-canonical indexable pages for the same engine.

## 5. SEO Title Review

Current generated title pattern:

```text
{ENGINE_CODE} Engine - Export & Sourcing | AsiaPower
```

Strengths:

- Unique across the 50 generated pages.
- Engine code appears early.
- Brand appears in page body and structured data.

Weaknesses:

- Too generic across all pages.
- Does not expose strongest buyer intent terms consistently.
- Does not include high-conversion qualifiers such as half-cut, used engine, engine and gearbox, China supply, or Africa export.

Recommended scalable title patterns:

For pages with strong inventory signals:

```text
{ENGINE_CODE} Engine for Sale | China Export, Half-Cuts & Gearboxes
```

For pages with weak or no inventory signals:

```text
{ENGINE_CODE} Engine Sourcing | AsiaPower China Export Desk
```

For known Africa-demand Toyota/Nissan/Hyundai/Kia pages:

```text
{ENGINE_CODE} Engine for Africa Export | AsiaPower
```

For Mercedes or precision-code pages:

```text
{ENGINE_CODE} Mercedes Engine Sourcing | Photos, VIN Match & Export Quote
```

Implementation recommendation:

- Add title variants by engine opportunity tier.
- Avoid one title pattern for all pages.
- Keep title length around 50-65 characters where possible.

## 6. Meta Description Review

Current generated meta descriptions are unique but often formulaic.

Example pattern:

```text
Source {ENGINE_CODE} engines for export. Applications: ... AsiaPower checks China supply, related half-cuts, gearbox pairing, and EXW/CIF quote details.
```

Strengths:

- Unique by engine and application list.
- Mentions export, China supply, half-cuts, gearbox pairing, and EXW/CIF.

Weaknesses:

- Several descriptions are longer than ideal snippet length.
- Most descriptions share the same sentence structure.
- The buyer action is not always explicit enough.

Recommended meta description formula:

```text
Need {ENGINE_CODE} engine or half-cut? AsiaPower checks China supply, gearbox match, photos, condition and EXW/CIF quote for {TOP_APPLICATIONS}.
```

For low-data pages:

```text
Ask AsiaPower to source {ENGINE_CODE}. Send model, year, gearbox and destination port; we confirm availability before quote.
```

Target:

- 145-160 characters.
- Engine code in first 30 characters.
- One clear buyer action.
- No unverified stock claim.

## 7. Structured Data Review

The 50 generated pages include JSON-LD with:

- `BreadcrumbList`
- `Product`
- `FAQPage`

Strengths:

- JSON-LD is present on all 50 generated pages.
- FAQ schema is aligned with visible FAQ content.
- Product schema avoids claiming fixed price or guaranteed stock.

Weaknesses:

- The 12 legacy pages have no JSON-LD.
- Product schema could better represent engine-code identity and related supply options.
- Related half-cuts and related engines are visible on page but not modeled as structured relationships.

Recommendations:

- Add JSON-LD to legacy pages only if they remain indexable.
- Add `additionalProperty` fields consistently:
  - engine code
  - brand/manufacturer signal
  - displacement when verified
  - fuel type when verified
  - inventory signal count
  - verified status
- Keep `Offer` conservative:
  - no fixed price unless verified
  - availability should not imply confirmed stock
  - quote URL should point to the page inquiry section
- Consider adding `ItemList` JSON-LD for related engines and related half-cuts where visible on the page.

## 8. FAQ Review

Current FAQ coverage:

- 50 generated pages include FAQ content and FAQ schema.
- 12 legacy pages do not.

Strengths:

- FAQs answer buyer workflow questions:
  - compatible vehicles
  - engine-only vs half-cut
  - quotation requirements

Weaknesses:

- FAQ wording is still heavily templated.
- FAQ does not yet vary enough by engine family failure modes, market, or buyer intent.
- Some FAQs mention VIN/chassis evidence but do not explain practical matching differences by platform.

Recommended FAQ categories:

- Fitment confirmation:
  - "Can {ENGINE_CODE} fit {MODEL}?"
  - "What model year should I confirm before buying?"
- Buying format:
  - "Should I buy bare engine, complete engine, or half-cut?"
- Export quote:
  - "What does AsiaPower need to quote CIF Tema/Lagos/Cotonou?"
- Inspection:
  - "What photos should I request before payment?"
- Matching risk:
  - "What are common mistakes when buying {ENGINE_CODE}?"

Scalable improvement:

- Generate 2 shared workflow FAQs and 2 engine-family-specific FAQs per page.
- Engine families should include Toyota NZ/AZ/KD/TR, Hyundai-Kia G4, Nissan HR/MR/QR, Honda K/R/L, Mercedes M/OM, Mitsubishi 4B, Suzuki M/K.

## 9. Internal Link Review

Current generated pages include:

- Breadcrumb links.
- Related engine links.
- Related half-cut links where repository records exist.
- Related gearbox text section.

Important gap:

```text
Related Gearboxes exists as a section, but currently does not link to actual gearbox URLs or filtered gearbox pages.
```

Additional gaps:

- Some low-signal pages have no related half-cut links.
- Legacy pages do not include related engine, related half-cut, or related gearbox modules.
- Code-first and brand-prefixed URLs compete instead of consolidating link equity.

Recommendations:

- Add real links from engine pages to:
  - relevant half-cut detail pages
  - gearbox category or filtered gearbox pages
  - brand pages
  - model pages where available
  - compatible engine family pages
- Add reciprocal links from half-cut detail pages back to engine pages.
- Add reciprocal links from engine index and brand pages to code-first engine pages.
- Avoid linking to legacy duplicate engine URLs once canonical direction is decided.

Priority internal link graph:

```text
Brand page -> Engine page -> Half-cut detail -> Inquiry
Model page -> Engine page -> Related gearbox -> Inquiry
Engine page -> Related engine alternatives -> Inquiry
```

## 10. Related Engines Review

The 50 generated pages include Related Engines sections.

Strengths:

- Related engine links exist.
- Links are engine-code based.
- The section helps Google discover more code-first pages.

Weaknesses:

- Relationship logic is broad and mostly brand/family based.
- It does not yet distinguish substitute engines, same family engines, same chassis engines, or buyer alternatives.

Recommended relationship labels:

- Same family
- Same brand
- Same vehicle platform
- Common buyer alternative
- Same displacement class
- Same export market demand

Example:

```text
G4NA -> G4KD: Hyundai/Kia 2.0L family buyer comparison
1KD-FTV -> 2KD-FTV: Toyota diesel export alternative
HR15DE -> HR16DE: Nissan compact petrol family
```

## 11. Related Half-Cuts Review

The 50 generated pages include Related Half Cuts sections.

Strengths:

- Pages correctly state that related records are repository inventory signals, not live-stock promises.
- Pages avoid claiming confirmed stock.
- Links point to half-cut detail routes when records exist.

Weaknesses:

- Some pages have no related half-cut examples.
- Half-cut records are not prioritized by export usefulness or confidence.
- The section does not yet expose freshness or confirmation status in a structured way.

Recommendations:

- Rank related half-cuts by:
  - verified status
  - image availability
  - engine-code confidence
  - recent update
  - export relevance
  - complete engine/gearbox availability
- Display a clear confirmation label:
  - "Inventory signal"
  - "Needs confirmation"
  - "Verified inventory"
- Never show supplier private data.
- Never expose full VIN.

## 12. Related Gearboxes Review

The Related Gearboxes section is present on 50 generated pages.

Current weakness:

```text
It is mostly text, not a conversion link path.
```

Recommendations:

- Link gearbox signals to `gearboxes/` or filtered gearbox pages once available.
- Show buyer language:
  - "Confirm 6AT pairing before quote"
  - "Ask for engine + gearbox assembly"
  - "Send gearbox code if available"
- Create engine-to-gearbox relationship data:
  - engine code
  - gearbox code
  - transmission type
  - donor model
  - confidence
  - source

This is important because many export buyers want engine + gearbox or half-cut, not bare engine only.

## 13. CTA and WhatsApp Conversion Review

Current generated pages include:

- Hero WhatsApp CTA.
- Hero "Send enquiry" anchor.
- Bottom inquiry form.
- Bottom WhatsApp CTA.
- Pre-filled WhatsApp text with engine code and application context.

Strengths:

- CTA appears above the fold on generated pages.
- WhatsApp text includes engine code.
- Form captures destination country and port.
- Page copy states that stock and price require confirmation.

Weaknesses:

- Legacy pages mostly rely on JS-rendered content and global WhatsApp.
- CTA wording is still generic across many pages.
- The WhatsApp CTA does not yet adapt enough to supply status:
  - verified signal
  - no inventory signal
  - half-cut available
  - gearbox pairing available
- No visible trust block near CTA explaining AsiaPower's export workflow.

Recommended CTA variants:

For strong inventory signal pages:

```text
Check current {ENGINE_CODE} stock and half-cut options
```

For low-signal sourcing pages:

```text
Ask AsiaPower to source {ENGINE_CODE}
```

For high-risk matching pages:

```text
Verify {ENGINE_CODE} fitment before quote
```

Recommended WhatsApp prefill fields:

- engine code
- vehicle model
- model year
- gearbox type
- destination port
- desired format: bare engine / complete engine / half-cut

## 14. Duplicate Template Findings

No duplicate SEO titles were found across the reviewed pages.

No duplicate meta descriptions were found across the reviewed pages.

However, repeated body templates remain.

Repeated paragraph examples:

```text
Check gearbox pairing, wiring harness, ECU availability, alternator, compressor, and starter.
```

Observed across 15 pages.

```text
Assuming Sportage, Sonata, Elantra, Tucson, Forte, or ix35 fitment is identical across years.
```

Observed across 11 Hyundai/Kia pages.

Assessment:

- This is not a blocker for indexing.
- It is a quality risk for large-scale expansion.
- The next generator version should reduce repeated checklist and matching-mistake copy.

Recommended fix:

- Create family-specific inspection templates.
- Create market-specific export notes.
- Create application-specific matching warnings.
- Require each page to include at least 2 paragraphs with engine-family-specific vocabulary.

## 15. Priority Page Groups

Highest priority for manual optimization:

1. `engines/g4fc.html`
2. `engines/g4na.html`
3. `engines/r20a3.html`
4. `engines/1zr-fe.html`
5. `engines/hr16de.html`
6. `engines/2az-fe.html`
7. `engines/mr20de.html`
8. `engines/1kd-ftv.html`
9. `engines/2kd-ftv.html`
10. `engines/651-955.html`

Reason:

- High inventory signals or high export demand.
- Strong fit with Africa/Middle East buyer behavior.
- Clear ability to route inquiries into engine, half-cut, or gearbox workflows.

## 16. Scalable Improvements

Recommended next generator upgrades:

1. Canonical identity enforcement

Use code-first engine URLs as canonical and prevent duplicate brand-prefixed pages from competing.

2. Title strategy by opportunity tier

Generate different titles for verified inventory, high-demand sourcing, low-data sourcing, and precision-code pages.

3. Meta description compression

Keep descriptions around 145-160 characters and make the buyer action explicit.

4. Relationship graph

Add structured related entities:

- engine to engine
- engine to gearbox
- engine to half-cut
- engine to brand
- engine to model

5. Family-specific FAQ templates

Use family-aware FAQ and matching warnings instead of one broad template.

6. Conversion-aware CTA

Generate CTA variants based on:

- inventory signals
- half-cut records
- gearbox signals
- buyer risk
- export destination

7. Legacy page consolidation

Resolve brand-prefixed duplicate pages before scaling beyond 50 pages.

8. Internal link reciprocity

Make half-cut pages link back to engine pages and engine pages link to half-cut/gearbox opportunities.

9. Data confidence labels

Expose public-safe labels:

- verified
- not verified yet
- needs stock confirmation
- inventory signal only

10. Content uniqueness guard

Add generator checks that flag repeated paragraphs appearing on more than 5 pages.

## 17. Recommended Roadmap

Phase 1: Canonical cleanup

- Decide code-first URL as canonical.
- Point duplicate legacy pages to code-first canonical or redirect later.
- Remove duplicate legacy URLs from sitemap if present.

Phase 2: High-value manual page optimization

- Rewrite top 10 page titles and descriptions.
- Add stronger buyer-specific CTA language.
- Improve FAQs for Toyota, Hyundai/Kia, Nissan, Honda, Mercedes.

Phase 3: Internal link expansion

- Link engine pages to half-cut records.
- Add reciprocal links from half-cut detail pages to engine pages.
- Add gearbox links once route/filter support exists.

Phase 4: Generator quality rules

- Add duplicate paragraph detection.
- Add title/meta length warnings.
- Add canonical duplicate warnings.
- Add family-specific copy modules.

Phase 5: Inquiry conversion tracking

- Track which engine page generated the WhatsApp/form inquiry.
- Preserve engine code, page URL, and CTA source in inquiry data.
- Route high-intent inquiries to APSales with engine context.

## 18. Final Recommendation

SEO-009 should not start by generating more pages.

The next highest-ROI move is:

```text
Fix canonical duplication, improve top 10 generated pages, and strengthen internal links from engine pages to half-cuts, gearboxes, and inquiry flows.
```

TASK-008 solved page existence.

SEO-009 should now solve page quality, crawl clarity, and inquiry conversion.

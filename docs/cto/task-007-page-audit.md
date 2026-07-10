# TASK-007 - Production-001 Engine Page Audit

Date: 2026-07-05

Scope: read-only audit of Production-001 generated engine pages. No page, generator, sitemap, or code file was modified.

## Sample Method

Production-001 reported 50 generated engine pages. I used a fixed random seed for reproducibility and selected 10 pages:

- `engines/g4fg.html`
- `engines/k24z4.html`
- `engines/2tr-fe.html`
- `engines/1jz-ge.html`
- `engines/r18a2.html`
- `engines/g4ka.html`
- `engines/qr25de.html`
- `engines/k24a.html`
- `engines/mr20de.html`
- `engines/r18a.html`

## Executive Verdict

Overall grade for the sampled batch: **B - suggest modification before active SEO push**.

The pages are technically valid and mostly safe:

- Titles are unique.
- Meta descriptions are unique.
- H1s are unique.
- JSON-LD parses correctly.
- Internal file links are not broken.
- Pages avoid claiming live stock availability.
- Pages do not expose supplier phone numbers, supplier private notes, or full VINs.

The main issue is content quality:

- FAQ answers are almost fully templated.
- Multiple paragraphs repeat across all sampled pages.
- Several pages have no related half-cut examples.
- References are real repository sources, but too generic to prove each claim.
- The pages show AsiaPower workflow language, but not enough unique AsiaPower advantage per engine.
- Google may classify lower-signal pages as thin or mass-generated doorway-like content.

## Batch-Level Checks

Across the 50 Production-001 pages:

- Unique title count: `50 / 50`
- Unique meta description count: `50 / 50`
- Unique H1 count: `50 / 50`

For the 10 sampled pages:

- JSON-LD valid: `10 / 10`
- Required page sections present: `10 / 10`
- Broken internal file links detected: `0`
- Local duplicate paragraphs inside a single page: `0`
- Cross-page repeated generic paragraphs: high

Repeated across all 10 sampled pages:

- stock/price confirmation paragraph,
- application confirmation paragraph,
- official specs warning paragraph,
- related half-cut disclaimer,
- all three FAQ answer patterns,
- shipping paragraph,
- form submission disclaimer,
- form success message.

## Page-by-Page Audit

### 1. `engines/g4fg.html` - Grade B

Findings:

- Title, meta description, and H1 are unique.
- JSON-LD is valid.
- Related half-cut examples exist: Hyundai Elantra/Langdong G4FG records.
- References correspond to inventory and engine directory sources.
- FAQ is generic and does not explain G4FG-specific matching, common Hyundai/Kia applications, or buyer risks.
- Body has strong template repetition.

Risk:

- Medium AI-pattern risk.
- Low-to-medium thin content risk because inventory examples exist.

Action:

- Keep, but manually improve FAQ and add G4FG-specific applications and buyer notes.

### 2. `engines/k24z4.html` - Grade B

Findings:

- Unique title/meta/H1.
- JSON-LD valid.
- Related half-cut examples exist and are relevant to Honda CR-V.
- References point to QXB/import and approved inventory.
- Specifications are mostly `Not verified yet`, correctly avoiding invented official data.
- FAQ is generic and not K24Z4-specific.

Risk:

- Medium AI-pattern risk.
- Medium thin content risk because there is only one application cluster visible.

Action:

- Keep, but add K24Z4-specific Honda CR-V/Accord context and fitment warnings.

### 3. `engines/2tr-fe.html` - Grade B/C Borderline

Findings:

- Unique title/meta/H1.
- JSON-LD valid.
- References are real: existing Toyota page, engine directory, growth audit.
- No related half-cut examples are public on the page.
- Body is almost entirely generic apart from application names.
- 2TR-FE is commercially important, but this generated page does not yet prove AsiaPower inventory strength.

Risk:

- High thin content risk.
- High AI-pattern risk.

Action:

- Do not actively push until inventory examples, buyer country demand, or verified applications are added.

### 4. `engines/1jz-ge.html` - Grade C

Findings:

- Unique title/meta/H1.
- JSON-LD valid.
- Reference is only `js/engine-directory.js`.
- No related half-cut examples.
- No historical inquiry, inventory, or AsiaPower-specific proof appears on the page.
- The page is structurally complete but substantively weak.

Risk:

- High thin content risk.
- High AI-generated pattern risk.
- Weak business justification from current repository data.

Action:

- Remove from sitemap or hold as draft until real inventory/search/inquiry evidence exists.

### 5. `engines/r18a2.html` - Grade B

Findings:

- Unique title/meta/H1.
- JSON-LD valid.
- Related half-cut examples exist and are Honda Civic-specific.
- References correspond to growth audit and inventory data.
- FAQ is generic.
- Page has useful inventory signal, but lacks R18A2-specific fitment and buyer guidance.

Risk:

- Medium thin content risk.
- Medium AI-pattern risk.

Action:

- Keep, but improve with Civic year ranges and exact stock examples.

### 6. `engines/g4ka.html` - Grade B

Findings:

- Unique title/meta/H1.
- JSON-LD valid.
- Related half-cut examples exist: Hyundai Sonata/Lingxiang records.
- References correspond to inventory data.
- Applications are thin.
- FAQ and body are heavily templated.

Risk:

- Medium thin content risk.
- Medium AI-pattern risk.

Action:

- Keep if inventory remains verified; add Hyundai/Kia-specific application and quote details.

### 7. `engines/qr25de.html` - Grade B

Findings:

- Unique title/meta/H1.
- JSON-LD valid.
- Related half-cut examples exist and match Nissan X-Trail/QR25DE.
- References are stronger than average: growth audit, existing page, engine directory, inventory sources.
- FAQ is still generic.
- Page should explain QR25DE-specific applications and compatibility risk.

Risk:

- Low-to-medium thin content risk because inventory examples and sources exist.
- Medium AI-pattern risk.

Action:

- Keep, prioritize manual optimization.

### 8. `engines/k24a.html` - Grade B/C Borderline

Findings:

- Unique title/meta/H1.
- JSON-LD valid.
- References are real: growth audit, existing Honda K24A page, engine directory.
- No related half-cut examples.
- The page targets a known search topic, but current generated content is generic.

Risk:

- High thin content risk if indexed as-is.
- High AI-pattern risk.

Action:

- Keep only if this page is manually enriched soon; otherwise remove from sitemap until stock examples exist.

### 9. `engines/mr20de.html` - Grade B

Findings:

- Unique title/meta/H1.
- JSON-LD valid.
- Related Nissan Qashqai MR20DE half-cut examples exist.
- References are reasonably strong.
- FAQ and main body are templated.
- Page has clear commercial potential and should be upgraded.

Risk:

- Low-to-medium thin content risk.
- Medium AI-pattern risk.

Action:

- Keep and prioritize manual optimization.

### 10. `engines/r18a.html` - Grade B/C Borderline

Findings:

- Unique title/meta/H1.
- JSON-LD valid.
- References are growth audit and engine directory only.
- No related half-cut examples.
- Content overlaps heavily with R18A2 and other Honda pages.
- Generic `R18A` may create variant ambiguity unless aliases and variants are handled carefully.

Risk:

- High thin content risk.
- High duplicate/variant-confusion risk.

Action:

- Hold or consolidate with R18A variant strategy unless inventory/search evidence justifies a standalone page.

## A / B / C Classification

### A - Can Go Live

None of the sampled pages deserve a clean A yet.

Reason:

- all sampled pages show strong generator pattern,
- FAQ is not engine-specific,
- AsiaPower advantage is not differentiated enough,
- lower-signal pages lack real inventory examples.

### B - Suggest Modification

- `engines/g4fg.html`
- `engines/k24z4.html`
- `engines/2tr-fe.html`
- `engines/r18a2.html`
- `engines/g4ka.html`
- `engines/qr25de.html`
- `engines/k24a.html`
- `engines/mr20de.html`
- `engines/r18a.html`

These pages are not broken. They can be used as drafts or soft-launch pages, but should be improved before active Google indexing or internal-link push.

### C - Suggest Delete / Remove From Sitemap Until Data Exists

- `engines/1jz-ge.html`

Reason:

- no related half-cut examples,
- only one generic reference,
- no visible AsiaPower demand or inventory proof,
- high thin-content risk.

## Audit Criteria Summary

| Item | Result |
|---|---|
| Unique title | Pass |
| Unique meta description | Pass |
| Unique H1 | Pass |
| Duplicate paragraphs inside same page | Pass |
| Duplicate paragraphs across pages | Fail |
| FAQ quality | Weak |
| References | Real but too generic |
| JSON-LD | Pass |
| Internal links | Pass for file existence |
| Thin content risk | Medium to high |
| AI-generated pattern risk | High |
| AsiaPower differentiation | Weak to medium |

## Generator TOP10 Issues To Fix

1. Generate engine-specific FAQ answers.

   Current FAQ is mostly the same across pages. It should use each engine's applications, inventory examples, buyer risks, and quote requirements.

2. Stop repeating identical paragraphs across every page.

   Rotate wording is not enough. Each page needs unique substance from inventory, inquiry, applications, region, and sourcing data.

3. Require a minimum evidence threshold before sitemap inclusion.

   Pages with only `js/engine-directory.js` and no inventory/inquiry/search evidence should stay draft.

4. Separate high-opportunity no-inventory pages from publishable inventory-backed pages.

   `2TR-FE`, `K24A`, and `R18A` may be worth targeting, but not with current thin template content.

5. Make References field-level, not just file-level.

   References should say which source supports applications, inventory examples, title/meta, shipping, and specifications.

6. Add engine-specific AsiaPower advantage.

   Examples: verified half-cut records, China sourcing ability, EXW/CIF export routes, Africa demand, fast supplier confirmation, related stock IDs.

7. Improve Related Half Cuts logic.

   If no examples exist, do not output a generic empty block as if it has equal SEO value. Either omit, mark as sourcing-only, or keep page draft.

8. Add variant/alias control.

   Generic pages such as `R18A` can overlap with `R18A1` and `R18A2`. Generator should prevent variant cannibalization.

9. Improve internal links beyond related engines.

   Link to brand pages, engine catalog, relevant half-cut category, contact page, and verified stock detail pages with meaningful anchor text.

10. Add content quality gates.

   Before publishing, fail pages with too many repeated paragraphs, generic FAQ answers, no inventory examples, weak references, or insufficient AsiaPower-specific content.

## Final Recommendation

Do not delete the whole Production-001 batch. The technical foundation is usable.

But do not treat all 50 pages as finished SEO assets. The next Generator iteration should rank and filter pages before sitemap inclusion, then enrich high-opportunity pages with engine-specific content and AsiaPower-specific proof before broad indexing.

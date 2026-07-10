# SEO-010 Production Review

## Executive Summary

The G4KD V2 preview is a strong CEO-review prototype and a good direction for the future Engine Intelligence page. It has a premium industrial visual style, clear buyer workflow, strong CTA placement, mobile sticky actions, comparison tables, trust blocks, timeline, FAQ accordion, and a much better information hierarchy than the current generated pages.

However, it is not ready to become the production Engine Intelligence page yet. The current file is still explicitly a preview/prototype, not a production SEO page. Several production-blocking items remain: preview-oriented title/meta copy, no canonical tag, no actual JSON-LD block, placeholder internal links, prototype form behavior, CSS background image without production image optimization semantics, and missing real production integration for inquiry tracking.

The production decision is therefore NO.

## Must Fix

1. Replace preview SEO metadata with production metadata.

Current title:

```text
G4KD Engine Detail V2 Preview | AsiaPower
```

Current meta description:

```text
Interactive CEO preview for the AsiaPower G4KD Engine Detail Page V2 template.
```

These are not acceptable for production because they describe the page as a preview instead of an engine buying page.

Required:

- Production SEO title focused on buyer intent.
- Production meta description focused on G4KD engine, half-cut, gearbox matching, export quote, and fitment confirmation.
- Canonical URL.
- Open Graph title/description/url/image.

2. Add production structured data.

The preview visually mentions Product JSON-LD and FAQ schema readiness, but the HTML does not contain an actual `application/ld+json` block.

Required JSON-LD:

- `WebPage`
- `BreadcrumbList`
- `Product`
- `FAQPage`
- `ItemList` for related engines
- `ItemList` for related half-cuts
- Optional `HowTo` for inspection/export workflow

Rules:

- No fake price.
- No fake rating/reviews.
- No confirmed stock claim.

3. Replace placeholder internal links.

The preview uses multiple `href="#"` links for brand, related engines, related half-cuts, and navigation placeholders.

Required:

- Real links to engine index.
- Real links to canonical engine pages.
- Real links to related half-cut detail pages.
- Real brand/internal catalog links where available.
- No placeholder links in production.

4. Convert prototype inquiry behavior to production inquiry behavior.

The form currently has prototype behavior:

- `Submit prototype inquiry`
- no production `data-form="contact-enquiry"` integration
- no hidden production fields
- no confirmed APSales/APInventory routing metadata

Required:

- Production enquiry form attributes.
- Hidden fields for engine code, source page, product type, and buying format.
- Existing AsiaPower form success/error behavior.
- WhatsApp prefill updated from placeholder tokens to a production-safe template.

5. Resolve image optimization for production.

The industrial blueprint is currently used as a CSS background image.

Production concerns:

- No `alt` text because it is not an `<img>`.
- No explicit dimensions.
- No preload/fetch priority decision.
- Large hero background could affect LCP.

Required:

- Decide whether the image is decorative or content.
- If content: use an optimized `<img>`/`picture` with width, height, alt, lazy/eager strategy.
- If decorative: keep CSS background but optimize file size and verify LCP impact.

6. Remove preview-only language.

Production page must not say:

- CEO Preview
- Design only
- Prototype
- Preview interaction
- Product JSON-LD-ready
- FAQ schema-ready

These phrases are useful for review but inappropriate for Google or buyers.

7. Add real canonical identity decision.

The production version must decide whether it replaces:

```text
/engines/g4kd.html
```

or remains a separate non-indexed preview.

Production should not index:

```text
/docs/previews/seo-010/g4kd-v2-preview.html
```

as an engine landing page.

8. Validate mobile layout in browser before production.

The CSS is responsive and well-structured, but production readiness requires visual verification on:

- desktop
- tablet
- mobile

Particular risk areas:

- sticky header plus sticky section nav stack height
- horizontal tables on small screens
- hero height and first-fold CTA visibility
- bottom mobile CTA overlapping final form content

## Nice to Have

1. Add richer EEAT signals.

Useful additions:

- "How AsiaPower verifies engine stock" detail.
- "What APSales checks" vs "What APInventory checks".
- Clear statement that unverified official specs remain unfilled.
- References section for repository/public data sources.

2. Add engine variants and OEM reference handling.

The preview covers G4KD at the engine-code level, but production Engine Intelligence should include:

- known Hyundai/Kia application variants
- market/version caveats
- OEM reference placeholders where verified
- accessory/ECU/harness variation notes

3. Add stronger supplier trust without exposing suppliers.

Recommended copy:

- supplier network exists but private supplier names are not public
- photos/video requested where available
- stock confirmed before quote
- no live-stock claim until verified

4. Add more specific related engine logic.

Related engines should show why each engine is related:

- same Hyundai/Kia family
- buyer alternative
- same vehicle platform
- displacement class
- export demand relationship

5. Improve Core Web Vitals readiness.

Recommended before production:

- extract or cache CSS if this becomes a repeated template
- minimize inline SVG repetition
- avoid unnecessary heavy shadows on low-end mobile devices
- optimize the blueprint asset
- verify LCP and CLS with a browser audit

6. Add persistent "quote readiness" summary to production only if it routes real data.

The interactive quote-readiness side card is useful, but it should either:

- write into the inquiry payload, or
- remain purely visual and be clearly safe.

7. Add a real References section.

Production Engine Intelligence pages should cite:

- AsiaPower repository engine directory
- knowledge record
- approved inventory signals
- half-cut data sources
- official specs only when verified

## Production Decision

NO

## If NO

Exact implementation tasks required before deployment:

1. Convert the preview file into a production engine page target, preferably:

```text
engines/g4kd.html
```

or create a controlled production test URL with `noindex` until approved.

2. Replace preview title and meta description with production SEO copy.

3. Add canonical, Open Graph, and Twitter metadata.

4. Add valid JSON-LD:

- `WebPage`
- `BreadcrumbList`
- `Product`
- `FAQPage`
- `ItemList`
- optional `HowTo`

5. Replace all `href="#"` placeholders with real internal links.

6. Replace preview-only labels and text with buyer-facing production copy.

7. Integrate the inquiry form with the existing AsiaPower contact/enquiry handling.

8. Update WhatsApp CTA prefill to a production-safe message.

9. Decide image implementation:

- optimized content image with dimensions and alt, or
- optimized decorative background with verified LCP impact.

10. Add a production References section.

11. Add engine variants / OEM reference placeholders only where verified.

12. Run visual QA on desktop, tablet, and mobile.

13. Run SEO validation:

- title length
- meta length
- H1/H2/H3 hierarchy
- canonical
- internal links
- JSON-LD parse
- FAQ visible/schema match

14. Run privacy/safety validation:

- no supplier names
- no supplier phone numbers
- no private notes
- no full VINs
- no fake price
- no fake official specs
- no confirmed stock claim unless verified

15. Only after those tasks pass, approve it as the production Engine Intelligence template.

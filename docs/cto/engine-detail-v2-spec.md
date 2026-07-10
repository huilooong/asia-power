# Engine Detail Page V2 Spec

## 1. Objective

Engine Detail Page V2 is the standard template for AsiaPower engine buying pages.

Primary goals:

- Increase Google indexing quality.
- Increase buyer trust.
- Increase WhatsApp and inquiry-form conversion.
- Preserve safety around unverified stock, supplier privacy, and unverified official specifications.

The V2 template is designed as a flagship buying page, not a thin SEO page. It should answer the full buyer journey:

```text
Can this engine fit my vehicle?
Should I buy engine only or half-cut?
What gearbox should match it?
What proof do I need before paying?
Can AsiaPower export it to my port?
How do I ask for a quote?
```

## 2. Canonical Identity

Canonical URL pattern:

```text
/engines/{engine-code}.html
```

For V2 examples and tests:

```text
/engines/g4kd-v2.html
```

Future production canonical for the live G4KD page should remain:

```text
/engines/g4kd.html
```

The V2 example page is intentionally a preview/template page and should not replace current production pages until approved.

## 3. Required Sections

### 3.1 Hero

Purpose:

- Confirm the exact engine code.
- Explain buying intent immediately.
- Place WhatsApp and form CTA above the fold.
- State availability and price require confirmation.

Required elements:

- H1 with engine code.
- Short buyer-focused description.
- Engine code, brand, displacement, fuel, supply signal, and quote status.
- Primary WhatsApp CTA.
- Secondary inquiry-form CTA.
- Trust microcopy.

### 3.2 Compatible Models

Purpose:

- Capture model-level SEO.
- Reduce wrong-fit inquiries.
- Give buyers a checklist before contacting APSales.

Required fields:

- Brand
- Model
- Year signal
- Gearbox signal
- Fitment confidence
- Required buyer evidence

Rule:

- Do not claim guaranteed compatibility. Use confirmation language.

### 3.3 Engine Specifications

Purpose:

- Provide structured facts.
- Separate verified repository facts from unverified official specs.

Required fields:

- Engine code
- Manufacturer / brand
- Displacement
- Fuel
- Known applications
- Power / torque / bore / stroke
- Source
- Confidence

Rule:

- If official technical data is not verified, show `Not verified yet`.

### 3.4 Common Failures

Purpose:

- Capture buyer-intent searches around engine problems.
- Help buyers inspect used engines safely.

Rule:

- Only label a failure as confirmed when the repository contains verified repair data.
- Otherwise use "inspection risk area" language.

Recommended risk areas:

- Abnormal knocking or bottom-end noise.
- Overheating history.
- Oil contamination.
- Compression imbalance.
- Timing noise.
- Harness / ECU mismatch.
- Mount and accessory differences.

### 3.5 Engine vs Half-Cut Recommendation

Purpose:

- Help buyers choose the right buying format.
- Increase conversion to higher-value half-cut and engine+gearbox deals when appropriate.

Required comparison:

- Bare engine
- Complete engine with accessories
- Engine + gearbox
- Half-cut

Decision logic:

- Choose bare engine when buyer has compatible accessories and gearbox.
- Choose complete engine when accessories or harness are uncertain.
- Choose engine + gearbox when gearbox pairing risk is high.
- Choose half-cut when buyer needs ECU, wiring, mounts, front accessories, and proof from donor vehicle.

### 3.6 Matching Gearboxes

Purpose:

- Link engine-page SEO with gearbox buying intent.
- Reduce wrong engine+gearbox quotations.

Required fields:

- Gearbox signal
- Donor model
- Transmission type
- Evidence required
- Confirmation status

Future route:

```text
/gearboxes/?engine={engine-code}
```

### 3.7 VIN Matching

Purpose:

- Build trust and reduce quote errors.

Required copy:

- Ask buyer for VIN/chassis evidence when available.
- Do not expose full VIN publicly.
- Explain what AsiaPower checks:
  - model year
  - engine code
  - gearbox
  - drivetrain
  - market version

### 3.8 Inspection Process

Purpose:

- Explain AsiaPower's quality gate before quote/payment.

Steps:

1. Confirm engine code and donor vehicle.
2. Confirm stock source and status.
3. Request photos or video where available.
4. Check included accessories.
5. Confirm gearbox and ECU/harness if required.
6. Confirm EXW/CIF quote.
7. Confirm packing and shipping plan.

### 3.9 Export Process

Purpose:

- Rank for export terms and reassure buyers.

Required elements:

- EXW and CIF support.
- Destination port capture.
- Packing and loading confirmation.
- Ghana / Africa / Middle East buyer language where relevant.
- No guarantee of stock until APInventory confirms.

### 3.10 FAQ

Purpose:

- Improve long-tail ranking.
- Support FAQPage schema.

Required FAQ types:

- Compatibility.
- Engine-only vs half-cut.
- Gearbox matching.
- VIN/chassis evidence.
- Quote requirements.
- Export shipping.

### 3.11 Buyer Guide

Purpose:

- Move page from thin content to expert buying guide.

Required topics:

- What to send before quote.
- How to compare supplier offers.
- How to avoid wrong engine code.
- How to decide buying format.
- What AsiaPower verifies before formal quote.

### 3.12 Related Engines

Purpose:

- Build internal link graph.
- Offer buyer alternatives.

Relationship labels:

- Same family.
- Same brand.
- Common buyer alternative.
- Same vehicle platform.
- Same displacement class.

### 3.13 Related Half-Cuts

Purpose:

- Connect SEO page to commercial inventory signals.

Rules:

- Do not claim live stock unless verified.
- Display "Needs confirmation" by default.
- Never expose supplier private data.
- Never expose full VIN.

### 3.14 Inquiry CTA

Purpose:

- Capture structured inquiry.

Fields:

- Name
- WhatsApp
- Email
- Destination country
- Destination port
- Vehicle model
- Year
- Gearbox
- Buying format
- Message

Hidden fields:

- engine code
- source page
- product type

### 3.15 WhatsApp CTA

Purpose:

- Fastest conversion channel.

Prefill should include:

- Engine code
- Buying format
- Vehicle model
- Year
- Gearbox
- Destination port

### 3.16 Trust Section

Purpose:

- Explain why AsiaPower is different.

Trust points:

- China supply network.
- Ghana/Africa buyer support.
- Photo/video confirmation where available.
- EXW/CIF quotation workflow.
- Stock confirmation before quote.
- No unverified stock promise.

### 3.17 Structured Data Improvements

Required JSON-LD graph:

- `WebPage`
- `BreadcrumbList`
- `Product`
- `FAQPage`
- `ItemList` for related engines
- `ItemList` for related half-cuts
- `HowTo` for inspection/export process where appropriate

Rules:

- No fake price.
- No fake aggregate rating.
- No fake review.
- Availability must not imply confirmed stock.

### 3.18 Internal Link Strategy

Required internal links:

- Engine index.
- Brand pages.
- Related engine pages.
- Related half-cut detail pages.
- Gearbox category or future engine-filtered gearbox route.
- Contact/inquiry anchor.

Future reciprocal links:

- Half-cut detail page -> engine page.
- Brand page -> engine page.
- Gearbox page -> engine page.

### 3.19 Mobile-First UX

Rules:

- CTA visible above the fold on mobile.
- Sticky mobile action bar with WhatsApp and inquiry anchor.
- Tables scroll horizontally.
- Cards do not nest inside cards.
- Buttons must not overflow.
- Text must not overlap.
- Critical buyer proof checklist must be scannable.

### 3.20 Future Generator Compatibility

The template must map cleanly to structured data:

```text
engine.identity
engine.specifications
engine.applications
engine.failure_risks
engine.buying_formats
engine.gearboxes
engine.vin_matching
engine.inspection_steps
engine.export_process
engine.faq
engine.related_engines
engine.related_half_cuts
engine.cta
engine.references
```

Each generated value should carry:

- value
- source
- last_update
- confidence

## 4. Safety Rules

The V2 template must not:

- Claim unconfirmed stock.
- Publish supplier names.
- Publish supplier phone numbers.
- Publish private notes.
- Publish full VINs.
- Invent official specifications.
- Invent failure claims without verified source.
- Invent prices.
- Invent shipping time guarantees.

## 5. Success Criteria

The V2 template is successful if:

- Google can clearly understand the engine entity.
- Buyers can understand compatibility risk.
- Buyers can decide engine-only vs half-cut.
- Inquiry CTA appears early and late.
- WhatsApp CTA is specific to the engine.
- Related pages form a useful internal link graph.
- The page can be generated from structured records later.

## 6. V2 Flagship Example

The first V2 example page is:

```text
engines/g4kd-v2.html
```

This page is a designed template example only. It should not be deployed as a replacement for the current production `g4kd.html` until reviewed and approved.

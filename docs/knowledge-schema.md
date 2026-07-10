# Engine Knowledge Schema

Date: 2026-07-04

This document explains `knowledge/schema/engine.schema.json` and the sample record `knowledge/engines/g4kd.json`.

## Goal

AsiaPower needs engine knowledge pages that can serve SEO, sales, inventory, and supplier-review workflows without mixing verified facts with assumptions.

The schema is designed for one canonical engine record per engine code, such as `hyundai-g4kd`, `toyota-2az-fe`, or `nissan-hr16de`.

## Core Principle

Every knowledge field is an evidence field:

```json
{
  "value": "2.0L",
  "source": "engines/hyundai-g4kd.html; js/engine-directory.js",
  "last_update": "2026-07-04",
  "confidence": 1
}
```

This applies to basic parameters, applications, VIN evidence, official specs, repair information, FAQ answers, inventory, half-cuts, shipping, related products, SEO, and references.

## Why This Design

### 1. It prevents fake certainty

Some fields are known from the current repository, such as G4KD code, displacement, fuel type, public URL, and existing inventory references.

Other fields, such as official power, torque, bore, stroke, oil capacity, and service interval, require official manuals or manufacturer specs. If those sources are not present, the field remains:

```json
{
  "value": null,
  "source": "not_verified_yet",
  "last_update": "2026-07-04",
  "confidence": 0
}
```

That is intentional. Unknown is safer than invented.

### 2. It supports multiple business users

The same engine record can support:

- SEO landing pages
- APSales quote preparation
- APInventory supplier review
- VIN decode validation
- Blog planning
- Internal knowledge search
- Future structured data generation

### 3. It separates facts from presentation

The schema does not generate HTML. It only stores structured facts and source metadata. Website pages can later consume this data, but this task does not alter the website.

### 4. It allows confidence-based publishing

A future renderer can choose what to publish:

- `confidence >= 0.8`: safe for public page copy
- `0.5 <= confidence < 0.8`: safe for internal sales notes or cautious copy
- `confidence < 0.5`: keep internal or mark as needs verification

### 5. It preserves source traceability

Each field knows where it came from. This is important because AsiaPower has several data sources:

- Existing public pages
- JavaScript engine and brand directories
- Approved inventory snapshots
- QXB import outputs
- VIN decode cache
- Analytics reports
- Customer enquiries
- Future official manuals

## Schema Sections

| Section | Purpose |
|---|---|
| `basic` | Engine code, manufacturer, displacement, fuel type, origin and aliases |
| `applications` | Compatible models, years and fitment notes |
| `vin` | VIN decode sources, patterns, sample policy and VIN notes |
| `official_specs` | Power, torque, bore, stroke, compression, fluids and service intervals |
| `repair` | Common issues, inspection checklist, manuals and parts notes |
| `faq` | Question/answer pairs for SEO and sales enablement |
| `inventory` | Current inventory evidence and stock links |
| `half_cuts` | Half-cut availability and buyer notes |
| `shipping` | EXW/CIF, ports, packing, lead time and documents |
| `related_products` | Related engine, brand, half-cut or category pages |
| `seo` | Canonical URL, title, meta description, keywords, intent and internal links |
| `references` | Record-level bibliography with local files, reports, manuals or URLs |

## G4KD Sample Notes

The sample `knowledge/engines/g4kd.json` uses only repository-local evidence:

- Existing public page: `engines/hyundai-g4kd.html`
- Engine directory: `js/engine-directory.js`
- Brand/config references: `js/brand-catalog.js`, `js/config.js`
- Inventory snapshots: `work/half-cut-approved-prod.json`
- QXB import output: `reports/qxb-approved-import.json`
- Analytics evidence: `reports/analytics-top-pages.csv`

No web scraping was performed.

## VIN Policy

VIN is included because engine correctness often depends on VIN decode evidence. However, full VINs should not be exposed in public knowledge pages.

The schema supports:

- internal decode source names
- known patterns
- sample VIN list when safe
- notes explaining privacy/redaction policy

The G4KD example intentionally leaves `sample_vins.value` as an empty array and explains why.

## Future Use

This schema can later support:

- validation before publishing engine pages
- generated internal sales briefs
- structured FAQ blocks
- product schema generation
- inventory-to-knowledge synchronization
- confidence reports showing which engine pages need official manual verification

No website behavior is changed by this schema.

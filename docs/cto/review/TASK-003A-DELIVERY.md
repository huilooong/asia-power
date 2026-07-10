# TASK-003A Delivery Review

Delivery date: 2026-07-04

## 1. Files Delivered

### `engine.schema.json`

Purpose: AsiaPower engine knowledge canonical JSON Schema.

It defines the required structure for all future engine knowledge records, including basic parameters, applications, VIN evidence, official specs, repair information, FAQ, inventory, half-cuts, shipping, related products, SEO, and references.

Every knowledge-bearing field follows the same evidence format:

```json
{
  "value": "...",
  "source": "...",
  "last_update": "YYYY-MM-DD",
  "confidence": 0.0
}
```

### `g4kd.json`

Purpose: Example engine knowledge record for Hyundai/Kia G4KD.

It demonstrates how AsiaPower should fill an engine record using repository-local evidence only, including existing engine pages, JavaScript engine directories, inventory snapshots, QXB import outputs, analytics reports, and local buyer workflow references.

It deliberately leaves unverified official specifications as `null` with `confidence: 0`.

### `knowledge-schema.md`

Purpose: Human-readable explanation of the schema design.

It explains the evidence-field principle, why unknown data must remain explicit, how the schema supports SEO/sales/inventory/VIN workflows, and how confidence levels can control future publishing.

## 2. Field Count

`engine.schema.json` defines **61 named data fields** in the engine record model.

This count includes top-level sections and named nested engine-data properties:

- `schema_version`
- `engine_id`
- `basic` and its 9 fields
- `applications` and its 3 fields
- `vin` and its 4 fields
- `official_specs` and its 9 fields
- `repair` and its 4 fields
- `faq`
- `inventory` and its 2 fields
- `half_cuts` and its 3 fields
- `shipping` and its 5 fields
- `related_products`
- `seo` and its 8 fields
- `references`

Each knowledge field is additionally wrapped with four standard evidence attributes:

- `value`
- `source`
- `last_update`
- `confidence`

## 3. AsiaPower-Unique Fields

The following fields are specific to AsiaPower's business model, data sources, or operating workflow:

- `inventory.summary`
- `inventory.items`
- `half_cuts.availability`
- `half_cuts.items`
- `half_cuts.buyer_notes`
- `shipping.terms`
- `shipping.ports`
- `shipping.packing`
- `shipping.lead_time`
- `shipping.documents`
- `related_products`
- `seo.internal_links`
- `seo.search_intent`
- `vin.decode_sources`
- `vin.sample_vins`
- `vin.vin_notes`
- `repair.inspection_checklist`
- `repair.parts_notes`

Reason: these fields connect engine knowledge to AsiaPower's actual catalog, half-cut supply model, EXW/CIF export workflow, VIN privacy policy, supplier verification process, and SEO/sales conversion structure.

## 4. Fields From Public Or General Engine Knowledge

The following fields represent general engine knowledge that can be populated from manufacturer/service-manual/public technical sources when verified:

- `basic.engine_code`
- `basic.manufacturer`
- `basic.engine_family`
- `basic.displacement`
- `basic.fuel_type`
- `basic.aspiration`
- `basic.configuration`
- `basic.origin_market`
- `basic.aliases`
- `applications.models`
- `applications.years`
- `applications.notes`
- `official_specs.power`
- `official_specs.torque`
- `official_specs.bore`
- `official_specs.stroke`
- `official_specs.compression_ratio`
- `official_specs.oil_capacity`
- `official_specs.coolant_capacity`
- `official_specs.emissions`
- `official_specs.service_interval`
- `repair.common_issues`
- `repair.service_manuals`
- `faq`
- `seo.title`
- `seo.meta_description`
- `seo.primary_keyword`
- `seo.secondary_keywords`
- `seo.structured_data_type`
- `references`

Important: public knowledge is still not accepted blindly. It must carry `source`, `last_update`, and `confidence`.

## 5. Why The Schema Is Designed This Way

The schema is evidence-first because AsiaPower's engine pages must support both SEO and sales without inventing technical certainty.

The design solves five problems:

1. **Prevents hallucinated specifications**

   Official specs such as power, torque, bore, stroke, oil capacity, and service intervals require reliable sources. If no source exists, the value stays `null` with `confidence: 0`.

2. **Connects public pages to real inventory**

   Engine pages should not be generic blog pages. They need to connect to inventory, half-cut records, related products, shipping terms, and quote workflows.

3. **Supports VIN-driven verification**

   Engine fitment often depends on VIN decode evidence. The schema includes VIN fields while preserving the rule that full VINs should not be exposed publicly.

4. **Supports multiple teams**

   The same record can serve SEO, APSales, APInventory, supplier review, quote preparation, and future structured-data rendering.

5. **Enables confidence-based publishing**

   Future tooling can publish only high-confidence fields, use medium-confidence fields for internal sales notes, and flag low-confidence fields for verification.

No HTML was generated. No web scraping was performed. No website code was changed.

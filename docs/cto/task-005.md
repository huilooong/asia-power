# TASK-005 - AsiaPower Engine Growth Engine V1

Date: 2026-07-05

Scope: architecture design only. This document does not create code, modify website pages, run imports, call external APIs, or publish content.

## Goal

AsiaPower Engine Growth Engine V1 turns every new engine code into a reusable knowledge asset and, after verification, a future Google organic traffic entry.

Core principle:

> Every new Engine Code entering AsiaPower must follow one generic pipeline: detect, normalize, check knowledge, create or update knowledge, connect inventory, generate page, publish to sitemap/internal links, and wait for Google discovery.

The generator must not hard-code `G4KD`, `G4NA`, `2AZ-FE`, or any other engine code. Engine codes are data, not code branches.

## 1. Overall Architecture

### 1.1 Source Layer

Supported input sources:

- Supplier Website Upload
- APInventory / 子龙 Assisted Upload
- Supply Intelligence
- VIN Decode
- Excel Import
- API Import, future

Each source may produce one or more engine-code signals.

Examples:

- A supplier uploads a Hyundai ix35 half-cut with engine code `G4KD`.
- 子龙 structures a WeChat supplier photo batch and extracts `G4NA`.
- VIN decode identifies an engine code from a customer or supplier VIN.
- Excel import includes rows for `2AZ-FE`, `MR20DE`, and `OM651.940`.
- Future API import sends a normalized `engine_code` field.

### 1.2 Engine Code Detection Layer

This layer detects candidate engine codes from incoming records.

Inputs:

- explicit `engine_code` field,
- supplier title,
- product description,
- VIN decode output,
- OCR or structured assisted-upload data,
- Excel column mapping,
- API payload.

Required behavior:

- Extract candidate code.
- Normalize for lookup.
- Preserve original display value.
- Store source evidence.
- Assign confidence.
- Never assume brand ownership from code alone.

Identity rules:

- `knowledge_id`: internal stable key, for example `engine:g4kd`.
- `engine_code`: real-world engine code, for example `G4KD`.
- `slug`: public URL field, for example `hyundai-kia-g4kd-engine` or `g4kd-engine`.
- `manufacturer` / `brand`: stored in dedicated fields, not mixed into identity.

### 1.3 Knowledge Existence Check

After detection, the system checks whether a knowledge record exists.

Lookup order:

1. Exact `knowledge_id`.
2. Normalized `engine_code`.
3. Known aliases.
4. Existing slug map.
5. Manual review queue when ambiguous.

Examples of ambiguity:

- `EA888` without generation.
- `OM651` without variant.
- supplier typo such as `G4K D`.
- buyer shorthand such as `2AZ` where `2AZ-FE` and variants may exist.

Ambiguous records should not auto-publish. They should enter a review queue.

### 1.4 If Knowledge Does Not Exist

The pipeline creates a new knowledge record.

Minimum record:

- `knowledge_id`
- `engine_code`
- `slug`
- `basic`
- `applications`
- `vin`
- `official_specs`
- `repair`
- `faq`
- `inventory`
- `half_cuts`
- `shipping`
- `related_products`
- `seo`
- `references`

Every field must follow the evidence-field pattern:

```json
{
  "value": "G4KD",
  "source": "supplier_upload:record_id",
  "last_update": "2026-07-05",
  "confidence": 0.9
}
```

Unknown fields remain explicit:

```json
{
  "value": null,
  "source": "not_verified_yet",
  "last_update": "2026-07-05",
  "confidence": 0
}
```

### 1.5 Public Knowledge Enrichment

AI may enrich the new knowledge record only with verifiable public sources.

Rules:

- No unsourced facts.
- No memory-only engine specs.
- No full VIN exposure.
- No private supplier chat content on public pages.
- Public sources must be stored in `references`.
- Official specs require manufacturer manual, official documentation, or another trusted reference.
- Low-confidence data can support internal review but must not become public certainty.

Recommended confidence gates:

- `>= 0.8`: can be used in public page copy.
- `0.5 - 0.79`: internal sales or cautious review copy.
- `< 0.5`: keep internal or mark as needs verification.

### 1.6 Engine Page Factory

After the knowledge record passes validation, Engine Page Factory renders a static or deployable engine page.

Required sections:

- H1
- SEO title
- Meta description
- Breadcrumb
- JSON-LD
- Engine Overview
- Applications
- Specifications
- Compatible Models
- FAQ
- Related Engines
- Related Half Cuts
- WhatsApp CTA
- Inquiry Form
- References

The factory must be template-based:

```text
knowledge/engines/{record}.json
  -> validate schema
  -> select publishable fields
  -> render engine page template
  -> write public page
  -> update sitemap candidate list
  -> update internal-link candidate list
```

The generator must not contain per-engine conditional branches.

Bad:

```text
if engine_code == "G4KD": render special page
```

Good:

```text
for each valid engine knowledge record: render same template with record data
```

### 1.7 Sitemap And Internal Linking

After page generation, the page becomes discoverable.

Sitemap actions:

- Add canonical engine URL.
- Include `lastmod` from knowledge record or page generation date.
- Exclude draft, ambiguous, or internal-only pages.

Internal-link actions:

- Link from engine catalog.
- Link from brand pages when manufacturer/brand confidence is high.
- Link from related half-cut pages when inventory is Verified.
- Link from related engine pages.
- Link from FAQ or blog pages when contextually relevant.

Do not link Supply Intelligence directly to public pages.

### 1.8 Google Organic Entry

Once published and linked:

1. Google discovers the sitemap URL or internal link.
2. Page is crawled.
3. Structured data supports understanding.
4. Search impressions begin.
5. Customer inquiries can arrive through the page.
6. APSales converts the inquiry using Verified Inventory or APInventory sourcing.

The engine page becomes an organic entry only when it is discoverable, indexable, internally linked, and backed by useful knowledge.

## 2. Update Path When Knowledge Already Exists

If the knowledge record exists, the pipeline must not create a duplicate page.

Instead, it updates the existing record:

1. Update inventory references.
2. Update `last_update`.
3. Update related inventory.
4. Update related half-cuts.
5. Update FAQ only when the new source adds useful buyer knowledge.
6. Update JSON-LD source data.
7. Re-render the page if public fields changed.
8. Refresh sitemap `lastmod`.

Important:

- Verified Inventory can appear publicly.
- Assisted Inventory can update internal knowledge and review queues, but not public stock claims.
- Supply Intelligence can improve sourcing intelligence, but must not become public page copy.

## 3. Source-Specific Handling

### Supplier Website Upload

Primary role:

- Create or update Verified Inventory after approval.
- Detect engine code from supplier-submitted structured fields.
- Attach photos, model, year, VIN evidence, and stock status.

Growth impact:

- New engine code can trigger new knowledge record.
- Verified item can link to engine page.
- Engine page can link back to verified public stock.

### APInventory / 子龙 Assisted Upload

Primary role:

- Convert supplier messages, photos, Excel files, and informal data into structured Assisted Inventory.
- Extract possible engine codes.
- Request supplier confirmation.
- Upgrade Assisted Inventory to Verified Inventory.

Growth impact:

- Creates new engine-code signals before suppliers use the website.
- Feeds knowledge creation without exposing unconfirmed stock publicly.

### Supply Intelligence

Primary role:

- Internal sourcing clues.
- Supplier capability mapping.
- “Who may have this engine?” search.

Growth impact:

- Can reveal demand/supply clusters.
- Can prioritize which engine knowledge pages should be enriched.

Restriction:

- Must never directly generate public stock claims.
- Must never be written into public engine pages as availability.

### VIN Decode

Primary role:

- Confirm likely engine code from VIN evidence.
- Improve fitment confidence.
- Support APSales and APInventory matching.

Growth impact:

- Detects engine codes from customer inquiries and supplier records.
- Helps avoid wrong engine-page mapping.

Restriction:

- Public pages should not expose full VINs.

### Excel Import

Primary role:

- Batch import supplier or internal inventory lists.
- Detect multiple engine codes at once.
- Queue ambiguous rows for review.

Growth impact:

- Rapidly expands the engine knowledge backlog.
- Can identify missing pages by frequency.

### Future API Import

Primary role:

- Receive structured inventory or supplier records from external systems.
- Enforce the same engine-code detection and knowledge lookup pipeline.

Growth impact:

- Scales the system without adding new one-off workflows.

## 4. Future Extension Points

### 4.1 Generator

Future module:

```text
engine_growth_generator
```

Responsibilities:

- Load engine knowledge records.
- Validate schema.
- Render pages from one template.
- Generate JSON-LD.
- Produce sitemap entries.
- Produce internal-link candidates.
- Reject records that do not meet publishing rules.

### 4.2 Engine Code Registry

Future module:

```text
engine_code_registry
```

Responsibilities:

- Normalize engine codes.
- Maintain aliases.
- Map `engine_code` to `knowledge_id`.
- Detect duplicates.
- Flag ambiguous variants.

### 4.3 Knowledge Enrichment Queue

Future module:

```text
knowledge_enrichment_queue
```

Responsibilities:

- Track missing official specs.
- Track low-confidence applications.
- Track needed references.
- Queue AI research tasks.
- Require verifiable sources before publication.

### 4.4 Inventory-Knowledge Sync

Future module:

```text
inventory_knowledge_sync
```

Responsibilities:

- Connect Verified Inventory to knowledge records.
- Keep related half-cuts current.
- Remove sold or stale public stock links.
- Update `last_update`.

### 4.5 SEO Publishing Layer

Future module:

```text
seo_publish_queue
```

Responsibilities:

- Add generated pages to sitemap.
- Create internal-link recommendations.
- Track indexability.
- Track organic impressions and inquiries.
- Prevent draft or internal-only records from publishing.

### 4.6 Growth Feedback Loop

Future module:

```text
engine_growth_analytics
```

Responsibilities:

- Measure organic impressions.
- Measure clicks.
- Measure WhatsApp CTA clicks.
- Measure inquiry form submissions.
- Measure quote and close rate by engine code.
- Feed high-performing engine codes back into content planning.

## 5. Modules That Can Connect To 子龙 / APInventory

子龙 should connect to modules that manage supplier-side data, inventory truth, and sourcing intelligence.

Recommended integrations:

- Supplier Website Upload
- Assisted Upload review queue
- Excel Import
- Supply Intelligence
- VIN Decode
- Inventory-Knowledge Sync
- Engine Code Registry
- Knowledge Enrichment Queue
- Verified Inventory approval workflow
- Supplier confirmation workflow
- Media/photo evidence review

子龙 owns:

- supplier data structuring,
- supplier confirmation,
- source provenance,
- inventory source layer classification,
- Assisted Inventory to Verified Inventory conversion,
- Supply Intelligence follow-up.

子龙 should not own:

- customer pricing presentation,
- customer promise wording,
- final sales negotiation,
- public stock claims before verification.

## 6. Modules That Can Connect To 子敬 / APSales

子敬 should connect to modules that manage customer demand, quote preparation, and conversion.

Recommended integrations:

- Engine public pages
- Inquiry Form
- WhatsApp CTA
- Verified Inventory search
- VIN Decode for customer fitment checks
- Related Inventory lookup
- APSales lead inbox
- Quote preparation
- Engine Growth Analytics
- Customer demand signals

子敬 owns:

- customer response,
- quote workflow,
- customer experience,
- asking 子龙 to verify supply,
- matching inquiries to Verified Inventory,
- converting organic traffic into deals.

子敬 should not own:

- direct access to supplier chat groups,
- unverified supplier intelligence,
- inventory approval,
- supplier-side confirmation.

## 7. 子龙 And 子敬 Handoff

Recommended operating flow:

```text
Customer lands on Engine Page
  -> submits inquiry / clicks WhatsApp
  -> APSales / 子敬 receives lead
  -> searches Verified Inventory
  -> if found: quote
  -> if not found: request APInventory / 子龙 sourcing check
  -> 子龙 searches Assisted Inventory and Supply Intelligence
  -> 子龙 contacts supplier
  -> supplier confirms photos, VIN, price, status
  -> Assisted Inventory becomes Verified Inventory
  -> 子敬 sends formal quote
  -> deal closes
```

System boundary:

- 子敬 and 子龙 communicate through Inventory API and lead/inventory events.
- They should not share direct business logic.
- 子敬 sees customer-safe inventory status.
- 子龙 sees supplier-side evidence and source provenance.

## 8. Publishing Rules

An engine knowledge record can generate a public page when:

- engine code identity is clear,
- record validates against schema,
- SEO title and meta description exist,
- at least one reference exists,
- public copy does not depend on Supply Intelligence,
- page does not expose full VINs,
- stock language is confirmation-safe,
- JSON-LD can be generated from verified fields.

An engine knowledge record should stay internal when:

- engine code is ambiguous,
- manufacturer or family mapping is unclear,
- only Supply Intelligence exists,
- no public-safe references exist,
- stock status is unconfirmed but page copy would imply availability.

## 9. Growth Metrics

Engine Growth Engine V1 should eventually measure:

- new engine codes detected,
- new knowledge records created,
- records enriched with public references,
- pages generated,
- pages indexed,
- organic impressions by engine code,
- organic clicks by engine code,
- inquiry rate by engine page,
- Verified Inventory match rate,
- Assisted sourcing success rate,
- quote rate,
- closed-deal rate.

The business metric is not “number of engine pages.”

The business metric is:

```text
New Engine Code
-> Verified Knowledge
-> Published Engine Page
-> Google Entry
-> Customer Inquiry
-> Verified Inventory / Sourcing
-> Quotation
-> Closed Deal
```

## 10. CTO Recommendation

Build this in phases:

1. Engine Code Registry.
2. Knowledge existence check.
3. Knowledge record auto-create in draft status.
4. Engine Page Factory batch renderer.
5. Sitemap and internal-link candidate generator.
6. APInventory integration for inventory source updates.
7. APSales integration for inquiry and conversion feedback.
8. Growth analytics loop.

The first implementation should be conservative:

- draft by default,
- publish only after validation,
- no Supply Intelligence on public pages,
- no unverified stock claims,
- no engine-specific code paths.

That keeps AsiaPower from creating hundreds of thin or risky pages while still turning real operational data into durable SEO assets.

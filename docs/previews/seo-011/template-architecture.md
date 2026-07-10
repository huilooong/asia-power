# Engine Intelligence Template V2

## 1. Purpose

Engine Intelligence Template V2 is the standard architecture for every AsiaPower engine page.

Target scale:

```text
1000+ engine pages
```

Example engine codes:

```text
G4KD, G4KE, G4KJ, G4NA, 2TR-FE, 1KD-FTV, 2KD-FTV, QR25DE, MR20DE, K24A
```

The template is not just an SEO page. It is a structured buyer-intelligence page that connects Google search demand, engine knowledge, inventory signals, supplier verification, APSales conversion, APInventory sourcing, and future AI workflows.

Each page must answer three questions:

1. Can Google understand this engine entity clearly?
2. Can the buyer trust AsiaPower enough to inquire?
3. Can APSales and APInventory use the inquiry to move toward a quote?

## 2. Architecture Principles

### 2.1 One Engine Entity, One Canonical Page

Each real engine code should have one canonical Engine Intelligence page.

Preferred canonical pattern:

```text
/engines/{engine-code}.html
```

Why it exists:

- Prevents duplicate pages from competing.
- Concentrates internal links and Google ranking signals.
- Gives APSales and APInventory one stable URL to share.

Impact:

- Google Ranking: stronger canonical clarity.
- Buyer Trust: one authoritative AsiaPower page per engine.
- Inquiry Conversion: buyers do not land on split or outdated variants.

### 2.2 Separate Verified Facts From Unverified Signals

Every data point should be classified:

- verified
- repository signal
- supplier-confirmed
- buyer-provided
- not verified yet

Why it exists:

- Prevents fake official specs.
- Prevents unconfirmed stock claims.
- Makes the page trustworthy at scale.

Impact:

- Google Ranking: higher quality and lower thin-content risk.
- Buyer Trust: clear confidence labels.
- Inquiry Conversion: fewer disputes and wrong quotes.

### 2.3 Template First, Generator Later

The architecture must work before automation.

Why it exists:

- Prevents scaling weak pages.
- Lets AsiaPower define business logic before generator logic.
- Keeps future AI output inside clear page boundaries.

Impact:

- Google Ranking: repeatable page quality.
- Buyer Trust: consistent buying experience.
- Inquiry Conversion: consistent quote path.

## 3. SEO Layer

The SEO Layer tells Google what the page is, how it relates to the site, and why it should rank.

### 3.1 Metadata

Required fields:

- SEO title
- Meta description
- Open Graph title
- Open Graph description
- Open Graph image
- Twitter card
- Language metadata

Recommended title logic:

```text
{ENGINE_CODE} Engine for Sale | Half-Cuts, Gearboxes & Export Quote
```

Low-data sourcing page title:

```text
{ENGINE_CODE} Engine Sourcing | AsiaPower China Export Desk
```

Why it exists:

- Communicates search intent immediately.
- Differentiates engine-only, half-cut, gearbox, and export use cases.

Impact:

- Google Ranking: improves relevance for engine-code and buyer-intent searches.
- Buyer Trust: title matches buyer need.
- Inquiry Conversion: title pre-qualifies commercial buyers.

### 3.2 Canonical

Required:

- Self-canonical on the canonical engine page.
- Duplicate brand-prefixed or legacy pages must canonicalize to the engine-code page or redirect.

Why it exists:

- Prevents duplicate indexation.
- Consolidates ranking signals.

Impact:

- Google Ranking: avoids split authority.
- Buyer Trust: one authoritative page.
- Inquiry Conversion: one consistent sales path.

### 3.3 JSON-LD

Required schema graph:

- `WebPage`
- `BreadcrumbList`
- `Product`
- `FAQPage`
- `ItemList` for related engines
- `ItemList` for related vehicles where useful
- `ItemList` for related half-cuts where public-safe
- Optional `HowTo` for inspection/export process

Rules:

- No fake price.
- No fake review.
- No fake rating.
- No guaranteed availability unless verified.

Why it exists:

- Helps Google parse the page entity and page structure.
- Supports rich results where eligible.

Impact:

- Google Ranking: clearer structured understanding.
- Buyer Trust: schema matches visible content.
- Inquiry Conversion: product/inquiry page is easier to interpret.

### 3.4 FAQ

Required FAQ categories:

- Compatibility
- Engine-only vs half-cut
- Gearbox matching
- VIN/chassis evidence
- Quote requirements
- Export process
- Stock confirmation

Why it exists:

- Captures long-tail buyer questions.
- Builds trust before contact.
- Supports FAQ schema.

Impact:

- Google Ranking: long-tail search coverage.
- Buyer Trust: reduces uncertainty.
- Inquiry Conversion: prepares buyer to send useful details.

### 3.5 Internal Linking

Required links:

- Engine index
- Brand page
- Related engine pages
- Related vehicle/model pages
- Related half-cut detail pages
- Gearbox category or filtered gearbox route
- Inquiry anchor

Why it exists:

- Creates crawl paths.
- Builds topical authority.
- Moves buyers from knowledge to inventory and quote.

Impact:

- Google Ranking: better crawlability and link equity.
- Buyer Trust: shows AsiaPower has depth.
- Inquiry Conversion: creates commercial next steps.

### 3.6 Related Engines

Relationship types:

- Same family
- Same brand
- Same displacement class
- Same vehicle platform
- Common buyer alternative
- Same export demand cluster

Why it exists:

- Helps users compare alternatives.
- Helps Google understand engine clusters.

Impact:

- Google Ranking: stronger entity graph.
- Buyer Trust: buyer sees options.
- Inquiry Conversion: saves inquiries that would otherwise dead-end.

### 3.7 Related Vehicles

Required fields:

- Brand
- Model
- Year signal
- Market/version caveat
- Fitment confidence

Why it exists:

- Buyers often search by vehicle, not only engine code.
- Vehicle compatibility is the main purchase risk.

Impact:

- Google Ranking: captures vehicle + engine searches.
- Buyer Trust: shows fitment discipline.
- Inquiry Conversion: prompts buyer to provide model/year.

## 4. Engine Intelligence Layer

The Engine Intelligence Layer turns a page from a generic landing page into a useful buying reference.

### 4.1 Engine Overview

Required:

- Engine code
- Manufacturer/brand signal
- Common applications
- Buying formats
- Availability confidence
- Export relevance

Why it exists:

- Gives buyers a fast understanding of the engine.
- Gives Google a clear entity summary.

Impact:

- Google Ranking: strong above-fold topical clarity.
- Buyer Trust: page looks specific, not generic.
- Inquiry Conversion: buyer knows they are in the right place.

### 4.2 Specifications

Required:

- Engine code
- Manufacturer/brand
- Displacement
- Fuel type
- Power/torque/bore/stroke when verified
- Source
- Confidence

Rules:

- Use `Not verified yet` for unverified official specs.
- Do not invent technical parameters.

Why it exists:

- Specs are high-intent search content.
- Buyers expect structured engine facts.

Impact:

- Google Ranking: engine-code relevance.
- Buyer Trust: transparent data confidence.
- Inquiry Conversion: reduces wrong expectations.

### 4.3 Vehicle Applications

Required:

- Brand
- Model
- Year signal
- Gearbox signal
- Market/version note
- Evidence needed

Why it exists:

- Compatibility drives engine purchase decisions.

Impact:

- Google Ranking: captures vehicle fitment queries.
- Buyer Trust: avoids overclaiming.
- Inquiry Conversion: buyer sends better fitment information.

### 4.4 Engine Variants

Required when data exists:

- Variant code
- Market/version
- Related models
- Known difference
- Confidence

Why it exists:

- Many engine families have confusing variants.
- Wrong variants cause failed quotes and returns.

Impact:

- Google Ranking: richer long-tail coverage.
- Buyer Trust: shows expertise.
- Inquiry Conversion: filters bad inquiries earlier.

### 4.5 OEM References

Required when verified:

- OEM number
- Part family
- Application
- Source
- Confidence

Rule:

- Do not invent OEM numbers.

Why it exists:

- OEM references help precise buyers and professional importers.

Impact:

- Google Ranking: captures part-number searches.
- Buyer Trust: supports professional sourcing.
- Inquiry Conversion: improves quote precision.

### 4.6 Common Problems

Required:

- Verified failure claims only when sources exist.
- Otherwise use "inspection risk area" language.

Categories:

- noise
- overheating
- oil contamination
- compression
- timing
- harness/ECU mismatch
- accessory mismatch

Why it exists:

- Buyers search for engine problems before buying used engines.
- Shows AsiaPower understands inspection risk.

Impact:

- Google Ranking: captures problem-based searches.
- Buyer Trust: transparent risk framing.
- Inquiry Conversion: motivates inspection-based inquiry.

### 4.7 Buying Guide

Required:

- What to send before quote.
- How to compare offers.
- How to decide buying format.
- What AsiaPower verifies before quote.

Why it exists:

- Converts search traffic into actionable sales context.

Impact:

- Google Ranking: depth and usefulness.
- Buyer Trust: expert guidance.
- Inquiry Conversion: higher-quality leads.

### 4.8 Compatibility

Required:

- Fitment confidence labels.
- Required evidence.
- Warnings about model/year/gearbox differences.

Why it exists:

- Fitment is the core buying risk.

Impact:

- Google Ranking: compatibility query coverage.
- Buyer Trust: avoids false certainty.
- Inquiry Conversion: reduces wrong-code inquiries.

### 4.9 Gearbox Matching

Required:

- Gearbox signal
- Transmission type
- Donor model
- Evidence needed
- Confirmation status

Why it exists:

- Many buyers need engine + gearbox or half-cut, not bare engine.

Impact:

- Google Ranking: engine + gearbox long-tail coverage.
- Buyer Trust: matching process feels professional.
- Inquiry Conversion: increases higher-value quote requests.

### 4.10 Half-Cut Availability

Required:

- Related half-cut records.
- Verification status.
- Public-safe stock signal.
- No supplier private data.
- No full VIN.

Why it exists:

- Half-cuts are high-value inventory and often solve fitment risk.

Impact:

- Google Ranking: connects engine and half-cut intent.
- Buyer Trust: clear stock-confirmation boundary.
- Inquiry Conversion: higher-ticket inquiries.

## 5. Trust Layer

The Trust Layer explains how AsiaPower protects buyers before quote and export.

### 5.1 Inspection Process

Required steps:

1. Confirm engine code and vehicle.
2. Confirm current supply.
3. Request photos/video where available.
4. Confirm included parts.
5. Confirm gearbox/ECU/harness needs.
6. Confirm quote basis.

Why it exists:

- Buyers need proof before paying.

Impact:

- Google Ranking: improves page usefulness.
- Buyer Trust: makes process concrete.
- Inquiry Conversion: reduces hesitation.

### 5.2 Export Process

Required:

- EXW explanation.
- CIF explanation.
- Destination port capture.
- Packing assumptions.
- Loading/shipping confirmation.

Why it exists:

- AsiaPower buyers are export buyers, not local retail buyers only.

Impact:

- Google Ranking: captures export intent.
- Buyer Trust: shows cross-border competence.
- Inquiry Conversion: buyer sends port early.

### 5.3 Quality Control

Required:

- Photo request.
- Video request where available.
- Accessory checklist.
- Engine-code evidence.
- Condition statement.

Why it exists:

- Used engines require verification before quote.

Impact:

- Google Ranking: expert content quality.
- Buyer Trust: visible quality gate.
- Inquiry Conversion: less fear of bad stock.

### 5.4 Supplier Verification

Required:

- Explain that APInventory verifies supply.
- Do not expose supplier names or phone numbers.
- Explain stock signal vs verified inventory.

Why it exists:

- Builds trust while protecting supplier privacy.

Impact:

- Google Ranking: unique AsiaPower operating model.
- Buyer Trust: clear sourcing process.
- Inquiry Conversion: buyers understand why quote needs confirmation.

### 5.5 Warranty

Required:

- State warranty or after-sales terms only if verified by business policy.
- If no universal warranty exists, say terms depend on confirmed supplier/order conditions.

Why it exists:

- Warranty is high-conversion but high-risk.

Impact:

- Google Ranking: buyer decision content.
- Buyer Trust: avoids misleading promises.
- Inquiry Conversion: sets correct expectations.

### 5.6 Frequently Asked Questions

Required:

- Buyer-facing FAQs.
- Schema alignment.
- No hidden FAQ not visible on page.

Why it exists:

- FAQ reduces anxiety and improves long-tail coverage.

Impact:

- Google Ranking: FAQ/entity expansion.
- Buyer Trust: answers objections.
- Inquiry Conversion: fewer vague inquiries.

## 6. Conversion Layer

The Conversion Layer turns traffic into structured buyer requests.

### 6.1 Quote CTA

Required:

- Above-fold quote CTA.
- Mid-page quote CTA after buyer guide.
- Bottom inquiry form.

Why it exists:

- Buyers arrive at different readiness levels.

Impact:

- Google Ranking: better engagement signals.
- Buyer Trust: clear next step.
- Inquiry Conversion: captures ready buyers.

### 6.2 WhatsApp CTA

Required prefill:

- engine code
- model/year
- gearbox
- destination port
- buying format

Why it exists:

- WhatsApp is the fastest buyer channel.

Impact:

- Google Ranking: indirect engagement benefit.
- Buyer Trust: familiar communication path.
- Inquiry Conversion: lower friction.

### 6.3 Inquiry Form

Required fields:

- name
- WhatsApp
- email
- destination country
- destination port
- vehicle model/year
- gearbox
- buying format
- quantity
- message

Hidden fields:

- engine code
- page URL
- product type
- source campaign if available

Why it exists:

- Converts buyer interest into APSales-ready data.

Impact:

- Google Ranking: not direct, but improves commercial page value.
- Buyer Trust: professional request process.
- Inquiry Conversion: higher lead quality.

### 6.4 Sticky Mobile CTA

Required:

- WhatsApp button.
- Inquiry anchor.

Why it exists:

- Most buyers may browse on mobile.

Impact:

- Google Ranking: better mobile engagement.
- Buyer Trust: easy access.
- Inquiry Conversion: reduces friction.

### 6.5 Buyer Journey

Required journey:

```text
Search -> Engine page -> Fitment confidence -> Buying format -> Inspection trust -> Inquiry -> APSales -> APInventory -> Quote
```

Why it exists:

- Connects SEO page to actual business workflow.

Impact:

- Google Ranking: better user satisfaction.
- Buyer Trust: transparent process.
- Inquiry Conversion: structured commercial path.

## 7. AI Layer

The AI Layer is reserved for future intelligence integration. These modules should be designed now but not hard-dependent on AI.

### 7.1 APSales

Future role:

- Read page inquiry context.
- Classify buyer intent.
- Prepare response.
- Ask missing questions.

Page requirement:

- Preserve engine code, page URL, buying format, destination port and buyer message in the inquiry payload.

### 7.2 APInventory

Future role:

- Check verified inventory.
- Check assisted inventory.
- Check supply intelligence.
- Confirm stock, photos, price and included parts.

Page requirement:

- Do not claim stock before APInventory confirmation.

### 7.3 Knowledge Graph

Future role:

- Maintain engine relationships.
- Connect engines, vehicles, gearboxes, OEM references, half-cuts and FAQs.

Page requirement:

- Every section should map to structured data fields.

### 7.4 Supplier Agent

Future role:

- Contact suppliers.
- Request photos and conditions.
- Convert supply intelligence into assisted/verified inventory.

Page requirement:

- Keep supplier data private.
- Show only public-safe confirmation status.

### 7.5 AI Quote

Future role:

- Draft quote based on confirmed inventory, buyer port and buying format.

Page requirement:

- Capture quote inputs cleanly.

### 7.6 VIN Decoder

Future role:

- Decode VIN/chassis evidence.
- Match model, year, engine code and gearbox.

Page requirement:

- Ask for VIN privately.
- Never expose full VIN publicly.

### 7.7 Engine Recommendation

Future role:

- Recommend substitute engines, half-cuts or gearbox packages when the requested engine is unavailable.

Page requirement:

- Maintain related engine and related vehicle slots.

## 8. Future Expansion

### 8.1 Multiple Languages

Template must support:

- English
- Chinese
- French
- Arabic
- future market languages

Requirements:

- language-specific metadata
- hreflang
- translated FAQs
- translated CTA labels
- market-appropriate export terms

### 8.2 Dynamic Inventory

Template must support:

- verified inventory
- assisted inventory
- inventory signal only
- no public stock

Rules:

- Only verified inventory may be publicly presented as sellable stock.
- Assisted inventory requires confirmation.
- Supply intelligence remains internal.

### 8.3 Dynamic FAQ

Template must support:

- engine-family FAQs
- market FAQs
- buyer-intent FAQs
- inventory-status FAQs
- AI-generated FAQ drafts with review

Rules:

- FAQ schema must match visible FAQ content.

### 8.4 Dynamic Schema

Template must support:

- richer Product schema when data is verified
- conditional ItemLists
- conditional HowTo
- multilingual schema

Rules:

- No fake price, rating, review or stock availability.

### 8.5 AI-Generated Summaries

Template must support:

- buyer summary
- compatibility summary
- inspection summary
- quote-readiness summary

Rules:

- AI summaries must cite structured fields.
- AI must not invent official specs or confirmed stock.

## 9. Page Section Order

Recommended standard order:

1. Hero
2. Quick quote checklist
3. Compatible models
4. Specifications
5. Common problems / inspection risk
6. Engine vs half-cut recommendation
7. Gearbox matching
8. VIN matching
9. Inspection process
10. Export process
11. Buyer guide
12. FAQ
13. Related engines
14. Related vehicles
15. Related half-cuts
16. Trust section
17. Inquiry form
18. Sticky mobile CTA

Why this order exists:

- Starts with search intent.
- Moves into fitment and proof.
- Explains buying decision.
- Builds trust.
- Ends with conversion.

## 10. Template Data Contract

Every engine page should eventually map to:

```text
identity
metadata
canonical
brands
specifications
applications
variants
oem_references
common_problems
compatibility
gearboxes
half_cuts
inspection_process
export_process
trust
faq
related_engines
related_vehicles
related_half_cuts
cta
schema
references
ai_reserved
```

Each field should support:

```text
value
source
last_update
confidence
visibility
```

Visibility values:

- public
- internal
- private
- not_public_until_verified

## 11. Safety Rules

The standard template must never:

- publish supplier names
- publish supplier phone numbers
- publish private notes
- publish full VINs
- invent official specifications
- invent OEM references
- invent prices
- claim stock unless verified
- claim universal compatibility
- claim warranty unless policy is verified

## 12. Production Readiness Criteria

A page is production-ready when:

- metadata is production-specific
- canonical is correct
- JSON-LD parses
- FAQ schema matches visible FAQ
- internal links are real
- no placeholder links remain
- all unverified specs are labeled
- no supplier/private data is exposed
- CTA routes into production inquiry flow
- WhatsApp message is engine-specific
- mobile CTA does not block content
- page passes desktop/tablet/mobile visual QA

## 13. Final Recommendation

AsiaPower should standardize all future engine pages on Engine Intelligence Template V2.

The next implementation step should not be generating 1000 pages immediately. The next step should be:

```text
Build one production-ready canonical G4KD page from this architecture,
validate it,
then update the generator to produce the same structure at scale.
```

This avoids scaling design debt and ensures every future engine page supports Google ranking, buyer trust and inquiry conversion from the same architecture.

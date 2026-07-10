# APCGO Architecture Audit

## Scope

This audit reviews whether AsiaPower has already defined the following architecture concepts before any new APCGO architecture is designed:

- Knowledge Graph
- Unified Memory
- Single Source of Truth
- Event Architecture
- Identity Service
- Opportunity Database
- Shared Data Model

This is an audit only.

No code was written.
No runtime was modified.
APCORE was not redesigned.
APSales was not modified.
APCGO v1 architecture remains frozen.

## 1. Existing Architecture Already Available

### 1.1 Knowledge Graph

Status:

```text
Exists as Engine Knowledge / Knowledge Graph foundation.
```

Existing documents:

- `docs/knowledge-schema.md`
- `docs/knowledge-identity-design.md`
- `knowledge/schema/engine.schema.json`
- `knowledge/engines/g4kd.json`
- `docs/cto/task-005.md`
- `docs/cto/apsales/apsales-100-sales-intelligence.md`

What already exists:

- Engine knowledge records are structured under `knowledge/engines/*.json`.
- Every field supports source, last update, and confidence.
- Engine identity is defined through `knowledge_id`, `engine_code`, `slug`, manufacturer, aliases, family, variant, and generation.
- APSales Sales Intelligence already treats Knowledge Graph / Engine Records as a reusable system input.

Conclusion:

APCGO must reuse the existing Engine Knowledge Graph. It should not create a separate growth knowledge graph.

### 1.2 Unified Memory

Status:

```text
Partially exists as APSales Runtime MemoryStore and workspace memory conventions.
```

Existing documents:

- `docs/cto/apsales-runtime-v1.md`
- `docs/architecture/architecture-overview.md`
- `docs/cto/apsales/apsales-100-sales-intelligence.md`

What already exists:

- APSales Runtime v1 defines persistent memory scopes:
  - customer
  - conversation
  - supplier
  - learning
- Existing project state is spread across `data/`, `memory/`, `reports/`, `work/`, and `audit/`.
- Architecture audit already notes that some integrations write operational state into `memory/`, which blurs memory and runtime state.

Conclusion:

AsiaPower has memory infrastructure but not a clean company-wide Unified Memory architecture. APCGO should integrate with existing MemoryStore patterns and avoid creating a separate APCGO memory silo.

### 1.3 Single Source of Truth

Status:

```text
Exists by domain, not globally.
```

Existing source-of-truth domains:

| Domain | Existing source of truth |
| --- | --- |
| Engine facts | `knowledge/engines/*.json` + `knowledge/schema/engine.schema.json` |
| Engine identity | `docs/knowledge-identity-design.md` |
| Inventory source layer | `docs/inventory-source-model.md` |
| Sales opportunities | `data/apsales/opportunities/OPP-*.json` as specified/implemented by APSALES-101 |
| Sales runtime events | `data/apsales_runtime/events.jsonl` |
| Sales decisions | `data/apsales_runtime/decisions.jsonl` and `data/apsales/decisions.jsonl` |
| Deployment config | Release Manager / deploy docs |

Conclusion:

There is no single global database, but there are domain-specific sources of truth. APCGO should not replace them. APCGO should reference the correct domain source depending on opportunity type.

### 1.4 Event Architecture

Status:

```text
Exists inside APSales Runtime v1.
```

Existing documents:

- `docs/cto/apsales-runtime-v1.md`
- `docs/cto/apsales-101-analysis.md`
- `docs/cto/apsales-101-implementation.md`
- `docs/cto/apsales-102-analysis.md`

What already exists:

- APSales Runtime v1 has Event Bus, Task Queue, Scheduler, MemoryStore, and Decision Log.
- Existing runtime events include:
  - `CustomerCreated`
  - `InquiryReceived`
  - `QuoteCreated`
  - `SupplierMatched`
  - `VINDecoded`
  - `InventoryUpdated`
  - `PaymentReceived`
  - `ShipmentCreated`
- APSALES-101 adds:
  - `OpportunityCreated`
  - `OpportunityUpdated`
- APSALES-102 defines a Runtime Publisher API pattern for external gateways to publish `InquiryReceived`.

Conclusion:

APCGO must not create a parallel event bus. If APCGO later needs events, it should extend or publish into the existing runtime/event architecture through approved interfaces.

### 1.5 Identity Service

Status:

```text
Partially exists as domain-specific identity rules, not as a central service.
```

Existing identity models:

| Domain | Existing identity |
| --- | --- |
| Engine knowledge | `knowledge_id`, `engine_code`, `slug`, aliases |
| Customer identity | APSALES-101 `customer_hash` strategy |
| Inquiry identity | APSALES-102 `inquiry_id` idempotency model |
| Sales opportunity | `OPP-{YYYYMMDD}-{channel}-{seq6}` |
| Engine opportunity ranking | engine code normalization and ranking identity |

Conclusion:

Identity is already defined in several domains, but there is no central Identity Service. APCGO should reuse existing IDs and only define APCGO-specific IDs when no domain identity exists.

### 1.6 Opportunity Database

Status:

```text
Exists for APSales commercial opportunities. APCGO-003 defines a growth opportunity layer that overlaps unless constrained.
```

Existing documents:

- `docs/cto/apsales/opportunity-model-v1.md`
- `docs/cto/apsales-101-analysis.md`
- `docs/cto/apsales-101-implementation.md`
- `docs/product/apcgo/apcgo-growth-database.md`
- `docs/product/apcgo/apcgo-opportunity-model.md`

What already exists in APSales:

- Every inquiry becomes an APSales Opportunity.
- Opportunities persist under `data/apsales/opportunities/`.
- Index persists under `data/apsales/opportunity_index.jsonl`.
- Opportunities link customer identity, demand, traffic attribution, inventory matches, quote state, timeline, and outcome.

What APCGO-003 adds:

- Pre-sales growth opportunities:
  - company
  - keyword
  - content idea
  - competitor gap
  - market signal
- Priority history.
- Human approval history.
- APSales handoff history.

Conclusion:

APCGO must not create a competing sales Opportunity Database. APCGO should own pre-sales Growth Opportunities only. Once a growth opportunity becomes a buyer inquiry or approved sales handoff, APSales Opportunity becomes the commercial source of truth.

### 1.7 Shared Data Model

Status:

```text
Partially exists through domain models, not as one formal shared data layer.
```

Existing shared models:

- Engine Knowledge Schema.
- Knowledge Identity Design.
- Inventory Source Model.
- APSales Opportunity Model.
- APSales Runtime Events.
- Engine Opportunity Ranking.
- APCGO Opportunity Model.

Conclusion:

AsiaPower has reusable domain models but not one global shared data model. APCGO should integrate by linking to existing domain IDs rather than redefining engine, inventory, customer, inquiry, or sales opportunity fields.

## 2. Reusable Components

APCGO should reuse the following components and concepts.

### Engine Knowledge

Reusable component:

```text
knowledge/engines/*.json
```

APCGO use:

- keyword opportunity enrichment
- engine content opportunity validation
- engine identity normalization
- internal links and content planning
- avoiding duplicate engine pages

APCGO must not:

- create a separate engine fact store
- invent official specifications
- bypass confidence/source fields

### Knowledge Identity

Reusable component:

```text
knowledge_id / engine_code / slug / aliases
```

APCGO use:

- normalize engine-related keywords
- connect content opportunities to canonical engine records
- avoid duplicate keyword/content opportunities for the same engine

### Inventory Source Model

Reusable component:

```text
Verified Inventory / Assisted Inventory / Supply Intelligence
```

APCGO use:

- evaluate supply fit
- prioritize engine and content opportunities
- pass demand signals to APInventory

APCGO must not:

- expose Supply Intelligence on public pages
- claim unverified stock
- quote from Assisted or Supply Intelligence layers

### APSales Opportunity System

Reusable component:

```text
data/apsales/opportunities/
```

APCGO use:

- link approved growth handoffs to sales opportunities
- read aggregated outcome feedback later
- attribute SEO/content sources to commercial results

APCGO must not:

- replace APSales Opportunity
- duplicate inquiry lifecycle
- own quotes, follow-up, or deal stages

### APSales Runtime Event Bus

Reusable component:

```text
APSales Runtime Event Bus
```

APCGO use:

- future approved handoff or attribution events
- later integration through approved publisher/facade patterns

APCGO must not:

- create a parallel Event Bus
- publish directly without approved interface
- change runtime event semantics

### MemoryStore

Reusable component:

```text
customer / conversation / supplier / learning memory scopes
```

APCGO use:

- consume approved aggregate insights
- write approved growth learning only if a future CTO-approved integration exists

APCGO must not:

- write private customer or supplier data into growth reports
- create a separate hidden memory system

## 3. Duplicate Concepts Found In APCGO

### 3.1 Opportunity Database

Duplicate risk:

APCGO-003 names a Growth Opportunity Database while APSales already has an Opportunity Database for commercial inquiries.

Resolution:

Rename the conceptual boundary, not necessarily the existing document filename:

```text
APCGO Growth Opportunity = pre-sales opportunity signal.
APSales Opportunity = customer/inquiry/deal object.
```

APCGO should link to APSales Opportunity after handoff, not duplicate it.

### 3.2 Opportunity Lifecycle

Duplicate risk:

APCGO-003 defines a lifecycle with `discovered`, `validated`, `ranked`, `recommended`, `approval_pending`, `approved`, `apsales_handoff`, and `outcome_recorded`.

APSales already defines customer lifecycle and pipeline stages for sales execution.

Resolution:

APCGO lifecycle should stop at:

```text
approved_for_handoff
```

After APSales accepts a handoff, commercial lifecycle belongs to APSales.

APCGO may retain a read-only outcome reference.

### 3.3 Identity Fields

Duplicate risk:

APCGO-003 proposes `opportunity_id` and `canonical_key` for all opportunities.

Existing architecture already defines:

- `knowledge_id`
- `engine_code`
- `slug`
- `customer_hash`
- `inquiry_id`
- `opportunity_id` for APSales

Resolution:

APCGO should use:

- `growth_opportunity_id` for APCGO-only records
- existing domain IDs for links
- `canonical_key` only for deduplication inside APCGO Growth Opportunities

Do not reuse APSales `opportunity_id` for non-sales growth signals.

### 3.4 Approval History

Duplicate risk:

APCGO-003 approval history overlaps with CEO Dashboard / runtime approval ideas.

Resolution:

APCGO approval history should record only approval of growth actions:

- approve APSales review
- approve content production
- approve social distribution
- approve further research

Quote approval, message approval, payment, and deal actions remain APSales/CEO Dashboard responsibilities.

### 3.5 Market / Engine Opportunity Ranking

Duplicate risk:

APCGO opportunity priority overlaps with `docs/engine-opportunity-ranking.md`.

Resolution:

APCGO should reuse Engine Opportunity Ranking for engine-page generation decisions.

APCGO scoring can rank cross-type opportunities, but engine-code page decisions should defer to the Engine Opportunity Ranking model.

## 4. Required Integrations

### 4.1 APCGO To Knowledge Graph

Integration:

```text
APCGO keyword/content opportunities -> knowledge_id / engine_code / slug
```

Required behavior:

- normalize engine codes through existing knowledge identity rules
- link content ideas to existing engine records
- create a review item when knowledge record is missing
- do not create a separate engine data model

### 4.2 APCGO To APSales Opportunity

Integration:

```text
APCGO approved company/lead signal -> APSales review -> APSales Opportunity if real inquiry exists
```

Required behavior:

- APCGO stores pre-sales growth context.
- Human approval is required before APSales action.
- APSales owns contact and conversion.
- If outreach produces an inquiry, APSales creates or updates the commercial Opportunity.
- APCGO stores the APSales `opportunity_id` as a link only.

### 4.3 APCGO To APSales Runtime Events

Integration:

```text
Future approved APCGO handoff events -> existing Runtime Publisher/Event Bus pattern
```

Required behavior:

- do not create a parallel event system
- do not directly mutate runtime queues
- use approved publisher/facade if a future task implements it

Possible future events should be CTO-reviewed before definition.

### 4.4 APCGO To APInventory

Integration:

```text
APCGO market/content demand signals -> APInventory sourcing focus
```

Required behavior:

- pass demand signals only
- do not claim supply
- do not expose Supply Intelligence publicly
- APInventory remains owner of supplier confirmation and inventory source layers

### 4.5 APCGO To Search / Analytics

Integration:

```text
APCGO content and keyword opportunities -> traffic attribution fields in APSales / analytics
```

Required behavior:

- reuse traffic fields from APSALES-101:
  - landing_page
  - referrer
  - UTM fields
  - engine_slug
  - entry_channel
- future Search Console data should enrich APCGO priority, not redefine the opportunity model

### 4.6 APCGO To Human Approval

Integration:

```text
APCGO recommended action -> human approval record -> allowed execution owner
```

Required behavior:

- approval attached to an action
- approval does not imply automatic execution
- external actions still require human/operator/APSales execution

## 5. Missing Components

Only missing pieces are listed here. This section does not redesign the foundation.

### 5.1 Central Identity Resolver

Missing:

There is no central service that maps:

- `knowledge_id`
- engine aliases
- company/domain identity
- customer_hash
- inquiry_id
- APSales opportunity_id
- APCGO growth_opportunity_id

Impact:

Without this, cross-agent joins may rely on ad hoc keys.

Recommendation:

Extend existing identity rules into a future lightweight identity registry. Do not redesign APCORE.

### 5.2 Growth Opportunity Storage Boundary

Missing:

APCGO-003 defines the product model, but the storage boundary is not yet chosen.

Impact:

There is risk of creating a parallel Opportunity Database if implementation starts without boundary rules.

Recommendation:

APCGO storage must be named and scoped as `GrowthOpportunity`, not `Opportunity`, and must link to APSales `Opportunity` after handoff.

### 5.3 Cross-Agent Approval Ledger

Missing:

Approval is defined in several places, but there is no shared approval ledger for growth, sales, content, deployment, and quote actions.

Impact:

Approval history may fragment across docs, runtime decisions, and human notes.

Recommendation:

Extend existing decision log / approval patterns later. Do not build a new APCGO-only approval system unless CTO approves it as temporary.

### 5.4 Shared Event Contract For Growth Signals

Missing:

The Event Bus exists for APSales runtime, but no approved APCGO growth signal events exist.

Impact:

Future APCGO automation could invent ad hoc event names.

Recommendation:

If events are needed later, define a small extension set through the existing Runtime/Event architecture. Do not create a new Event Architecture.

### 5.5 Company Identity Deduplication

Missing:

APCGO discovers companies, but AsiaPower does not yet have a canonical company identity model equivalent to engine `knowledge_id` or customer `customer_hash`.

Impact:

Lead/company deduplication will be weaker than engine or customer deduplication.

Recommendation:

Define a company identity rule later using normalized domain, company name, country, and city. Keep it inside GrowthOpportunity until approved as shared identity.

## 6. Recommendation: Reuse / Extend / New Module

### Final Recommendation

```text
EXTEND existing architecture.
Do not create a parallel APCGO architecture.
```

### Decision By Concept

| Concept | Recommendation | Reason |
| --- | --- | --- |
| Knowledge Graph | Reuse | Engine Knowledge Graph already exists. |
| Unified Memory | Extend | MemoryStore exists but is APSales-scoped and not fully unified. |
| Single Source of Truth | Reuse by domain | Engine, inventory, sales, and runtime sources already exist. |
| Event Architecture | Reuse / extend later | APSales Runtime Event Bus already exists. |
| Identity Service | Extend later | Domain identities exist; central resolver is missing. |
| Opportunity Database | Extend with boundary | APSales owns commercial Opportunity; APCGO owns pre-sales GrowthOpportunity. |
| Shared Data Model | Extend | Domain models exist; cross-agent links need formalization. |

## CTO Decision Needed

Before APCGO implementation planning, CTO should approve these boundary rules:

1. APCGO GrowthOpportunity is a pre-sales signal object, not a sales Opportunity.
2. APSales Opportunity remains the source of truth for inquiries, quotes, pipeline, and deals.
3. Engine-related APCGO records must link to `knowledge_id`, `engine_code`, and `slug`.
4. APCGO must not create a parallel Event Bus or MemoryStore.
5. Future automation should extend existing Runtime/Event/Memory patterns.

## Final Audit Result

Existing AsiaPower architecture already defines major foundations:

- Engine Knowledge Graph
- Engine identity
- APSales MemoryStore
- APSales Event Bus
- APSales Opportunity storage
- Inventory source layers
- Engine opportunity ranking

APCGO should integrate with these foundations.

Required direction:

```text
Reuse existing foundation.
Extend only the missing growth-signal layer.
Do not redesign APCORE.
Do not create parallel Opportunity, Memory, Event, or Knowledge systems.
```

Status:

```text
READY FOR CTO REVIEW
```

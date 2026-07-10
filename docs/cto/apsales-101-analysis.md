# APSALES-101 — Architecture Analysis (Revised)

**Task:** APSALES-101 — Opportunity Runtime Integration  
**Status:** Revised specification — **documentation only, pending re-implementation**  
**Date:** 2026-07-05  
**Supersedes:** Initial analysis referencing `services/` and `api/dashboard_provider.py`  
**Architecture Freeze:** APSALES-100 design docs remain authoritative

---

## Revision Summary (CTO Accepted with Changes)

| # | Required change | Revised design |
|---|-----------------|----------------|
| 1 | Dedicated domain module | `domain/opportunity/` (not `services/`) |
| 2 | Reusable analytics layer | `analytics/metrics/` (not `api/dashboard_provider.py`) |
| 3 | Expanded decision stub | `decision_id`, `opportunity_id`, `timestamp`, `status` + fields |
| 4 | Event bus | Add `OpportunityUpdated` alongside `OpportunityCreated` |
| 5 | Customer identity | Formal hashing strategy (§Customer Identity) |
| 6 | Traffic source metrics | SEO/traffic fields + analytics metrics (§Traffic Source) |
| 7 | Test plan | [apsales-101-test-plan.md](./apsales-101-test-plan.md) |

**Note:** A prototype commit (`75fd54ab`) used `services/` and `api/dashboard_provider.py`. The **approved architecture** below is what implementation must follow on the next pass. No further code changes until docs are signed off.

---

## Executive Summary

APSales Runtime v1 (`apsales_runtime/`) provides Event Bus, Task Queue, Scheduler, Memory scopes, and decision logging. Opportunity integrates as a **domain module** that subscribes to `InquiryReceived` without modifying Runtime internals beyond handler registration and two new event types.

Opportunity adapts to Runtime. Runtime does not adapt to Opportunity.

---

## How Does Inquiry Currently Enter Runtime?

| Path | Today | Reaches Runtime Event Bus? |
|------|-------|----------------------------|
| WhatsApp / gateway | `customer_gateway/gateway_readonly.py` → inbound files | **No** |
| Email | `customer_gateway/email_inbound.py` → `draft_queue.save_draft()` | **No** |
| Email webhook | `customer_gateway/email_webhook_handler.py` | **No** |
| APSales handler | `sales_core/apsales_handler.py` | **No** |
| Website leads | `/api/leads/*` (Node) | **No** — future publisher |
| Runtime service | `apsales_runtime/service.py` → `_wire_event_bus` | **Subscribes** |
| Tests | EventBus `publish(InquiryReceived)` | **Yes** |

**Conclusion:** Runtime handler is the integration point; gateway publishers remain APSALES-102.

---

## Which Module Receives Inquiry?

Inside `apsales_runtime/service.py` → `_wire_event_bus`:

1. `[EXISTING]` `on_inquiry` → `TaskQueue.enqueue("inquiry", payload)`
2. `[REVISED]` `on_inquiry` → `domain.opportunity.integration.handle_inquiry_received(event)`

Task Queue module unchanged.

---

## Where Is Draft Queue Generated?

| Module | Function |
|--------|----------|
| `customer_gateway/draft_queue.py` | `save_draft()` |
| `customer_gateway/email_inbound.py` | Email → draft |
| `sales_core/apsales_handler.py` | WhatsApp inbound draft |

Orthogonal to Opportunity in APSALES-101. Link `draft_ids[]` in APSALES-102+.

---

## Where Is CRM Stored?

| Artifact | Location |
|----------|----------|
| Customer markdown | `memory/customers/{slug}.md` via `tools/crm_tool.py` |
| Legacy pipeline | `memory/projects/sales_pipeline.md` |
| Gateway profiles | `memory/customer_gateway/customer_profiles/` |

**Do not modify** CRM in APSALES-101. Opportunity commercial state: `data/apsales/`.

---

## How Is Memory Connected?

| Layer | Path |
|-------|------|
| Runtime MemoryStore | `memory/*` scopes via `apsales_runtime/memory.py` |
| Opportunity storage | `data/apsales/opportunities/` + indexes |
| Customer identity hash | Stable key linking Opportunity ↔ future Customer Intelligence |

Low coupling: Memory module unchanged.

---

## Runtime Events (Revised)

### Existing (frozen names)

- `CustomerCreated`
- `InquiryReceived`
- `QuoteCreated`
- `QuoteApproved`
- `SupplierMatched`
- `VINDecoded`
- `InventoryUpdated`
- `PaymentReceived`
- `ShipmentCreated`

### APSALES-101 extensions (append only)

| Event | When emitted |
|-------|--------------|
| `OpportunityCreated` | New Opportunity record persisted |
| `OpportunityUpdated` | Merge, stage change, field update, timeline append |

Persisted to `data/apsales_runtime/events.jsonl` (Runtime) + referenced in Opportunity timeline.

**Not a Event Bus redesign** — two new enum entries + handlers.

---

## Customer Identity Hashing Strategy

### Purpose

Produce a **stable `customer_hash`** across channels (WhatsApp, email, web) for merge detection and Customer Intelligence without storing raw PII in indexes.

### Algorithm

```
customer_hash = SHA256(normalized_identity_key)[:16 hex]
```

### Identity key construction (priority order)

Build `normalized_identity_key` from the **first non-empty tier**:

| Tier | Fields (pipe-separated, lowercased, trimmed) | Example |
|------|-----------------------------------------------|---------|
| **T1 — Explicit** | Pre-supplied `customer_hash` in payload | Gateway already resolved |
| **T2 — Contact** | `email` **or** E.164 `phone` / `whatsapp` | `buyer@shop.ng` |
| **T3 — Channel handle** | `{channel}:{handle}` | `whatsapp:+233540911111` |
| **T4 — Fallback** | `{channel}:{customer_name}` | `email:unknown buyer` |

Normalization rules:

- Email: lowercase, strip whitespace
- Phone: digits only, optional leading `+`
- Names: lowercase, collapse whitespace
- Never hash empty T4 alone without `inquiry_id` — append `|inquiry_id:{uuid}` to avoid collisions

### Output storage

| Field | Location |
|-------|----------|
| `customer.customer_hash` | Opportunity JSON |
| `customer_hash` | `opportunity_index.jsonl` (denormalized) |
| Raw email/phone | Opportunity JSON only if present in inquiry payload — **not** in index |

### Merge rule (unchanged from APSALES-100)

Same `customer_hash` + same normalized `engine` + `outcome=open` + created within **7 days** → merge into existing Opportunity → emit `OpportunityUpdated`.

Module: `domain/opportunity/identity.py` → `compute_customer_hash(payload) -> str`

---

## Traffic Source Metrics (SEO Analytics Foundation)

Captured on Opportunity at creation/merge from inquiry payload:

| Field | Source | SEO use |
|-------|--------|---------|
| `traffic.landing_page` | URL path e.g. `/engines/hyundai-g4kd.html` | Engine page attribution |
| `traffic.referrer` | HTTP referrer or `document.referrer` | Inbound link analysis |
| `traffic.utm_source` | UTM param | Campaign tracking |
| `traffic.utm_medium` | UTM param | Channel type |
| `traffic.utm_campaign` | UTM param | Campaign name |
| `traffic.engine_slug` | Parsed from landing page | Knowledge graph tie-in |
| `traffic.entry_channel` | `organic` \| `direct` \| `social` \| `email` \| `paid` \| `unknown` | Funnel segmentation |

### Analytics metrics layer (reusable)

Module: `analytics/metrics/traffic_source.py`

| Metric ID | Definition |
|-----------|------------|
| `traffic.inquiries_by_landing_page` | Count open+closed opportunities grouped by `landing_page` |
| `traffic.inquiries_by_engine_slug` | Group by `engine_slug` |
| `traffic.inquiries_by_utm_campaign` | Group by `utm_campaign` |
| `traffic.organic_vs_paid_ratio` | Ratio by `entry_channel` |
| `traffic.landing_to_opportunity_rate` | Requires site analytics join (APSALES-110+) |

CEO Dashboard (APSALES-110) **consumes** these metrics — does not own them.

---

## Decision Stub (Revised Schema)

Placeholder until APSALES-102 Decision Engine. Stored at `opportunity.decision_recommendation` and append-only `data/apsales/decisions.jsonl`.

```json
{
  "decision_id": "DEC-20260705-a1b2c3",
  "opportunity_id": "OPP-20260705-WA-a3f2b1",
  "timestamp": "2026-07-05T05:23:00+00:00",
  "status": "pending",
  "decision": "pending",
  "confidence": 0,
  "reason": "waiting APSALES-102"
}
```

| Field | Rule |
|-------|------|
| `decision_id` | `DEC-{YYYYMMDD}-{6 hex}` |
| `opportunity_id` | Parent Opportunity |
| `timestamp` | ISO8601 UTC |
| `status` | `pending` \| `complete` \| `failed` (101: always `pending`) |
| `decision` | Business outcome label (101: `pending`) |
| `confidence` | 0.0–1.0 (101: 0) |
| `reason` | Human-readable blocker |

---

## Revised Module Layout

```
domain/
└── opportunity/
    ├── __init__.py
    ├── identity.py          # customer_hash strategy
    ├── models.py            # constants, stage enums
    ├── service.py           # create, update, merge, append_event, find, list_*
    ├── integration.py       # InquiryReceived handler
    └── decision_stub.py     # build_decision_stub(opportunity_id)

analytics/
├── __init__.py
├── provider.py              # compose metric bundles for consumers
└── metrics/
    ├── __init__.py
    ├── opportunity.py       # new_leads, qualified, quoted, won, lost, pending, urgent, expected_revenue
    └── traffic_source.py    # SEO / traffic metrics

data/apsales/
├── opportunities/OPP-*.json
├── opportunity_index.jsonl
└── decisions.jsonl          # decision stub audit trail
```

**Removed from approved design:** `services/opportunity_*`, `api/dashboard_provider.py`

---

## Best Integration Point

```
InquiryReceived
    │
    ├─► TaskQueue.enqueue("inquiry")          [existing]
    │
    └─► domain.opportunity.integration
            │
            ├─ identity.compute_customer_hash
            ├─ service.find_merge_candidate | create | merge
            ├─ decision_stub.build → decisions.jsonl
            ├─ service.append_event (timeline)
            ├─ index append (+ traffic fields)
            └─ EventBus.publish(OpportunityCreated | OpportunityUpdated)
```

---

## Modules Reusable Directly

| Module | Reuse |
|--------|-------|
| `apsales_runtime/events.py` | Extend event types only |
| `apsales_runtime/service.py` | Handler registration only |
| `apsales_runtime/task_queue.py` | Unchanged |
| `audit/logger.py` | Optional audit events |
| `docs/cto/apsales/opportunity-model-v1.md` | Schema authority |

---

## Modules That Must NOT Be Modified

| Module | Reason |
|--------|--------|
| `apsales_runtime/scheduler.py` | Freeze |
| `apsales_runtime/lifecycle.py` | Freeze |
| `apsales_runtime/worker.py` | Freeze |
| `tools/crm_tool.py` | CRM freeze |
| `customer_gateway/draft_queue.py` | Draft freeze |
| `sales_core/apsales_handler.py` | No prompt changes |
| `config/prompts.py` | Forbidden |

---

## Minimal Implementation Plan (Revised Phase 2)

| Action | Type |
|--------|------|
| Create `domain/opportunity/*` | New domain module |
| Create `analytics/metrics/*` + `analytics/provider.py` | New analytics layer |
| Extend `events.py` with `OpportunityCreated`, `OpportunityUpdated` | Extend |
| Register handler in `service.py` | Extend |
| Add `data/apsales/` to `.gitignore` | Config |
| Tests per [apsales-101-test-plan.md](./apsales-101-test-plan.md) | New |
| Migrate away from prototype `services/` paths | Refactor (next pass) |

**Not in scope:** Quotation, Decision Engine logic, Dashboard HTML, gateway publishers.

---

## Related

- Review: [apsales-101-review.md](./apsales-101-review.md)
- Test plan: [apsales-101-test-plan.md](./apsales-101-test-plan.md)
- Design freeze: [apsales/apsales-100-sales-intelligence.md](./apsales/apsales-100-sales-intelligence.md)

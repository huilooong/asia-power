# APSALES-101 — Implementation Report

**Task:** APSALES-101 — Opportunity Runtime Integration (Revised)  
**Status:** **Implemented**  
**Date:** 2026-07-05  
**Architecture reference:** [apsales-101-analysis.md](./apsales-101-analysis.md) (frozen)

---

## Executive Summary

APSALES-101 integrates the Opportunity domain module with APSales Runtime v1. When `InquiryReceived` fires on the Event Bus, the runtime enqueues the existing inquiry task **and** calls `domain.opportunity.integration.handle_inquiry_received()`. Opportunities are persisted under `data/apsales/`, indexed for analytics, and emit `OpportunityCreated` or `OpportunityUpdated`.

No changes were made to Scheduler, CRM, prompts, or Runtime core architecture beyond two new event types and handler wiring.

---

## Architecture Changes

| Area | Change | Scope |
|------|--------|-------|
| Domain module | New `domain/opportunity/` package | identity, models, service, integration, decision_stub |
| Analytics layer | New `analytics/metrics/` + `analytics/provider.py` | Read-only KPI queries |
| Runtime events | Added `OpportunityUpdated` | `apsales_runtime/events.py` |
| Runtime handler | Import path → `domain.opportunity.integration` | `apsales_runtime/service.py` |
| Deprecated prototype | Removed `services/opportunity_*`, `api/dashboard_provider.py` | Superseded by approved layout |

### Integration Flow (unchanged from approved spec)

```
InquiryReceived
  → TaskQueue.enqueue("inquiry")          [existing]
  → compute_customer_hash(payload)
  → find_merge_candidate | create | merge
  → decision stub + timeline + index row
  → OpportunityCreated | OpportunityUpdated
```

### Bug Fix During Implementation

`merge()` previously called `append_event()` (which saves + indexes) and then `_save()` again, producing duplicate index rows. Fixed by inlining the timeline append inside `merge()` with a single `_save()` — aligns with INT-OPP-006 (create = 1 index line, merge = 2 total).

---

## Modified / Added Files

### New

```
domain/
├── __init__.py
└── opportunity/
    ├── __init__.py
    ├── identity.py          # T1–T4 customer_hash strategy
    ├── models.py            # stage/outcome/channel constants
    ├── service.py           # CRUD, merge, index, traffic fields
    ├── integration.py       # InquiryReceived handler + event publish
    └── decision_stub.py     # DEC-* stub + decisions.jsonl

analytics/
├── __init__.py
├── provider.py              # get_dashboard_bundle(), pipeline + traffic
└── metrics/
    ├── __init__.py
    ├── opportunity.py       # sales pipeline KPIs
    └── traffic_source.py    # landing page, engine slug, organic/paid

tests/test_apsales_101_opportunity_integration.py   # 33 INT-* cases
```

### Modified

| File | Change |
|------|--------|
| `apsales_runtime/events.py` | `EVENT_OPPORTUNITY_UPDATED`; `ALL_EVENT_TYPES` count 11 |
| `apsales_runtime/service.py` | Wire `domain.opportunity.integration`; publish via `bus` directly |
| `tests/test_apsales_runtime_foundation.py` | Event count assertion 10 → 11 |

### Removed (prototype superseded)

| File | Reason |
|------|--------|
| `services/opportunity_service.py` | Migrated to `domain/opportunity/service.py` |
| `services/opportunity_integration.py` | Migrated to `domain/opportunity/integration.py` |
| `api/dashboard_provider.py` | Replaced by `analytics/provider.py` |
| `services/__init__.py`, `api/__init__.py` | Empty package stubs removed |
| `tests/test_apsales_101_opportunity.py` | Replaced by integration test suite |

### Unchanged (verified)

- `apsales_runtime/scheduler.py`, `task_queue.py`, `lifecycle.py`, `worker.py`
- `tools/crm_tool.py`, `config/prompts.py` (not touched)
- Gateway modules (no `InquiryReceived` publisher — APSALES-102)

---

## Storage Layout

| Artifact | Path |
|----------|------|
| Opportunity JSON | `data/apsales/opportunities/OPP-*.json` |
| Index (append-only) | `data/apsales/opportunity_index.jsonl` |
| Decision stubs | `data/apsales/decisions.jsonl` |

---

## Backward Compatibility

- Runtime `--once` healthcheck: **PASS** (exit 0)
- Opportunity handler wrapped in `try/except` — failure logs warning, queue still enqueues
- Removing `domain/opportunity/` does not break Runtime startup (import failure is caught at handler runtime)

---

## Related

- [apsales-101-test-plan.md](./apsales-101-test-plan.md)
- [apsales-101-validation.md](./apsales-101-validation.md)
- [apsales-101-review-final.md](./apsales-101-review-final.md)

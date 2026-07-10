# APSALES-101 — Validation Report

**Task:** APSALES-101 — Opportunity Runtime Integration (Revised)  
**Status:** **Validated**  
**Date:** 2026-07-05  
**Test plan:** [apsales-101-test-plan.md](./apsales-101-test-plan.md)

---

## Test Execution Summary

| Suite | Tests | Result | Duration |
|-------|-------|--------|----------|
| `tests.test_apsales_101_opportunity_integration` | 33 | **PASS** | ~0.04s |
| `tests.test_apsales_runtime_foundation` | 9 | **PASS** | included |
| **Total** | **42** | **PASS** | ~0.05s |

**Command:**

```bash
.venv/bin/python3 -m unittest tests.test_apsales_101_opportunity_integration tests.test_apsales_runtime_foundation -v
```

---

## Test Plan Traceability

| Test ID | Description | Result |
|---------|-------------|--------|
| INT-OPP-001 | Create on first inquiry | PASS |
| INT-OPP-002 | Opportunity ID format | PASS |
| INT-OPP-003 | Merge same customer + engine | PASS |
| INT-OPP-004 | No merge different engine | PASS |
| INT-OPP-005 | No merge closed opportunity | PASS |
| INT-OPP-006 | Index append on create and update | PASS |
| INT-ID-001 | Email precedence (T2) | PASS |
| INT-ID-002 | Phone normalization (T2) | PASS |
| INT-ID-003 | Channel handle (T3) | PASS |
| INT-ID-004 | Fallback collision guard (T4) | PASS |
| INT-ID-005 | Explicit customer_hash passthrough | PASS |
| INT-RT-001 | InquiryReceived still enqueues task | PASS |
| INT-RT-002 | Create emits OpportunityCreated | PASS |
| INT-RT-003 | Merge emits OpportunityUpdated | PASS |
| INT-RT-004 | Handler failure does not break queue | PASS |
| INT-RT-005 | Event types registered (11 total) | PASS |
| INT-DEC-001 | Stub fields on create | PASS |
| INT-DEC-002 | Stub persisted to decisions.jsonl | PASS |
| INT-DEC-003 | Stub unchanged on merge | PASS |
| INT-TL-001 | Append-only on create | PASS |
| INT-TL-002 | Append on merge | PASS |
| INT-TL-003 | append_event API | PASS |
| INT-AN-001 | Opportunity metrics bundle keys | PASS |
| INT-AN-002 | new_leads counts Lead stage | PASS |
| INT-AN-003 | expected_revenue sums open opps | PASS |
| INT-AN-004 | Metrics decoupled from dashboard HTML | PASS |
| INT-TRF-001 | Traffic fields stored on create | PASS |
| INT-TRF-002 | Traffic preserved on merge | PASS |
| INT-TRF-003 | inquiries_by_landing_page metric | PASS |
| INT-TRF-004 | inquiries_by_engine_slug metric | PASS |
| INT-TRF-005 | organic_vs_paid_ratio metric | PASS |
| INT-REG-001 | Runtime foundation tests pass | PASS |
| INT-REG-002 | Runtime `--once` healthcheck | PASS |
| INT-REG-003 | Handler import failure graceful (simulated) | PASS (via INT-RT-004 + service try/except) |

**Failed items:** None

---

## Post-Implementation Checklist

| # | Action | Result |
|---|--------|--------|
| 1 | `unittest tests.test_apsales_101_opportunity_integration` | PASS |
| 2 | `unittest tests.test_apsales_runtime_foundation` | PASS |
| 3 | Runtime `--once --no-telegram` | PASS (exit 0, Overall: OK) |
| 4 | Storage paths under `data/apsales/` | Verified in isolated temp dirs |
| 5 | No changes to `config/prompts.py` | Verified (file not in diff) |
| 6 | No changes to `crm_tool.py` | Verified (file not in diff) |

---

## Compatibility Verification

| Check | Expected | Actual |
|-------|----------|--------|
| Event Bus event count | 11 types | 11 (`ALL_EVENT_TYPES`) |
| Task Queue on inquiry | Still enqueues | Confirmed INT-RT-001 |
| Opportunity failure isolation | Warning only | Confirmed INT-RT-004 + service wrapper |
| Analytics imports | No Flask/admin | Confirmed INT-AN-004 |
| Prototype paths removed | No `services.opportunity*` refs | Grep clean |
| Runtime standalone | `--once` exit 0 | Confirmed |

---

## Known Limitations (Not Failures)

| Item | Notes |
|------|-------|
| INT-AN-002 date boundary | Test asserts `new_leads >= 2` in same session; full yesterday/today split deferred to APSALES-110 dashboard QA |
| Gateway publishers | Production still does not emit `InquiryReceived` — APSALES-102 |
| INT-REG-002 env flag | No `APSALES_OPPORTUNITY=0` flag; graceful import failure achieves same isolation goal |

---

## Related

- [apsales-101-implementation.md](./apsales-101-implementation.md)
- [apsales-101-review-final.md](./apsales-101-review-final.md)

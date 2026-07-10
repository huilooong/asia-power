# APSALES-101 — Integration Test Plan

**Task:** APSALES-101 — Opportunity Runtime Integration (Revised)  
**Status:** Test specification — **no code execution required for this document**  
**Date:** 2026-07-05  
**Architecture:** [apsales-101-analysis.md](./apsales-101-analysis.md)

---

## Purpose

Define integration test cases for the **revised** APSALES-101 implementation:

- `domain/opportunity/` domain module
- `analytics/metrics/` reusable metrics layer
- Expanded decision stub
- `OpportunityCreated` + `OpportunityUpdated` events
- Customer identity hashing
- Traffic source fields and metrics

---

## Test Environment

| Item | Value |
|------|-------|
| Python | `.venv/bin/python3` |
| Runner | `unittest` or `pytest` |
| Isolation | `domain.opportunity.service.reconfigure_storage(tmp_path)` |
| Runtime isolation | `apsales_runtime.paths.reconfigure_paths(tmp_path / "runtime")` |
| No network | All tests offline |
| No production data | Temp directories only |

Suggested file: `tests/test_apsales_101_opportunity_integration.py`

---

## Test Categories

| ID prefix | Category |
|-----------|----------|
| `INT-OPP` | Opportunity service + storage |
| `INT-ID` | Customer identity hashing |
| `INT-RT` | Runtime Event Bus integration |
| `INT-DEC` | Decision stub |
| `INT-TL` | Timeline append-only |
| `INT-AN` | Analytics metrics |
| `INT-TRF` | Traffic source |
| `INT-REG` | Regression / backward compatibility |

---

## INT-OPP — Opportunity Service

### INT-OPP-001 — Create on first inquiry

| Step | Action |
|------|--------|
| 1 | Call `integration.handle_inquiry_received({channel: whatsapp, customer_name: Kofi, engine: G4KD})` |
| 2 | Assert `action == created` |
| 3 | Assert file exists `data/apsales/opportunities/OPP-*.json` |
| 4 | Assert `sales_stage == Lead`, `pipeline_stage == Inquiry`, `outcome.result == open` |

**Expected:** One Opportunity, one index line.

---

### INT-OPP-002 — Opportunity ID format

| Step | Action |
|------|--------|
| 1 | Create with `channel=email` |
| 2 | Assert ID matches regex `^OPP-\d{8}-EM-[a-f0-9]{6}$` |

---

### INT-OPP-003 — Merge same customer + engine within 7 days

| Step | Action |
|------|--------|
| 1 | Create inquiry: email `a@test.com`, engine `2NZ-FE` |
| 2 | Second inquiry same email + engine, different message |
| 3 | Assert `action == merged` |
| 4 | Assert same `opportunity_id` |
| 5 | Assert exactly one JSON file for that ID |

---

### INT-OPP-004 — No merge different engine

| Step | Action |
|------|--------|
| 1 | Create inquiry engine `G4KD` for `a@test.com` |
| 2 | Create inquiry engine `2NZ-FE` for same email |
| 3 | Assert two distinct `opportunity_id` values |

---

### INT-OPP-005 — No merge closed opportunity

| Step | Action |
|------|--------|
| 1 | Create opportunity |
| 2 | Update `outcome.result = lost` |
| 3 | New inquiry same hash + engine |
| 4 | Assert `action == created` (new Opportunity) |

---

### INT-OPP-006 — Index append on create and update

| Step | Action |
|------|--------|
| 1 | Create opportunity → count index lines = 1 |
| 2 | Merge second inquiry → count index lines = 2 |
| 3 | Assert latest index row same `opportunity_id` with updated `updated_at` |

---

## INT-ID — Customer Identity Hashing

### INT-ID-001 — Tier T2 email precedence

| Payload A | `{email: Buyer@Test.COM, customer_name: X}` |
| Payload B | Same email, different name |

**Expected:** Same `customer_hash` for A and B.

---

### INT-ID-002 — Tier T2 phone normalization

| Input | `phone: +233 54 091 1111` and `phone: 233540911111` |

**Expected:** Same hash after digit normalization.

---

### INT-ID-003 — Tier T3 channel handle

| Input | `{channel: whatsapp, phone: +233540911111}` (no email) |

**Expected:** Stable hash; documented prefix `whatsapp:` in identity key.

---

### INT-ID-004 — Tier T4 fallback collision guard

| Input | `{channel: web, customer_name: unknown}` without email/phone |

**Expected:** Hash includes `inquiry_id` or event correlation to avoid mass merge.

---

### INT-ID-005 — Explicit customer_hash passthrough

| Input | `{customer_hash: precomputed-abc123}` |

**Expected:** Output hash equals `precomputed-abc123` (truncated to spec length if needed).

---

## INT-RT — Runtime Event Bus

### INT-RT-001 — InquiryReceived still enqueues task

| Step | Action |
|------|--------|
| 1 | Wire test bus with production handler pattern |
| 2 | Publish `InquiryReceived` |
| 3 | Assert Task Queue has one `inquiry` task |

**Expected:** Queue behavior unchanged.

---

### INT-RT-002 — Create emits OpportunityCreated

| Step | Action |
|------|--------|
| 1 | Subscribe spy to `OpportunityCreated` |
| 2 | Publish `InquiryReceived` with new customer |
| 3 | Assert spy called once; payload contains `opportunity_id` |

---

### INT-RT-003 — Merge emits OpportunityUpdated

| Step | Action |
|------|--------|
| 1 | Subscribe spy to `OpportunityUpdated` |
| 2 | Publish two inquiries merge-eligible |
| 3 | Assert second publish triggers `OpportunityUpdated`, not `OpportunityCreated` |

---

### INT-RT-004 — Handler failure does not break queue

| Step | Action |
|------|--------|
| 1 | Mock `domain.opportunity.integration` to raise |
| 2 | Publish `InquiryReceived` |
| 3 | Assert task still enqueued; no unhandled exception |

---

### INT-RT-005 — Event types registered

**Expected:** `ALL_EVENT_TYPES` includes `OpportunityCreated` and `OpportunityUpdated` (11 domain events + 2 = 12 total in bus).

---

## INT-DEC — Decision Stub

### INT-DEC-001 — Stub fields on create

**Assert `decision_recommendation` contains:**

- `decision_id` matching `^DEC-\d{8}-[a-f0-9]{6}$`
- `opportunity_id` matching parent
- `timestamp` valid ISO8601
- `status == pending`
- `decision == pending`
- `confidence == 0`
- `reason` contains `APSALES-102`

---

### INT-DEC-002 — Stub persisted to decisions.jsonl

| Step | Action |
|------|--------|
| 1 | Create opportunity |
| 2 | Assert one line in `data/apsales/decisions.jsonl` |
| 3 | Parse JSON; assert `decision_id` matches embedded stub |

---

### INT-DEC-003 — Stub unchanged on merge

| Step | Action |
|------|--------|
| 1 | Create → record `decision_id` |
| 2 | Merge inquiry |
| 3 | Assert same `decision_id` on opportunity (stub not regenerated) |

---

## INT-TL — Timeline

### INT-TL-001 — Append-only on create

**Expected:** One timeline event `type=InquiryReceived`.

---

### INT-TL-002 — Append on merge

**Expected:** Two timeline events; first unchanged; second `InquiryReceived` with merge note.

---

### INT-TL-003 — append_event API

| Step | Action |
|------|--------|
| 1 | `append_event(id, VINDecoded, note=test)` |
| 2 | Reload JSON |
| 3 | Assert 3 events; order preserved |

---

## INT-AN — Analytics Metrics

### INT-AN-001 — Opportunity metrics bundle

Call `analytics.provider.get_sales_pipeline_metrics()` (or equivalent).

**Assert keys present:**

- `new_leads`
- `qualified`
- `quoted`
- `won`
- `lost`
- `pending`
- `urgent`
- `expected_revenue`
- `generated_at`

---

### INT-AN-002 — new_leads counts today Lead stage

| Setup | 2 Lead created today, 1 Lead created yesterday |
| Expected | `new_leads == 2` |

---

### INT-AN-003 — expected_revenue sums open opportunities

| Setup | Open opps with expected_revenue 1000 + 500; one lost opp 999 |
| Expected | `expected_revenue == 1500` |

---

### INT-AN-004 — Metrics decoupled from dashboard

**Expected:** `analytics.metrics.opportunity` has **no** import of HTML, Flask, or admin paths.

---

## INT-TRF — Traffic Source

### INT-TRF-001 — Traffic fields stored on create

| Payload | `{landing_page: /engines/hyundai-g4kd.html, utm_source: google, utm_campaign: g4kd-q2}` |

**Assert opportunity JSON:**

- `traffic.landing_page`
- `traffic.utm_source`
- `traffic.utm_campaign`
- `traffic.engine_slug == hyundai-g4kd` (parsed)
- `traffic.entry_channel` defaulted or inferred

---

### INT-TRF-002 — Traffic preserved on merge

| Step | Action |
|------|--------|
| 1 | Create with landing page A |
| 2 | Merge without traffic fields |
| 3 | Assert original traffic block unchanged |

---

### INT-TRF-003 — inquiries_by_landing_page metric

| Setup | 3 opps: 2 same landing page, 1 different |
| Expected | Metric groups counts 2 and 1 |

---

### INT-TRF-004 — inquiries_by_engine_slug metric

| Setup | Opps with slugs `hyundai-g4kd`, `toyota-2nz-fe`, `hyundai-g4kd` |
| Expected | Counts 2 and 1 |

---

### INT-TRF-005 — organic_vs_paid_ratio metric

| Setup | 3 organic, 1 paid entry_channel |
| Expected | Ratio 0.75 / 0.25 or equivalent structure |

---

## INT-REG — Regression

### INT-REG-001 — Runtime foundation tests pass

```bash
.venv/bin/python3 -m unittest tests.test_apsales_runtime_foundation -v
```

**Expected:** All pass (event count updated for +2 events).

---

### INT-REG-002 — Runtime --once without domain

| Step | Action |
|------|--------|
| 1 | Rename/disable `domain/opportunity` temporarily OR env flag `APSALES_OPPORTUNITY=0` |
| 2 | Run `python scripts/apsales-runtime.py --once --no-telegram` |

**Expected:** Exit 0; healthcheck OK.

---

### INT-REG-003 — Remove domain module simulation

**Expected:** With handler import failing gracefully, InquiryReceived still enqueues; no Runtime crash.

---

## Test Execution Checklist (Post-implementation)

| # | Command / action | Pass |
|---|------------------|------|
| 1 | `unittest tests.test_apsales_101_opportunity_integration` | ☐ |
| 2 | `unittest tests.test_apsales_runtime_foundation` | ☐ |
| 3 | Manual `EventBus.publish(InquiryReceived)` in REPL | ☐ |
| 4 | Verify `data/apsales/` structure after run | ☐ |
| 5 | Verify no changes to `config/prompts.py` | ☐ |
| 6 | Verify no changes to `crm_tool.py` | ☐ |

---

## Out of Scope (APSALES-101 tests)

- Decision Engine logic
- Quote creation
- CEO Dashboard HTML
- Gateway email/WhatsApp publishers
- Production deploy / Release Manager
- Prompt content validation

---

## Traceability Matrix

| Requirement | Test IDs |
|-------------|----------|
| Domain module | INT-OPP-*, file layout review |
| Analytics layer | INT-AN-*, INT-TRF-003..005 |
| Decision stub expanded | INT-DEC-* |
| OpportunityUpdated | INT-RT-003 |
| OpportunityCreated | INT-RT-002 |
| Customer hashing | INT-ID-* |
| Traffic source | INT-TRF-* |
| Runtime compatibility | INT-RT-001, INT-REG-* |
| Timeline append-only | INT-TL-* |

---

## Related

- [apsales-101-analysis.md](./apsales-101-analysis.md)
- [apsales-101-review.md](./apsales-101-review.md)
- [apsales/opportunity-model-v1.md](./apsales/opportunity-model-v1.md)

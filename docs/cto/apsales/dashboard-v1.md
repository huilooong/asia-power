# CEO Dashboard v1

**Task:** APSALES-100  
**Document:** dashboard-v1.md  
**Status:** Design (no UI implementation)

---

## Purpose

Give the CEO a **single executive view** of platform GMV health — exceptions, approvals, and KPIs — without reading Telegram threads or markdown pipelines.

Supports **objective 2** (minimal human intervention): CEO intervenes on approvals and anomalies; AI handles routine flow.

---

## Design Principles

1. **Exception-first** — green metrics collapsed; red/yellow items expanded
2. **Approval queue central** — drafts, quotes, external messages in one place
3. **Revenue-forward** — expected revenue visible before won deals close
4. **Actionable** — every widget links to Opportunity ID + recommended action
5. **No fake numbers** — use verified sales intelligence (`truth/`) where available; label estimates

---

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  APSales Executive Dashboard                    [Today ▼]   │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ New Leads    │ Qualified    │ Quotes Sent  │ Negotiations  │
│     12       │      8       │      5       │      3        │
├──────────────┴──────────────┴──────────────┴───────────────┤
│ Won (30d)    │ Lost (30d)   │ Conv. Rate   │ Resp. Time    │
│   $42,500    │     14       │   18.2%      │   2.4h        │
├─────────────────────────────────────────────────────────────┤
│ Expected Revenue (open pipe)          Expected Profit      │
│ $128,000                              $19,200 (est.)       │
├──────────────────────────────┬──────────────────────────────┤
│ URGENT OPPORTUNITIES (3)     │ PENDING APPROVALS (7)        │
│ OPP-… critical / overdue     │ Quote / WhatsApp / Email     │
├──────────────────────────────┼──────────────────────────────┤
│ PENDING FOLLOW-UPS (11)      │ SUPPLIER WAITING (4)         │
│ intelligent schedule due     │ Purchasing SLA breach        │
├──────────────────────────────┴──────────────────────────────┤
│ FUNNEL: Inquiry → … → Won    │ AVG QUOTE TIME: 18.6h       │
└─────────────────────────────────────────────────────────────┘
```

---

## Required Metrics

### Volume

| Widget | Definition | Source |
|--------|------------|--------|
| **New Leads** | Opportunities created in period with `sales_stage=Lead` | Opportunity index |
| **Qualified Leads** | `sales_stage=Qualified` (open) | Opportunity index |
| **Quotes Sent** | `quote.status=sent` in period | Opportunity + audit |
| **Negotiations** | `pipeline_stage=Negotiation` (open) | Opportunity index |
| **Won** | `outcome=won` in period; show revenue | Opportunity + payment events |
| **Lost** | `outcome=lost` in period | Opportunity index |

### Performance

| Widget | Definition | Target (initial) |
|--------|------------|------------------|
| **Revenue** | Sum `actual_revenue` won in period | Rolling monthly GMV |
| **Expected Revenue** | Sum `expected_revenue` where `outcome=open` | Pipeline visibility |
| **Expected Profit** | Sum `expected_profit` (internal) | Margin health |
| **Conversion Rate** | Won / (Won + Lost) 90d rolling | ≥ 15% benchmark TBD |
| **Average Response Time** | Median inquiry → first approved send | < 4h |
| **Average Quote Time** | Median inquiry → quote sent | < 24h |

### Operations

| Widget | Definition |
|--------|------------|
| **Pending Follow-ups** | Opportunities with `follow_up_at <= now` and open |
| **Supplier Waiting** | Supplier Matching / Quotation blocked > SLA |
| **Urgent Opportunities** | `urgency=critical` OR high value + overdue action |

---

## Approval Queue (Critical)

Merge into one list:

| Type | Source | CEO action |
|------|--------|------------|
| Customer reply draft | `customer_gateway/draft_queue` | Approve / Revise / Reject |
| Quote commit | Opportunity `quote.status=pending_approval` | Approve / Edit |
| External social/email | Growth drafts | Approve (existing policy) |

Sort: **risk_level DESC**, then **expected_revenue DESC**.

---

## Drill-down Views

| View | Content |
|------|---------|
| Opportunity detail | Full schema fields + timeline + decisions log |
| Customer 360 | Customer Intelligence summary + all opportunities |
| Supplier panel | Supplier Intelligence + active requests |
| Loss analysis | Lost deals by reason, stage, country |
| Source attribution | Leads by website/SEO page vs social vs WhatsApp |

---

## Data Refresh

| Mode | Interval | Use |
|------|----------|-----|
| Live counters | 60s | Urgent + approvals |
| KPI rollup | 5m | Funnel + averages |
| Revenue | Event-driven | On `PaymentReceived` |

Implementation may start as **read-only JSON API** over `data/apsales/` — UI in APSALES-110.

---

## Existing Assets to Extend

| Current | Evolution |
|---------|-----------|
| `admin/apsales-progress.html` | Distribution progress — keep separate tab |
| `admin/apsales-zijing-live.html` | Social live status — link as "Growth" tab |
| `admin/analytics.html` | Site traffic — link as "Traffic" tab |
| New | **APSales Executive Dashboard** — this spec |

---

## Role-based Views (Future)

| Role | Sees |
|------|------|
| CEO | Full dashboard + approvals |
| COO | Operations + escalations + cross-agent status |
| Sales Director | Funnel + loss analysis + team SLAs |
| APSales (AI) | Write metrics; no approval UI |

---

## Alerts (Telegram to CEO)

| Alert | Condition |
|-------|-----------|
| Critical inquiry | `urgency=critical` new lead |
| Approval backlog | > 5 pending > 2h |
| Quote SLA breach | No quote in 24h on qualified deal > $5k expected |
| Supplier block | Supplier waiting > 24h on paid-bound quote |
| Runtime health | APSales runtime health != running |

---

## Validation (When Implemented)

- [ ] Counts match Opportunity index manual audit
- [ ] Approval queue matches draft_queue files
- [ ] Revenue matches verified sales intelligence query
- [ ] No stock ownership claims in customer-facing approved drafts without inventory flag

---

## Next

**APSALES-110 — CEO Dashboard Preview** — static HTML preview in `docs/previews/apsales-110/` per Engineering Standard (Preview before production UI).

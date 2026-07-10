# Sales Playbook & Intelligence v1

**Task:** APSALES-100  
**Document:** playbook-v1.md  
**Status:** Design

Covers: **Follow-up Intelligence**, **Sales Playbooks**, **Customer Intelligence**, **Supplier Intelligence**, **Decision Engine** (detailed rules).

---

## Part A — Follow-up Intelligence

### Principle

**No fixed reminders.** Every follow-up is a **strategy** selected from context, value, stage, and engagement signals.

Runtime Scheduler executes strategies; Sales Intelligence **selects** strategy + `follow_up_at`.

### Strategy Catalog

| Strategy ID | Trigger | Wait logic | Action | Max attempts |
|-------------|---------|------------|--------|--------------|
| `POST_QUOTE_SILENCE` | Quote sent, no reply | 48h → 5d → 14d (escalating) | Value recap + validity reminder | 3 |
| `PHOTO_VIEW_NO_REPLY` | Customer viewed listing photos (analytics) | 24h | "Any questions on the unit?" draft | 2 |
| `SUPPLIER_DELAY` | Supplier Matching > SLA | 4h internal ping; 12h customer update | Transparency draft ("checking stock") | — |
| `QUALIFICATION_STALL` | Qualified but missing VIN/budget | 24h → 72h | Ask one specific question per message | 3 |
| `LOST_REACTIVATION` | Lost price/timing 30–90d ago | 60d | New stock / promotion angle (CEO approve) | 2 |
| `REPEAT_BUYER_NURTURE` | Won customer 90d+ idle | 120d | Cross-sell related engines | 2 |
| `NEGOTIATION_NUDGE` | Negotiating, customer silent | 72h | Summarize agreed points + open item | 2 |
| `PAYMENT_PENDING` | Quote accepted, no payment | 24h → 72h | Payment instructions + hold warning | 3 |

### Strategy Selection Algorithm

```
inputs: opportunity, customer_intelligence, supplier_intelligence, engagement_signals
    ↓
if pipeline_stage == Quotation && quote.sent && no_reply > 48h
    → POST_QUOTE_SILENCE
else if photo_viewed && no_reply > 24h
    → PHOTO_VIEW_NO_REPLY
else if supplier_waiting > SLA
    → SUPPLIER_DELAY
else if sales_stage == Qualified && missing_fields
    → QUALIFICATION_STALL
...
    ↓
compute follow_up_at from strategy wait logic + customer response_speed factor
    ↓
enqueue Runtime Scheduler (not fixed follow_up_24h rule)
```

### Engagement Signals

| Signal | Source |
|--------|--------|
| Message reply latency | Conversation memory |
| Photo/page view | `site-analytics` + half-cut detail events |
| Email open | Future email tool |
| Quote PDF opened | Future attachment tracking |

---

## Part B — Sales Playbooks

Each playbook defines: **trigger**, **internal analysis checklist (ZH)**, **customer draft tone**, **approval level**, **next pipeline stage**.

### 1. Engine Inquiry

| | |
|--|--|
| **Trigger** | Customer asks for engine code (e.g. G4KD, 2NZ-FE) without VIN |
| **AI** | Normalize code via knowledge graph; inventory search; Decision Engine recommend bundle |
| **Draft** | Platform tone: supplier network availability; ask VIN for fitment if high-risk app |
| **Approval** | Medium — external message |
| **Next** | Inventory Matching or VIN Verification |

### 2. VIN Inquiry

| | |
|--|--|
| **Trigger** | Customer sends VIN or asks "correct engine for my VIN?" |
| **AI** | VIN decode; map engines; list alternatives with confidence |
| **Draft** | Present decode result + recommended SKU; never invent specs |
| **Approval** | Medium |
| **Next** | VIN Verification → Matching |

### 3. Price Objection

| | |
|--|--|
| **Trigger** | "Too expensive", competitor price mention |
| **AI** | Internal: margin floor, supplier re-quote trigger, value angles (warranty, photos, shipping) |
| **Draft** | Acknowledge; reframe value; optional tier (engine only vs bundle) |
| **Approval** | High if discount > policy |
| **Next** | Negotiation |

### 4. Shipping Question

| | |
|--|--|
| **Trigger** | CIF/FOB, port, timeline questions |
| **AI** | Logistics template by country; no firm date without Logistics confirm |
| **Draft** | Range estimate + disclaimer; ask destination port |
| **Approval** | High for delivery commitment |
| **Next** | Quotation (shipping line item) |

### 5. Warranty Question

| | |
|--|--|
| **Trigger** | Warranty period, defect policy |
| **AI** | Pull supplier warranty terms from Supplier Intelligence |
| **Draft** | Platform-mediated warranty language; no over-promise |
| **Approval** | High |
| **Next** | Negotiation or Quotation revision |

### 6. Supplier Unavailable

| | |
|--|--|
| **Trigger** | No inventory match or supplier declined |
| **AI** | Decision Engine alternatives; honest transparency |
| **Draft** | Offer alternative engine/half-cut OR lead time waitlist |
| **Approval** | Medium |
| **Next** | Re-match or Lost (with reason) |

### 7. Cross-sell

| | |
|--|--|
| **Trigger** | Customer bought engine; gearboxes/common ancillaries fit |
| **AI** | Knowledge graph related products; Customer Intelligence history |
| **Draft** | Soft suggestion after Won or in After-sales |
| **Approval** | Medium |
| **Next** | New Opportunity linked |

### 8. Upsell

| | |
|--|--|
| **Trigger** | Budget band allows half-cut vs engine only |
| **AI** | Compare TCO: half-cut custom dismantle vs long block |
| **Draft** | Educational upsell per platform half-cut positioning |
| **Approval** | Medium |
| **Next** | Quotation revision |

### 9. Negotiation

| | |
|--|--|
| **Trigger** | Counter-offer received |
| **AI** | Round log; compute walk-away; Purchasing consult if needed |
| **Draft** | Structured counter; split difference options |
| **Approval** | High |
| **Next** | Negotiation or Won |

### 10. Repeat Customer

| | |
|--|--|
| **Trigger** | Known `customer_hash` with prior Won |
| **AI** | Skip Lead; load full intelligence; priority probability boost |
| **Draft** | Familiar tone; reference past order if verified |
| **Approval** | Medium (Low for VIP list CEO-defined) |
| **Next** | Qualification (accelerated) |

---

## Part C — Customer Intelligence

Long-term profile attached to `customer_hash` (extends `memory/customers/`).

| Field | Purpose |
|-------|---------|
| **Buying history** | Past opportunities, SKUs, revenue |
| **Preferred brands** | Toyota, Hyundai, etc. frequency |
| **Preferred engines** | Top engine codes ordered |
| **Budget** | Historical band + stated budget |
| **Shipping preference** | CIF Lagos, FOB, etc. |
| **Communication preference** | WhatsApp vs email; language |
| **Response speed** | Median hours to reply — feeds follow-up timing |
| **Risk profile** | Payment disputes, unrealistic expectations |
| **Customer value** | LTV score; tier VIP/A/B/C |

### LTV Tier Actions

| Tier | Follow-up | Approval |
|------|-----------|----------|
| VIP | Shorter wait; COO notify on delay | CEO optional on medium risk |
| A | Standard intelligent follow-up | Normal approval |
| B | Longer wait; batch nurture | Normal |
| C | Minimal automated effort | Human decide to pursue |

---

## Part D — Supplier Intelligence

Profile per supplier slug (`memory/suppliers/`).

| Field | Purpose |
|-------|---------|
| **Response speed** | Median hours to answer Purchasing |
| **Quote quality** | Completeness (Incoterms, photos, serial) |
| **Price competitiveness** | vs historical deals same SKU |
| **Stock reliability** | Quote → actually available rate |
| **Photo quality** | QXB/supplier upload scores |
| **Delivery performance** | On-time shipment rate |
| **Warranty history** | Claim rate |
| **Complaint history** | Customer complaints linked |
| **AI Confidence Score** | 0–1 composite for Decision Engine weight |

### Supplier Score Formula (Design)

```
score = 0.20 * response_speed
      + 0.15 * quote_quality
      + 0.20 * price_competitive
      + 0.20 * stock_reliability
      + 0.10 * photo_quality
      + 0.10 * delivery_performance
      - 0.05 * warranty_claims
      - 0.10 * complaints
```

Normalized 0–1. Minimum 0.4 to auto-recommend; below requires human.

Data feeds: Supplier Portal uploads, QXB pipeline, Purchasing notes, after-sales cases.

---

## Part E — Decision Engine (Full)

### Input

```yaml
request:
  engine: G4KD
  vin: optional
  country: NG
  budget_band: medium
  urgency: high
  customer_tier: A
```

### Processing Steps

1. **Normalize** engine code → knowledge graph record (`knowledge/engines/hyundai-g4kd.json`)
2. **Inventory** → `inventory_tool.search` → matches with ownership labels
3. **Supplier Score** → rank suppliers for SKU + country
4. **Historical Success** → win rate for G4KD → Nigeria; avg discount; avg days-to-close
5. **Bundle logic** → if gearbox inquiries common with engine, recommend bundle
6. **Half-cut path** → if custom dismantle cheaper fit, recommend half-cut slug
7. **Alternatives** → if G4KD scarce, suggest Beta engine with confidence + tradeoffs

### Output

```yaml
decision_id: dec-...
recommendations:
  - type: engine
    sku: G4KD
    confidence: 0.82
    suppliers: [sup-a, sup-b]
  - type: bundle
    sku: G4KD + automatic gearbox
    confidence: 0.71
  - type: half_cut
    slug: hyundai-tucson-...
    confidence: 0.65
  - type: alternative
    sku: Nu engine
    reason: stock gap
    confidence: 0.55
gaps: [shipping_port, exact_vin]
human_required: false | true
reason_human: low_confidence | high_value | policy
```

### Rules

| Rule | Action |
|------|--------|
| confidence < 0.5 on primary | `human_required=true` |
| expected_revenue > CEO threshold | COO notify |
| no inventory + no supplier | trigger Supplier Unavailable playbook |
| customer tier VIP | always human review before send |

Log every decision to `data/apsales_runtime/decisions.jsonl` (existing runtime).

---

## Playbook ↔ Runtime Mapping

| Playbook | Task Queue | Event |
|----------|------------|-------|
| Engine Inquiry | `inquiry` | `InquiryReceived` |
| VIN Inquiry | `inquiry` | `VINDecoded` |
| Price Objection | `follow_up` | — |
| Supplier Unavailable | `follow_up` | `SupplierMatched` |
| Repeat Customer | `inquiry` | `CustomerCreated` |

---

## Next

APSALES-101: implement Opportunity + DecisionRecord schema.  
APSALES-102: implement Follow-up Strategy selector + Scheduler integration.  
APSALES-103: implement playbook registry (YAML triggers, no prompt text).

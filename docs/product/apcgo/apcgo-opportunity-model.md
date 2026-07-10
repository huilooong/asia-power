# APCGO Opportunity Model

## Purpose

The APCGO Opportunity Model defines the standard data structure for every growth opportunity AsiaPower discovers.

It applies to:

- companies
- keywords
- content ideas
- competitor gaps
- market signals

The model keeps APCGO daily output consistent, deduplicated, auditable, and ready for APSales or human review.

## Universal Opportunity Object

Every opportunity should support the same core fields.

| Field | Required | Description |
| --- | --- | --- |
| `opportunity_id` | Yes | Internal stable ID. Never changes. |
| `type` | Yes | company, keyword, content, competitor_gap, market_signal. |
| `canonical_key` | Yes | Normalized deduplication key. |
| `title` | Yes | Human-readable title. |
| `description` | Yes | Short explanation of the opportunity. |
| `market` | Yes | Country, region, or segment. |
| `product_scope` | Yes | Engines, gearboxes, half cuts, or mixed. |
| `source_summary` | Yes | Main source evidence. |
| `source_urls` | Yes | Public or approved source URLs. |
| `source_confidence` | Yes | High, medium, or low. |
| `business_value` | Yes | High, medium, or low. |
| `traffic_value` | Yes | High, medium, low, or not_applicable. |
| `inquiry_value` | Yes | High, medium, or low. |
| `sales_readiness` | Yes | ready, needs_review, not_sales_ready. |
| `priority` | Yes | S, A, B, or C. |
| `status` | Yes | Current lifecycle status. |
| `owner` | Yes | APCGO, APSales, APInventory, content, operator. |
| `approval_required` | Yes | true or false. |
| `approval_status` | Yes | pending, approved, rejected, expired, not_required. |
| `recommended_action` | Yes | Next action APCGO recommends. |
| `risk_notes` | Yes | Data, privacy, quality, or execution risk. |
| `created_at` | Yes | First discovery date. |
| `updated_at` | Yes | Last update date. |
| `last_seen_at` | Yes | Last observed date. |

## Type-Specific Fields

### Company Opportunity

Purpose:

Identify public businesses that may create sales opportunities.

Required additional fields:

| Field | Description |
| --- | --- |
| `company_name` | Public company name. |
| `country` | Company country. |
| `city` | Company city if public. |
| `website` | Public website or official profile. |
| `public_email` | Business-published email only, or `Not published`. |
| `public_phone` | Business-published phone/WhatsApp only, or `Not published`. |
| `business_type` | Importer, dealer, fleet, repair chain, wholesaler, etc. |
| `likely_product_need` | Engines, gearboxes, half cuts, or related. |
| `why_valuable` | Business reason for AsiaPower. |
| `suggested_apsales_question` | Suggested first question if approved. |

Rules:

- Do not store private personal contact data.
- Do not contact the company automatically.
- Do not mark as APSales-ready without human approval.

### Keyword Opportunity

Purpose:

Identify commercial Google search demand.

Required additional fields:

| Field | Description |
| --- | --- |
| `keyword` | Target search query. |
| `intent_type` | Engine, vehicle, country, comparison, FAQ, export, gearbox, half-cut. |
| `buyer_stage` | research, sourcing, quote-ready, troubleshooting. |
| `suggested_target_page` | Existing or proposed page. |
| `estimated_search_value` | High, medium, low, or unknown. |
| `expected_inquiry_path` | How the keyword can lead to inquiry. |

Rules:

- Keywords must have commercial or buyer intent.
- Informational keywords are valid only if they lead to qualified inquiry paths.

### Content Opportunity

Purpose:

Define an SEO asset AsiaPower should create or improve.

Required additional fields:

| Field | Description |
| --- | --- |
| `content_type` | Engine page, country page, guide, FAQ, comparison, vehicle page. |
| `target_keyword` | Primary keyword. |
| `secondary_keywords` | Supporting keywords. |
| `target_audience` | Importer, mechanic, fleet, wholesaler, dealer, buyer. |
| `inquiry_cta` | Recommended CTA. |
| `internal_links_needed` | Pages that should link to or from this content. |
| `content_status` | idea, brief_ready, approved, in_production, published, archived. |

Rules:

- Every content opportunity must include a clear inquiry path.
- Content should not claim unverified inventory.

### Competitor Gap

Purpose:

Capture a competitor weakness AsiaPower can act on.

Required additional fields:

| Field | Description |
| --- | --- |
| `competitor_name` | Competitor or market source. |
| `competitor_url` | Public URL if available. |
| `gap_type` | Missing page, weak page, weak schema, weak CTA, thin content, category gap. |
| `target_topic` | Engine, gearbox, half-cut, country, vehicle, buyer question. |
| `asia_power_action` | What AsiaPower should build or improve. |
| `expected_advantage` | Ranking, conversion, trust, coverage, market speed. |

Rules:

- Do not copy competitor content.
- Record specific actions, not generic competitor summaries.

### Market Signal

Purpose:

Record demand, supply, or market movement that affects growth priorities.

Required additional fields:

| Field | Description |
| --- | --- |
| `signal_topic` | Engine, vehicle, country, supply, demand, buyer question. |
| `signal_direction` | rising, stable, falling, unknown. |
| `evidence_count` | Number of supporting observations. |
| `related_opportunities` | Linked company, keyword, content, or competitor records. |
| `recommended_response` | What AsiaPower should do. |

Rules:

- Market signals may influence priority.
- Market signals should not be treated as confirmed sales demand without evidence.

## Scoring Model

APCGO should score every opportunity with a transparent scorecard.

Recommended dimensions:

| Dimension | Meaning | Score |
| --- | --- | --- |
| `traffic_potential` | Could this create organic traffic? | 0-5 |
| `inquiry_potential` | Could this create qualified inquiries? | 0-5 |
| `sales_fit` | Does this match AsiaPower's products and markets? | 0-5 |
| `market_fit` | Does this fit target geography or segment? | 0-5 |
| `supply_fit` | Can AsiaPower likely serve this demand? | 0-5 |
| `execution_speed` | Can action happen quickly? | 0-5 |
| `source_confidence` | Is evidence reliable? | 0-5 |
| `risk_level` | Lower risk should improve priority. | 0-5 |

Suggested priority mapping:

| Priority | Score Range | Meaning |
| --- | --- | --- |
| S | 32-40 | Execute today if approved. |
| A | 24-31 | Execute this week. |
| B | 15-23 | Monitor or batch. |
| C | 0-14 | No action now. |

The exact scoring weights can be adjusted later after APCGO has daily operating data.

## Lifecycle Model

Every opportunity uses the same lifecycle.

```text
discovered
  ↓
validated
  ↓
ranked
  ↓
recommended
  ↓
approval_pending
  ↓
approved / rejected
  ↓
handoff_ready / content_ready / monitor
  ↓
APSales_handoff / content_production / monitoring
  ↓
outcome_recorded
  ↓
archived or reactivated
```

## History Requirements

An opportunity record is not enough.

APCGO must preserve history for:

- status changes
- priority changes
- source updates
- approval decisions
- APSales handoff events
- outcome results

This makes APCGO auditable and prevents repeated work.

## Approval Model

Approval is attached to an action, not only to an opportunity.

Example:

```text
Opportunity: Toyota Ghana
Action: approve APSales to verify buyer interest
Approval: pending / approved / rejected
```

The same opportunity can later require another approval for a different action.

Example:

```text
Action 1: APSales review
Action 2: publish Ghana Toyota engine landing page
Action 3: distribute approved page on LinkedIn
```

Each action needs its own approval record.

## APSales Handoff Model

An APSales handoff packet must include:

- opportunity title
- source URL
- why this company or opportunity matters
- likely product need
- relevant AsiaPower product category
- suggested first question
- priority
- approval status
- risk notes

APCGO must not contact the company.

APSales owns:

- contact
- qualification
- quote
- follow-up
- close

## Outcome Model

Each acted opportunity should eventually record an outcome.

Possible outcomes:

| Outcome | Meaning |
| --- | --- |
| `no_action` | Not acted on. |
| `approved_for_review` | Approved for human review. |
| `sent_to_apsales` | Handoff created. |
| `contacted_by_apsales` | APSales contacted the opportunity. |
| `qualified` | Opportunity appears relevant. |
| `not_qualified` | Not a fit. |
| `quote_requested` | Buyer requested quote. |
| `quoted` | AsiaPower sent quotation. |
| `closed_won` | Deal closed. |
| `closed_lost` | Deal lost. |
| `published` | Content opportunity became public content. |
| `monitoring` | Continue monitoring. |
| `archived` | No further action. |

## Minimum Viable Database Standard

Before building software, the database can be represented as a structured spreadsheet or markdown-backed registry if needed.

The minimum viable standard must support:

- stable opportunity ID
- canonical key
- type
- title
- market
- product scope
- priority
- status
- approval status
- owner
- source URL
- created date
- updated date
- notes

However, any implementation must preserve the full model so AsiaPower can later move from manual operation to automation.

## Example Records

### Company Example

```text
type: company
title: Toyota Ghana
market: Ghana
product_scope: engines, gearboxes
priority: S
status: approval_pending
owner: APCGO
approval_required: true
recommended_action: Request human approval for APSales review.
```

### Keyword Example

```text
type: keyword
title: 1KD-FTV engine Nigeria
market: Nigeria
product_scope: engines
priority: S
status: content_ready
owner: APCGO / content
approval_required: true
recommended_action: Approve engine intelligence page brief.
```

### Competitor Gap Example

```text
type: competitor_gap
title: Nigeria half-cut pages lack inspection and export guidance
market: Nigeria
product_scope: half cuts
priority: A
status: ranked
owner: APCGO
approval_required: true
recommended_action: Create AsiaPower half-cut inspection guide for Nigeria buyers.
```

## Product Boundary

The Opportunity Model does not change APCGO's boundary.

APCGO may:

- record opportunities
- update priorities
- prepare handoff context
- request approval
- recommend action

APCGO must not:

- contact companies
- email leads
- WhatsApp leads
- publish pages automatically
- deploy
- modify APSales behavior
- claim unverified stock

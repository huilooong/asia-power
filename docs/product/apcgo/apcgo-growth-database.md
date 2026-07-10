# APCGO Growth Opportunity Database

## Purpose

The APCGO Growth Opportunity Database is the persistent memory layer for AsiaPower growth work.

It records every discovered:

- company
- keyword
- content idea
- competitor gap
- market signal

The database exists so APCGO does not rediscover the same opportunity every day, lose priority history, or hand the same lead to APSales without context.

APCGO remains responsible for opportunity generation only.

```text
APCGO discovers, records, ranks, and recommends.
APSales contacts, qualifies, quotes, follows up, and closes.
```

## Design Goals

The database must support:

- no duplicate opportunities
- daily status updates
- priority history
- APSales handoff history
- human approval history
- opportunity lifecycle tracking
- source traceability
- public-data safety
- future automation without changing APCGO's boundaries

It must not support:

- automatic outreach
- automatic WhatsApp messages
- automatic email
- automatic publishing
- automatic deployment
- private data collection
- unapproved customer contact

## Core Concept

Every growth signal becomes a durable opportunity record.

Examples:

- `Toyota Ghana` as a qualified company opportunity
- `1KD-FTV engine Nigeria` as a keyword opportunity
- `G4KD engine Ghana` as a content opportunity
- a competitor ranking for a weak half-cut page as a competitor gap
- repeated Ghana demand for Hyundai/Kia engines as a market signal

Each opportunity has one canonical identity and multiple history records.

## Opportunity Types

### 1. Company Opportunity

Represents a public company that may become an APSales opportunity.

Examples:

- engine importer
- auto parts importer
- repair chain
- fleet maintenance company
- dismantler
- dealer
- wholesaler
- logistics fleet

Primary owner:

```text
APCGO until approved for APSales review.
APSales after approved handoff.
```

### 2. Keyword Opportunity

Represents a commercial search query AsiaPower may target.

Examples:

- `1KD-FTV engine Nigeria`
- `G4NA engine Ghana`
- `used gearbox for Toyota Hilux Nigeria`
- `half cut supplier Ghana`

Primary owner:

```text
APCGO / content operator
```

### 3. Content Opportunity

Represents a page, guide, FAQ, comparison, or landing page AsiaPower should create or improve.

Examples:

- engine detail page
- country landing page
- vehicle compatibility page
- engine vs half-cut guide
- gearbox matching guide

Primary owner:

```text
APCGO until approved.
Content / website operator after approval.
```

### 4. Competitor Gap

Represents a specific competitor weakness AsiaPower can exploit.

Examples:

- competitor has page but no FAQ schema
- competitor ranks with thin content
- competitor covers an engine but not country-specific buyer intent
- competitor lacks gearbox matching content

Primary owner:

```text
APCGO / SEO operator
```

### 5. Market Signal

Represents demand or supply movement that may influence priorities.

Examples:

- repeated Nigeria demand for Toyota diesel engines
- Ghana demand for Hyundai/Kia replacement engines
- rising half-cut questions from West Africa
- inventory signal for specific gearboxes

Primary owner:

```text
APCGO, with possible APInventory input.
```

## Logical Database Structure

This is a product design, not an implementation schema.

### opportunities

Stores the canonical opportunity.

Required fields:

| Field | Purpose |
| --- | --- |
| `opportunity_id` | Internal stable ID. Never changes. |
| `type` | company, keyword, content, competitor_gap, market_signal. |
| `canonical_key` | Deduplication key. |
| `title` | Human-readable opportunity name. |
| `market` | Country, region, or segment. |
| `product_scope` | Engines, gearboxes, half cuts, or mixed. |
| `status` | Current lifecycle status. |
| `priority` | Current S/A/B/C priority. |
| `source_confidence` | Confidence in source quality. |
| `business_value` | Expected commercial value. |
| `traffic_value` | Expected traffic value. |
| `inquiry_value` | Expected inquiry value. |
| `owner` | APCGO, APSales, APInventory, content, operator. |
| `approval_required` | Whether human approval is required before action. |
| `approval_status` | pending, approved, rejected, expired, not_required. |
| `created_at` | First discovery date. |
| `updated_at` | Last update date. |
| `last_seen_at` | Last date the signal was observed. |
| `next_action` | Current recommended action. |

### opportunity_sources

Stores evidence and traceability.

Required fields:

| Field | Purpose |
| --- | --- |
| `source_id` | Internal source record ID. |
| `opportunity_id` | Linked opportunity. |
| `source_type` | website, directory, search result, AsiaPower page, report, analytics, Search Console, internal approved note. |
| `source_url` | Public URL when available. |
| `source_title` | Source label. |
| `observed_at` | Date observed. |
| `source_confidence` | High, medium, low. |
| `data_allowed` | public, internal-approved, restricted. |
| `notes` | Short source context. |

### opportunity_status_history

Stores daily lifecycle movement.

Required fields:

| Field | Purpose |
| --- | --- |
| `history_id` | Internal history ID. |
| `opportunity_id` | Linked opportunity. |
| `date` | Status date. |
| `previous_status` | Prior lifecycle status. |
| `new_status` | New lifecycle status. |
| `reason` | Why status changed. |
| `actor` | APCGO, human, APSales, APInventory, operator. |

### opportunity_priority_history

Stores ranking changes over time.

Required fields:

| Field | Purpose |
| --- | --- |
| `priority_history_id` | Internal history ID. |
| `opportunity_id` | Linked opportunity. |
| `date` | Priority update date. |
| `previous_priority` | Previous S/A/B/C. |
| `new_priority` | New S/A/B/C. |
| `score_snapshot` | Snapshot of scoring dimensions. |
| `reason` | Why priority changed. |
| `actor` | APCGO or human reviewer. |

### approval_history

Stores human approval decisions.

Required fields:

| Field | Purpose |
| --- | --- |
| `approval_id` | Internal approval record ID. |
| `opportunity_id` | Linked opportunity. |
| `requested_action` | Outreach, content production, publishing, handoff, deployment, research. |
| `requested_by` | APCGO or human operator. |
| `approval_status` | pending, approved, rejected, expired. |
| `approved_by` | Human approver. |
| `decision_at` | Decision date. |
| `decision_notes` | Reason or constraint. |

### apsales_handoff_history

Stores handoff activity and APSales boundary.

Required fields:

| Field | Purpose |
| --- | --- |
| `handoff_id` | Internal handoff record ID. |
| `opportunity_id` | Linked opportunity. |
| `handoff_date` | Date sent for APSales review. |
| `handoff_status` | pending_review, accepted, rejected, contacted, qualified, quoted, closed_won, closed_lost. |
| `ap_sales_owner` | APSales owner if assigned. |
| `handoff_context` | Company/context/source/need summary. |
| `suggested_first_question` | APCGO context only. |
| `approval_id` | Linked approval record. |
| `outcome_notes` | APSales result summary. |

### daily_snapshots

Stores daily APCGO report state.

Required fields:

| Field | Purpose |
| --- | --- |
| `snapshot_id` | Internal snapshot ID. |
| `date` | Report date. |
| `market_focus` | Ghana, Nigeria, West Africa, etc. |
| `product_focus` | Engines, gearboxes, half cuts. |
| `new_opportunities` | Count discovered today. |
| `updated_opportunities` | Count updated today. |
| `duplicate_candidates` | Count blocked or merged. |
| `s_priority_count` | Current S opportunities. |
| `apsales_ready_count` | Approved or pending human review for APSales. |
| `top_actions` | Links to today's top opportunity records. |

## Deduplication Design

No duplicates is a product requirement.

APCGO should not treat a repeated discovery as a new opportunity. It should update the existing record.

### Canonical Key Rules

Each opportunity type has a canonical key.

| Type | Canonical Key |
| --- | --- |
| company | normalized company name + country + city or domain |
| keyword | normalized keyword + market + intent |
| content | target URL slug or target keyword + page type + market |
| competitor_gap | competitor domain + target topic + gap type |
| market_signal | market + product scope + signal topic |

### Normalization Rules

Before creating a new opportunity, APCGO should normalize:

- lowercase text
- remove extra spaces
- remove legal suffix noise when safe, such as Ltd, Limited, PLC, Inc
- normalize country names
- normalize domain names
- normalize engine codes, such as `2TR FE` to `2TR-FE`
- normalize product category labels

### Duplicate Handling

If a matching canonical key exists:

```text
Do not create a new opportunity.
Update source, status, priority, last_seen_at, and history.
```

If similarity is high but not certain:

```text
Mark as duplicate_candidate.
Require human review before merge.
```

## Opportunity Lifecycle

Every opportunity moves through a lifecycle.

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

### Lifecycle Status Definitions

| Status | Meaning |
| --- | --- |
| `discovered` | APCGO found the signal but has not validated it. |
| `validated` | Source and relevance are confirmed enough for ranking. |
| `ranked` | Opportunity has S/A/B/C priority. |
| `recommended` | Included in daily top actions or executive recommendations. |
| `approval_pending` | Waiting for human approval before action. |
| `approved` | Human approved the proposed action. |
| `rejected` | Human rejected the action or opportunity. |
| `handoff_ready` | Ready for APSales review. |
| `apsales_handoff` | Sent to APSales with context. |
| `content_ready` | Ready for content production. |
| `in_progress` | Human team is acting on it. |
| `outcome_recorded` | Result captured. |
| `monitor` | Not actionable today but should be watched. |
| `archived` | No current value. |
| `reactivated` | Previously archived opportunity became relevant again. |

## Priority History

Priority is not a static label.

APCGO must remember why an opportunity moved from B to S, or S to monitor.

Priority levels:

| Priority | Meaning |
| --- | --- |
| S | Execute today if approved. |
| A | Execute this week. |
| B | Batch, monitor, or wait for more evidence. |
| C | No action now. |

Priority changes must record:

- previous priority
- new priority
- scoring snapshot
- reason
- source or signal that caused the change
- actor
- date

## APSales Handoff History

APSales handoff history exists to prevent context loss.

APCGO must record:

- what was handed off
- why it was handed off
- what source supports it
- what product need is likely
- what APSales should ask first
- whether approval was granted
- what APSales did with it
- whether it became a quote, customer, or closed deal

APCGO must not record private conversation content unless approved for internal business use.

## Human Approval History

Human approval is mandatory before external action.

The database must preserve:

- who approved
- what action was approved
- when it was approved
- what constraints were attached
- whether approval expired
- whether action was rejected

Approval is required for:

- contacting leads
- sending emails
- sending WhatsApp
- publishing content
- posting to social media
- changing production pages
- deployment

## Daily Status Updates

Each daily APCGO run should update existing opportunities before creating new ones.

Daily update sequence:

```text
Load existing opportunities
  ↓
Normalize new discoveries
  ↓
Deduplicate
  ↓
Update last_seen_at and sources
  ↓
Update scores and priority
  ↓
Update lifecycle status
  ↓
Create daily snapshot
  ↓
Generate daily report
```

The daily report should show:

- new opportunities
- updated opportunities
- repeated opportunities
- priority changes
- approval-needed actions
- APSales-ready handoffs

## Relationship To APCGO Daily Report

The daily report is an output.

The Growth Opportunity Database is the memory.

Without the database, each daily report is isolated.

With the database, APCGO can answer:

- Have we seen this company before?
- Did APSales already review it?
- Was this content idea already approved?
- Did this keyword rise in priority?
- Which competitor gaps keep repeating?
- Which market signals are becoming stronger?

## Relationship To APSales

APCGO does not contact customers.

The database only prepares APSales-ready context.

APSales receives an opportunity only when:

1. the opportunity is validated,
2. the recommended action requires sales review,
3. human approval exists,
4. the handoff packet is complete.

APSales outcome should flow back into the database as status and history, not as a redesign of APCGO.

## Relationship To APInventory

APCGO may create demand signals for APInventory.

Examples:

- repeated buyer interest in `1KD-FTV`
- country demand for Toyota diesel engines
- competitor half-cut demand
- gearbox matching demand

APInventory may return supply signals:

- verified inventory exists
- assisted inventory may be available
- supply intelligence suggests possible supplier availability

These supply signals may affect opportunity priority, but APCGO must not present unconfirmed stock as available.

## Data Safety Rules

The database must enforce these rules:

- use public business information only for company discovery
- do not store private personal data as growth opportunity data
- do not expose private supplier notes
- do not expose full VINs
- do not store unapproved private chat data
- do not treat unverified stock as live inventory
- do not record hidden tokens, credentials, or passwords

## Future Automation Readiness

This design enables later automation without changing the APCGO product boundary.

Future automation can safely support:

- deduplication
- daily refresh
- priority scoring
- Search Console enrichment
- source verification
- APSales handoff packaging
- approval queue creation
- outcome tracking

Future automation must not perform:

- automatic outreach
- automatic email
- automatic WhatsApp
- automatic publishing
- automatic deployment

## CTO Review Questions

Before implementation, CTO should approve:

1. Are the opportunity types complete?
2. Is the deduplication model strict enough?
3. Is the lifecycle compatible with APSales?
4. Should APInventory feedback be recorded in the same database or a linked inventory system?
5. What is the minimum viable implementation: spreadsheet, JSON, database, or admin panel?

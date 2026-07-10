# APCGO-003 Growth Opportunity Database Review

## Executive Summary

APCGO-003 designs the persistent memory layer APCGO needs before daily growth reporting can scale.

APCGO-002 proved that APCGO can produce business value manually, but it also exposed the next risk:

```text
Without a persistent opportunity database, APCGO will repeat discoveries, lose priority history, and create weak APSales handoffs.
```

APCGO-003 solves this at the product architecture level.

No code was implemented.
No Runtime was modified.
APSales was not modified.
APCGO v1 architecture, workflow, and roadmap remain frozen.

## Deliverables

Created under:

```text
docs/product/apcgo/
```

Files:

1. `apcgo-growth-database.md`
2. `apcgo-opportunity-model.md`
3. `apcgo-review.md`

## What APCGO-003 Adds

### 1. Persistent Opportunity Memory

APCGO can remember every discovered:

- company
- keyword
- content idea
- competitor gap
- market signal

This turns daily reports from isolated documents into a cumulative growth system.

### 2. No-Duplicate Design

APCGO-003 defines canonical keys for each opportunity type:

- company: normalized company name + country + city or domain
- keyword: normalized keyword + market + intent
- content: target URL slug or keyword + page type + market
- competitor gap: competitor domain + topic + gap type
- market signal: market + product scope + signal topic

Repeated discoveries update existing records instead of creating new records.

### 3. Daily Status Updates

APCGO-003 defines daily updates for:

- new opportunities
- repeated opportunities
- source updates
- status changes
- priority changes
- handoff readiness
- approval state

This allows APCGO to answer what changed today, not just what was found today.

### 4. Priority History

Priority changes are recorded with:

- previous priority
- new priority
- score snapshot
- reason
- actor
- date

This preserves why an opportunity moved from B to S, or why an S opportunity was downgraded.

### 5. APSales Handoff History

APCGO-003 defines an APSales handoff record that includes:

- opportunity context
- source
- likely product need
- suggested first question
- approval link
- APSales status
- outcome notes

This preserves the boundary:

```text
APCGO prepares.
APSales contacts and converts.
```

### 6. Human Approval History

APCGO-003 records human approval per action.

Approval is required before:

- outreach
- email
- WhatsApp
- publishing
- social posting
- website changes
- deployment

This keeps APCGO safe even after automation is introduced later.

### 7. Opportunity Lifecycle

APCGO-003 defines a shared lifecycle:

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

## Architecture Consistency Review

### APCGO Boundary

Consistent.

APCGO still only:

- discovers
- records
- ranks
- recommends
- requests approval
- prepares handoff context

APCGO still does not:

- contact customers
- send email
- send WhatsApp
- publish automatically
- deploy
- quote
- close deals

### APSales Boundary

Consistent.

APSales remains responsible for:

- contact
- qualification
- quote
- follow-up
- close

The database stores handoff and outcome history but does not move APSales logic into APCGO.

### Workflow Consistency

Consistent.

The existing APCGO workflow remains:

```text
Input
  ↓
Analysis
  ↓
Opportunity Discovery
  ↓
Priority Ranking
  ↓
Executive Recommendation
  ↓
Human Approval
  ↓
APSales / Content / Operations
```

APCGO-003 adds persistence behind this workflow. It does not redesign the workflow.

### KPI Consistency

Consistent.

The database improves measurement of:

- qualified companies
- content opportunities
- high-value keywords
- competitor opportunities
- estimated traffic
- estimated inquiry value
- APSales-approved handoffs
- outcome conversion

It also enables future KPI tracking from opportunity discovery to closed deal.

## Business Value

The Growth Opportunity Database creates value by preventing:

- duplicate lead lists
- repeated keyword suggestions
- lost content ideas
- forgotten competitor gaps
- untracked market signals
- unapproved external actions
- weak APSales context

It enables AsiaPower to build a cumulative growth engine instead of daily one-off reports.

## Risks

### Risk 1: Overbuilding Too Early

The model is intentionally implementation-neutral.

CTO can start with a spreadsheet, markdown registry, JSON store, database, or admin panel later.

### Risk 2: Unsafe Contact Data

The model explicitly limits company discovery to public business information only.

Private personal data, private chats, hidden supplier notes, and unapproved data are excluded.

### Risk 3: APCGO Becoming Sales Automation

The design prevents this by requiring:

- approval history
- APSales handoff history
- explicit ownership
- no automatic outreach

### Risk 4: Priority Scores Becoming Fake Precision

The scoring model is directional for v1.

Scores should be improved later using Search Console, analytics, APSales outcomes, and inventory signals.

## Recommended CTO Decision

APCGO-003 should be approved as the product design for the APCGO memory layer.

Recommended decision:

```text
APPROVE FOR IMPLEMENTATION PLANNING
```

Not for immediate automation.

## Recommended Next Step

APCGO-004 should define the minimum viable operating format for this database.

Recommended APCGO-004 scope:

1. Choose MVP storage format:
   - spreadsheet
   - markdown registry
   - JSON files
   - lightweight database
   - admin interface later

2. Define the first 50 opportunity records to migrate from APCGO-002.

3. Define manual deduplication rules for daily reports.

4. Define APSales approval and handoff review process.

5. Do not automate outreach, publishing, or deployment.

## Final Review

APCGO-003 is consistent with the frozen APCGO v1 product architecture.

It adds the missing persistence layer without changing APCGO's responsibility boundary.

Final status:

```text
READY FOR CTO REVIEW
```

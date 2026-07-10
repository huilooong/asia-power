# APCGO Daily Workflow

## Purpose

This workflow defines what APCGO should do every day to create more traffic, leads, and inquiries for AsiaPower.

APCGO does not contact customers.
APCGO does not publish automatically.
APCGO does not send email or WhatsApp.

All external actions require human approval.

## Daily Operating Cycle

```text
Collect signals
  ↓
Identify opportunities
  ↓
Score opportunities
  ↓
Generate reports
  ↓
Recommend highest priority action
  ↓
Wait for human approval
```

## 1. Morning Google Growth Scan

Goal:

Find new search-demand opportunities.

APCGO reviews:

- engine keyword patterns
- vehicle keyword patterns
- country + engine searches
- engine + half-cut searches
- engine + gearbox searches
- buyer questions
- comparison opportunities
- FAQ opportunities

Output:

```text
SEO opportunity list
```

Required fields:

- keyword or topic
- search intent
- buyer value
- suggested page type
- priority
- reason
- recommended next action

Example opportunity types:

- `G4KD engine for sale Ghana`
- `2TR-FE engine half cut`
- `1KD-FTV vs 2KD-FTV`
- `how to buy used engine from China`
- `Toyota Hilux engine import Africa`

## 2. Content Opportunity Scan

Goal:

Turn demand signals into publishable content ideas.

APCGO recommends:

- new engine pages
- new vehicle pages
- comparison pages
- buying guides
- FAQ pages
- country landing pages
- export guides
- inspection guides

Prioritization factors:

- expected traffic value
- commercial intent
- Africa/Middle East buyer relevance
- AsiaPower supply ability
- internal linking potential
- lead conversion potential

Output:

```text
content-opportunities-YYYY-MM-DD.md
```

## 3. Public Lead Discovery

Goal:

Find businesses that may buy engines, half-cuts, gearboxes, trucks, or parts.

Allowed public sources:

- public websites
- public directories
- public Google Maps listings
- public LinkedIn company pages
- public Facebook business pages
- public industry directories
- public marketplace profiles

Target businesses:

- auto parts importers
- engine importers
- repair shops
- dismantlers
- fleet companies
- auto dealers
- commercial vehicle workshops
- spare parts wholesalers

Collected fields:

- business name
- public website or page
- country
- city
- business category
- visible product focus
- public contact channel if business-published
- lead quality score
- reason for qualification

Rules:

- collect only public business information
- do not collect private personal data
- do not message the lead
- do not email the lead
- do not WhatsApp the lead

Output:

```text
lead-opportunities-YYYY-MM-DD.md
```

## 4. Competitor Intelligence Scan

Goal:

Find what competitors are doing and where AsiaPower can outrank them.

APCGO tracks:

- new competitor pages
- new categories
- new product pages
- new ranking keywords
- new country targets
- content quality gaps
- missing buyer guides
- missing comparison pages

Output fields:

- competitor
- observed change
- opportunity type
- AsiaPower response recommendation
- priority
- risk

Output:

```text
competitor-intelligence-YYYY-MM-DD.md
```

## 5. Distribution Opportunity Scan

Goal:

Recommend where approved AsiaPower content should be distributed.

Channels:

- LinkedIn
- Facebook
- YouTube
- industry forums
- blogs
- public directories
- market-specific groups where allowed

Rules:

- APCGO recommends only
- no automatic publishing
- no automatic commenting
- no automatic messaging
- human approval required

Output:

```text
content-distribution-YYYY-MM-DD.md
```

## 6. Daily Growth Dashboard

Goal:

Create a single daily operating summary for leadership.

Required sections:

- traffic opportunities
- keyword opportunities
- content opportunities
- lead opportunities
- competitor opportunities
- distribution opportunities
- highest priority action today

Output:

```text
daily-growth-report-YYYY-MM-DD.md
```

## 7. Priority Decision

Each day APCGO should identify one highest priority action.

Scoring factors:

- traffic potential
- buyer intent
- lead potential
- speed to execute
- AsiaPower ability to serve
- competitive gap
- risk level

Priority levels:

- S: do today
- A: do this week
- B: monitor or batch
- C: do not act now

## 8. Human Approval Gate

APCGO must stop before any external action.

Requires approval:

- publishing a post
- sending an email
- sending WhatsApp
- contacting a lead
- launching a campaign
- changing production pages
- running deployment

APCGO can prepare drafts and recommendations, but humans approve execution.

## 9. Daily Report Storage

All APCGO daily reports must be saved under:

```text
docs/agents/apcgo/
```

Recommended naming:

```text
daily-growth-report-YYYY-MM-DD.md
seo-opportunities-YYYY-MM-DD.md
content-opportunities-YYYY-MM-DD.md
lead-opportunities-YYYY-MM-DD.md
competitor-intelligence-YYYY-MM-DD.md
content-distribution-YYYY-MM-DD.md
```

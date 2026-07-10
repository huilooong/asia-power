# APCGO v1 Architecture

## Architecture Goal

APCGO v1 is the product architecture for AsiaPower's AI Growth Operating System.

It turns fragmented growth tasks into a repeatable operating model:

```text
Inputs
  ↓
Growth Intelligence
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

## System Boundary

APCGO owns opportunity generation.

APCGO does not own:

- customer conversation
- quotation
- payment
- order follow-up
- inventory confirmation
- deployment
- publishing

Those responsibilities belong to APSales, APInventory, operations, or approved human operators.

## Growth Intelligence Architecture

### 1. Lead Intelligence

Purpose:

Identify qualified public companies that could become AsiaPower opportunities.

Target companies:

- engine importers
- auto parts importers
- repair chains
- dismantlers
- fleet maintenance companies
- auto dealers
- wholesalers
- truck parts companies
- machinery service companies

Data allowed:

- company name
- country
- city
- website
- public email if published by business
- public phone/WhatsApp if published by business
- business type
- source URL
- why valuable
- priority

Output:

```text
Qualified company opportunity list
```

How it helps:

- Creates lead supply for APSales review.
- Expands market coverage.
- Turns public business data into prioritized targets.

### 2. Content Intelligence

Purpose:

Identify content assets that can create Google traffic and inquiries.

Opportunity types:

- engine pages
- vehicle pages
- country landing pages
- comparison pages
- buying guides
- FAQ pages
- gearbox matching pages
- half-cut pages

Output:

```text
Content opportunity list ranked by expected traffic and inquiry value
```

How it helps:

- Guides SEO production.
- Prevents random content creation.
- Connects content directly to business value.

### 3. Competitor Intelligence

Purpose:

Find competitor gaps and ranking opportunities.

Signals:

- competitor new pages
- competitor weak pages
- competitor keyword coverage
- competitor category expansion
- missing AsiaPower content
- new market targeting

Output:

```text
Actionable competitor opportunity list
```

How it helps:

- Shows what AsiaPower should build or improve.
- Finds pages competitors rank with weak content.
- Creates targeted SEO actions.

### 4. Market Intelligence

Purpose:

Understand where demand is emerging.

Market signals:

- country demand
- engine demand
- vehicle demand
- fleet demand
- import demand
- regional buyer questions
- new product category demand

Output:

```text
Market opportunity map
```

How it helps:

- Aligns growth with real buyer markets.
- Helps APInventory understand demand.
- Helps leadership choose where to focus.

### 5. Distribution Intelligence

Purpose:

Recommend where approved content should be distributed.

Channels:

- LinkedIn
- Facebook
- YouTube
- industry forums
- blogs
- public directories
- marketplace profiles

Rules:

- recommend only
- no automatic publishing
- no automatic replies
- no automatic DMs

Output:

```text
Distribution opportunity plan
```

How it helps:

- Extends content reach.
- Creates new traffic paths.
- Supports brand visibility without unsafe automation.

### 6. Executive Intelligence

Purpose:

Convert all growth signals into daily executive decisions.

Output:

```text
Top five highest-value actions today
```

Each action includes:

- action
- expected result
- KPI impact
- owner
- priority
- approval needed

How it helps:

- Prevents growth work from becoming noise.
- Gives leadership clear actions.
- Connects strategy to execution.

## Opportunity Object

Every APCGO opportunity should eventually follow one structure:

```text
id
type
title
source
market
business_value
traffic_value
inquiry_value
priority
recommended_action
owner
approval_required
status
created_at
updated_at
```

Opportunity types:

- qualified_company
- keyword
- content
- competitor_gap
- market_signal
- distribution_channel
- executive_action

## Priority Model

S:

Immediate opportunity with high expected business value.

A:

Strong opportunity that should be acted on soon.

B:

Useful opportunity to batch or monitor.

C:

Not worth action now.

Scoring dimensions:

- expected traffic
- buyer intent
- expected inquiry value
- AsiaPower supply fit
- market fit
- competitor weakness
- execution effort
- risk

## Human Approval Gate

Before external action:

```text
APCGO recommendation
  ↓
human approval
  ↓
APSales / operator executes
```

External actions requiring approval:

- contacting a company
- sending email
- sending WhatsApp
- publishing social content
- publishing website content
- deploying pages
- updating production pages

## Integration Boundaries

### APSales

APCGO passes opportunity context.

APSales decides contact and conversion.

### APInventory

APCGO passes demand signals.

APInventory confirms supply.

### Website / SEO

APCGO recommends pages and improvements.

Website changes require approved implementation.

### Leadership

APCGO provides ranked recommendations.

Leadership chooses execution priorities.

## Architecture Risk Controls

APCGO must protect AsiaPower from:

- fake stock claims
- fake technical claims
- fake traffic estimates presented as facts
- private data exposure
- unapproved external outreach
- content spam
- unprioritized reports

Every output must be specific, sourced, prioritized, and tied to traffic, leads, or inquiries.

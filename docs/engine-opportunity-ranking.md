# AsiaPower Engine Opportunity Ranking V1

Date: 2026-07-05

Scope: ranking model only. This document does not modify website pages, generator code, sitemap, inventory records, or deployment workflows.

## Goal

Before AsiaPower generates or updates any engine SEO page, the engine code should pass through Opportunity Ranking.

The ranking answers one question:

> Is this engine code worth turning into a public SEO and sales asset now?

The model protects AsiaPower from generating low-value pages while prioritizing engine codes with real supply, real demand, real inventory evidence, and realistic profit.

## 1. Score Overview

Each engine code receives a 0-100 opportunity score.

Recommended weighting:

| Dimension | Weight |
|---|---:|
| China Supply | 20 |
| Africa Demand | 20 |
| AsiaPower Historical Inquiry | 15 |
| Inventory Signals | 20 |
| Google/Search Opportunity | 10 |
| Profit Potential | 10 |
| Competition Difficulty | 5 |
| **Total** | **100** |

Competition Difficulty is scored as an opportunity-adjusted value:

- easy competition = higher score
- hard competition = lower score

## 2. Scoring Standards

### 2.1 China Supply - 20 points

Measures whether AsiaPower can realistically source this engine from China-side suppliers.

Score:

- `18-20`: multiple trusted suppliers, frequent availability, known yards, repeated confirmed supply.
- `14-17`: regular availability, at least one reliable supplier, recent confirmation possible.
- `8-13`: occasional availability, supplier lookup needed, not yet predictable.
- `1-7`: rare supply, only weak supplier clues.
- `0`: no known China-side supply.

Primary future inputs:

- Verified Inventory count.
- Assisted Inventory count.
- Supply Intelligence count and freshness.
- supplier response rate.
- average sourcing time.
- stock confirmation success rate.

### 2.2 Africa Demand - 20 points

Measures expected buyer demand across Ghana, Nigeria, Togo, Benin, Cameroon, Kenya, Algeria, and other Africa/Middle East markets.

Score:

- `18-20`: repeated buyer demand across multiple countries; common repair/import engine.
- `14-17`: strong demand in at least one target market or recurring regional demand.
- `8-13`: some visible demand but not yet consistent.
- `1-7`: niche or uncertain demand.
- `0`: no observed target-market demand.

Primary future inputs:

- WhatsApp conversations.
- website enquiries.
- Facebook/social listening.
- market reports.
- country-specific quote requests.
- engine-code search terms from site search.

### 2.3 AsiaPower Historical Inquiry - 15 points

Measures direct AsiaPower customer evidence.

Score:

- `13-15`: repeated enquiries, quotes, or follow-ups for this exact engine code.
- `10-12`: multiple enquiries or one strong qualified buyer.
- `5-9`: weak or indirect enquiries, model-based demand without confirmed code.
- `1-4`: one low-quality mention.
- `0`: no internal inquiry evidence.

Primary inputs:

- APSales lead inbox.
- contact form submissions.
- WhatsApp CRM records.
- quote drafts.
- customer follow-up history.
- closed/lost deal notes.

### 2.4 Inventory Signals - 20 points

Measures evidence that AsiaPower has or can link real inventory around this engine code.

Score:

- `18-20`: many Verified Inventory records, public-safe detail pages, photos, and related half-cuts.
- `14-17`: several Verified Inventory records or strong Assisted Inventory converting soon.
- `8-13`: a few inventory records, but data quality or freshness needs review.
- `1-7`: only Supply Intelligence or stale/uncertain records.
- `0`: no inventory evidence.

Rules:

- Verified Inventory carries the most weight.
- Assisted Inventory helps ranking but does not support public stock claims.
- Supply Intelligence can raise internal priority but must not imply public availability.
- Full VINs, supplier phone numbers, and private supplier notes must not be exposed.

### 2.5 Google/Search Opportunity - 10 points

Reserved interface for future Search Console and SEO tools.

For V1, this can be estimated from:

- existing site search terms,
- engine code appearing in analytics landing/search paths,
- growth audit recommendations,
- related brand/model page traffic,
- known high-intent engine-code search behavior.

Score:

- `9-10`: clear search opportunity with high-intent query or current impressions.
- `7-8`: likely search opportunity, supported by related page traffic.
- `4-6`: plausible SEO value but no direct evidence yet.
- `1-3`: weak or very niche search opportunity.
- `0`: no search evidence.

When Search Console is connected, this dimension should use:

- impressions,
- clicks,
- CTR,
- average position,
- query exactness,
- country,
- page coverage status,
- rising query trend.

### 2.6 Profit Potential - 10 points

Measures expected gross profit and operational feasibility.

Score:

- `9-10`: high-margin engine, strong buyer willingness, manageable logistics.
- `7-8`: good margin and normal logistics.
- `4-6`: acceptable margin, but price pressure or supply effort is moderate.
- `1-3`: low margin, high handling cost, or frequent price mismatch.
- `0`: not commercially attractive.

Primary inputs:

- quoted price vs supplier cost.
- EXW/CIF margin.
- average negotiation success.
- expected freight/packing burden.
- damage/return risk.
- sourcing labor.

### 2.7 Competition Difficulty - 5 points

Measures how hard it is to win SEO or sales attention for this code.

Score:

- `5`: low competition, AsiaPower can rank or convert with basic content.
- `4`: moderate competition, still worth targeting.
- `2-3`: crowded but possible with inventory evidence and better page quality.
- `1`: very hard competition; only generate if supply/demand/profit are strong.
- `0`: not worth competing now.

Factors:

- SERP dominated by large marketplaces.
- many existing suppliers with strong pages.
- official/manual pages outrank commercial pages.
- unclear buyer intent.
- engine code too generic or ambiguous.

## 3. Grade Levels

### S Grade - Generate Immediately

Score:

```text
85-100
```

Action:

- Immediately generate or update public engine page.
- Add to sitemap.
- Add internal links from relevant brand, engine catalog, and verified inventory pages.
- Prioritize manual optimization.
-子敬/APSales should prepare response snippets and quote flow.
- 子龙/APInventory should keep inventory/confirmation current.

Typical profile:

- strong China supply,
- strong Africa demand,
- strong internal enquiry history,
- verified inventory exists,
- profit is attractive.

### A Grade - Generate When Inventory Exists

Score:

```text
70-84
```

Action:

- Generate if Verified Inventory exists or if Assisted Inventory is very likely to convert.
- If no Verified Inventory exists, create knowledge record and keep page in draft or low-priority queue.
- Add to sitemap only after public-safe content exists.

Typical profile:

- strong demand or supply,
- some inventory evidence,
- good commercial potential,
- not enough proof for immediate high-priority push.

### B Grade - Wait For More Data

Score:

```text
45-69
```

Action:

- Do not generate public page by default.
- Create or update internal knowledge record.
- Let 子龙 gather more supply evidence.
- Let 子敬 gather more customer demand evidence.
- Re-score after new inventory, enquiries, or Search Console signals.

Typical profile:

- plausible engine code,
- weak demand or weak supply,
- limited inventory,
- uncertain profit.

### C Grade - Do Not Generate Now

Score:

```text
0-44
```

Action:

- Do not generate public SEO page.
- Keep as internal note or alias if needed.
- Revisit only if new supply, demand, or inquiry evidence appears.

Typical profile:

- ambiguous code,
- no reliable supply,
- no demand,
- no inventory,
- poor profit,
- high competition.

## 4. Hard Gates

Even if the score is high, a public page must not be generated when:

- engine code identity is ambiguous,
- the code may represent multiple incompatible variants,
- no public-safe reference exists,
- page copy would depend on Supply Intelligence,
- only unconfirmed inventory exists but page wording would imply availability,
- full VIN, supplier contact, or private chat data would be exposed,
- official specs would need to be invented.

If a hard gate fails, the engine can still receive a ranking score, but output status should be:

```text
blocked_for_publication
```

## 5. Generator Call Flow

Future Generator should call Opportunity Ranking before page generation.

Recommended flow:

```text
engine_code detected
  -> normalize identity
  -> collect ranking inputs
  -> calculate opportunity score
  -> assign grade S/A/B/C
  -> check hard gates
  -> decide action
```

Decision logic:

```text
S + gates pass:
  generate page now

A + Verified Inventory exists:
  generate page now

A + no Verified Inventory:
  create/update knowledge record, hold page until inventory/public references exist

B:
  create/update internal knowledge, do not publish

C:
  do not generate, keep as low-priority signal

any grade + hard gate fail:
  do not publish; send to review queue
```

Generator output should store:

- `engine_code`
- `knowledge_id`
- `opportunity_score`
- `opportunity_grade`
- dimension scores
- data sources used
- hard gate result
- publish decision
- last ranked date

## 6. How 子龙 / APInventory Affects Ranking

子龙 increases or decreases ranking through supply truth.

Positive signals:

- new Verified Inventory records,
- Assisted Inventory converted to Verified Inventory,
- fresh supplier confirmation,
- current photos/video received,
- supplier confirms engine code and accessories,
- repeated supplier availability,
- lower sourcing time,
- higher supplier response rate,
- supplier permission to publish.

Negative signals:

- supplier cannot confirm stock,
- item is sold or stale,
- photos are unclear,
- engine code cannot be verified,
- supplier refuses publication,
- stock repeatedly fails confirmation,
- long sourcing time,
- high mismatch risk.

子龙 should never increase public-page confidence from Supply Intelligence alone. Supply Intelligence can raise internal investigation priority, but it cannot create public stock claims.

## 7. How 子敬 / APSales Affects Ranking

子敬 increases or decreases ranking through customer demand and conversion truth.

Positive signals:

- repeated customer enquiries for exact engine code,
- qualified buyer asks for price/photos/shipping,
- quote requested for a known destination port,
- WhatsApp response is strong,
- quotation sent,
- customer follow-up happens,
- closed deal or repeat purchase.

Negative signals:

- many unqualified or vague enquiries,
- buyer asks but never responds,
- price mismatch repeatedly kills deals,
- wrong-code confusion is common,
- engine has demand but cannot be supplied,
- high support burden with low conversion.

子敬 should feed ranking with:

- lead count,
- qualified lead count,
- quote count,
- quote success rate,
- closed-deal rate,
- destination country,
- customer language/market,
- lost reason.

## 8. Search Console Integration

Search Console is not required in V1, but the model reserves `Google/Search Opportunity` for it.

Future data fields:

- `gsc_impressions_28d`
- `gsc_clicks_28d`
- `gsc_ctr_28d`
- `gsc_average_position_28d`
- `gsc_queries`
- `gsc_country`
- `indexed_status`
- `coverage_status`
- `last_crawled`

Recommended scoring after integration:

- high impressions + low position = optimization opportunity,
- high impressions + high CTR = protect and improve page,
- low impressions + strong inventory = needs internal links or content expansion,
- rising query trend = ranking boost,
- indexed but no clicks = improve title/meta and buyer intent,
- not indexed = technical review before more content work.

Search Console should not override business reality. A page with search demand but no supply or profit should not outrank an engine with strong supply, strong enquiries, and real conversion potential.

## 9. Example Grade Interpretation

Example `G4FC` style profile:

- strong inventory signal,
- strong Hyundai/Kia supply,
- multiple Africa-market applications,
- likely enquiry demand,
- good page candidate.

Likely grade:

```text
S or A
```

Example rare ambiguous Mercedes numeric variant:

- inventory may exist,
- variant identity may be confusing,
- official specs missing,
- search opportunity unclear.

Likely grade:

```text
A if inventory is verified, otherwise B
```

Example engine code from one weak Supply Intelligence mention:

- no Verified Inventory,
- no enquiry,
- no confirmed applications,
- no search data.

Likely grade:

```text
C
```

## 10. Operating Rule

Opportunity Ranking is not a vanity SEO score.

The target is this conversion chain:

```text
China Supply
-> Africa Demand
-> Verified / Confirmable Inventory
-> Search Entry
-> Customer Inquiry
-> Quotation
-> Closed Deal
```

Any engine page that does not improve this chain should wait.

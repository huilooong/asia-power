# APSEO-011 KPI Framework

## Purpose

APSEO-011 must be measured by Google traffic and inquiry outcomes.

The KPI framework measures whether SEO work increases:

- indexed pages
- keyword rankings
- organic clicks
- inquiries
- conversion

## KPI Hierarchy

```text
Content Output
  ↓
Index Coverage
  ↓
Keyword Visibility
  ↓
Organic Clicks
  ↓
Qualified Inquiries
  ↓
Sales Handoff
```

## 1. Content Output KPIs

| KPI | Definition | Target |
| --- | --- | ---: |
| New SEO pages published | New indexable engine/country/guide/comparison pages | 70 in 90 days |
| Engine pages upgraded | Existing engine pages upgraded to V2 quality | 16 in 60 days |
| Country pages published | Ghana/Nigeria engine, gearbox, half-cut pages | 6 in 45 days |
| Buying guides published | Commercial education pages | 4 in 45 days |
| Vehicle pages published | Vehicle-model landing pages | 6 in 75 days |
| Comparison pages published | Engine/format comparison pages | 3 in 75 days |

## 2. Index Coverage KPIs

| KPI | Definition | Target |
| --- | --- | ---: |
| Valid indexed SEO pages | Indexable SEO pages shown as valid/indexed | 120 by day 90 |
| Submitted pages indexed rate | Indexed / submitted sitemap URLs | 80%+ |
| Duplicate canonical issues | Google duplicate/canonical conflicts | Down to 0 critical |
| Crawled not indexed pages | Pages crawled but not indexed | Down 50% by day 90 |
| Soft 404 SEO pages | SEO pages treated as thin/soft 404 | 0 critical |
| Sitemap freshness | Pages with current lastmod after major update | 100% of updated pages |

## 3. Keyword Visibility KPIs

| KPI | Definition | Target |
| --- | --- | ---: |
| High-intent keyword impressions | GSC impressions for engine/country/half-cut/gearbox clusters | +100% by day 90 |
| Keywords ranking top 20 | Query/page pairs with average position <= 20 | +50 by day 90 |
| Keywords ranking top 10 | Query/page pairs with average position <= 10 | +20 by day 90 |
| New query clusters discovered | New commercial keyword clusters found in GSC | 100+ |
| Pages with impressions | SEO pages receiving at least 1 impression | 80+ |

## 4. Organic Click KPIs

| KPI | Definition | Target |
| --- | --- | ---: |
| Organic clicks | GSC organic clicks to SEO pages | +50% by day 90 |
| Engine page clicks | Clicks to `/engines/` pages | +50% by day 90 |
| Country page clicks | Clicks to country landing pages | Establish baseline by day 45 |
| CTR improvement | CTR on optimized low-CTR pages | +20% relative improvement |
| Clicks from Ghana/Nigeria queries | Clicks from target market keyword clusters | +50% by day 90 |

## 5. Inquiry KPIs

| KPI | Definition | Target |
| --- | --- | ---: |
| Organic inquiries | Contact/WhatsApp/form inquiries from organic SEO pages | +30 by day 90 |
| Engine page inquiries | Inquiries from engine pages | +20 by day 90 |
| Country page inquiries | Inquiries from Ghana/Nigeria landing pages | +10 by day 90 |
| Qualified inquiry rate | Qualified inquiries / organic inquiries | 40%+ |
| Inquiry source attribution rate | Inquiries with landing page/source captured | 90%+ |

## 6. Conversion KPIs

| KPI | Definition | Target |
| --- | --- | ---: |
| Organic inquiry conversion rate | Organic inquiries / organic SEO page sessions | +20% relative |
| CTA click rate | WhatsApp/form CTA clicks / SEO page sessions | Establish baseline, then +20% |
| Quote-ready inquiry rate | Inquiries including model/year/engine/destination | 50%+ |
| APSales handoff acceptance | APSales accepted SEO-origin opportunities / SEO-origin handoffs | 70%+ |
| Organic quote requests | SEO-origin inquiries that request quote | +15 by day 90 |

## 7. Content Quality KPIs

| KPI | Definition | Target |
| --- | --- | ---: |
| Pages with unique title/meta | No duplicated SEO title/meta among canonical pages | 100% |
| Pages with valid canonical | Canonical points to correct code-first or final URL | 100% |
| Pages with FAQ schema | FAQ schema where visible FAQ exists | 80+ |
| Pages with ItemList schema | Related engines/vehicles/half-cuts modeled | 60+ |
| Pages with no fake specs | No invented official specs | 100% |
| Pages with no unverified stock claim | No unconfirmed availability claim | 100% |

## 8. Internal Linking KPIs

| KPI | Definition | Target |
| --- | --- | ---: |
| Internal links added | New contextual internal links | 1,000+ by day 90 |
| Pages with 5+ inbound links | SEO pages with at least 5 internal inbound links | 100 |
| Engine pages linked from hubs | Engine pages linked from engine/brand/category hubs | 100% of canonical pages |
| Country pages linked from engine pages | Country pages receiving links from relevant engines | 6 pages |
| Orphan SEO pages | Indexable SEO pages with no internal links | 0 |

## 9. Dashboard Views

### Executive View

Shows:

- indexed pages
- organic clicks
- organic inquiries
- conversion rate
- top 5 winning pages
- top 5 pages needing action

### Engine Page View

Shows:

- engine code
- URL
- indexed status
- impressions
- clicks
- CTR
- average position
- inquiries
- CTA clicks
- last updated

### Country Page View

Shows:

- country
- product category
- URL
- impressions
- clicks
- inquiries
- top queries
- top linked engines

### Keyword Cluster View

Shows:

- cluster
- keywords
- target page
- impressions
- clicks
- average position
- priority
- next action

### Index Coverage View

Shows:

- submitted
- indexed
- not indexed
- duplicate canonical
- crawled not indexed
- soft 404
- action owner

### Inquiry Conversion View

Shows:

- landing page
- inquiry count
- qualified count
- quote-ready count
- APSales handoff status
- top missing information

## Weekly KPI Review

Every week, review:

1. Did indexed pages increase?
2. Did high-intent impressions increase?
3. Did clicks increase?
4. Did inquiries increase?
5. Which pages need title/meta updates?
6. Which pages need internal links?
7. Which pages have traffic but no inquiries?
8. Which keywords should become new content opportunities?

## Red Flags

Escalate when:

- indexed pages decrease unexpectedly
- duplicate canonical issues increase
- high-impression pages have CTR below 1%
- engine pages receive clicks but no CTA engagement
- pages are indexed but receive no impressions after 30 days
- organic inquiries lack landing page attribution
- generator creates repeated title/meta patterns

## Measurement Dependencies

Required to measure APSEO-011 correctly:

- Search Console access
- sitemap URL list
- canonical URL list
- inquiry source attribution
- landing page tracking
- WhatsApp CTA click tracking
- APSales opportunity source fields

## KPI Ownership

| KPI Area | Owner |
| --- | --- |
| Indexed pages | SEO / website operator |
| Keyword rankings | SEO / APCGO |
| Organic clicks | SEO / APCGO |
| Content production | Content operator |
| Inquiries | APSales + analytics |
| Conversion | APSales + product |
| Attribution | Analytics / APSales Runtime |

Status:

```text
READY FOR CTO REVIEW
```

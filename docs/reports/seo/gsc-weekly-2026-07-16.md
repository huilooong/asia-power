# APSEO Search Console Weekly Query Report - 2026-07-16

Status: watchlist baseline
Watchlist: `data/seo/gsc-query-watchlist.json`

## Summary

- Data status: Historical GSC signals are present in prior SEO diagnosis, but no raw GSC export file or direct authenticated GSC session was available during this check.
- CSV rows reviewed: 0
- Tracked landing-page rows: 0
- Tracked clicks: 0
- Tracked impressions: 0
- Tracked average CTR: 0.00%
- Tracked weighted average position: 0.0

## Known GSC Signals Already Recorded

| Signal | Query scope | Metric | Value | Source | Interpretation |
| --- | --- | --- | ---: | --- | --- |
| Naked brand query is weak | asia power | average_position | ~34 | `docs/ops/seo-brand-query-asia-power-diagnosis-2026-07-15.md` | The naked brand query competes with electrical equipment and geopolitical power-index entities, so it should be monitored separately from commercial long-tail terms. |
| Ghana intent terms are strong | Ghana intent queries | average_position | ~2.1 | `docs/ops/seo-brand-query-asia-power-diagnosis-2026-07-15.md` | Country/product-intent long-tail terms are the better KPI set for the current SEO phase. |

## Watchlist Coverage

| Page | Segment | Market | Clicks | Impressions | CTR | Avg position | Target query seen | Next action |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `/guides/` | guide_hub | global | 0 | 0 | 0.00% | 0.0 | no | Expand guide hub links toward matching country and engine-code pages. |
| `/guides/buying-used-engines-from-china.html` | guide | global | 0 | 0 | 0.00% | 0.0 | no | Add FAQ sections for repeated buyer concerns that appear in GSC. |
| `/guides/fob-vs-cif-shipping-guide.html` | guide | global | 0 | 0 | 0.00% | 0.0 | no | Add country-specific examples where impressions appear. |
| `/engines/ghana-used-engines-from-china.html` | country_engine | ghana | 0 | 0 | 0.00% | 0.0 | no | Add internal links from matching brand and model pages when impressions appear. |
| `/engines/toyota-engines-for-ghana-importers.html` | brand_country_engine | ghana | 0 | 0 | 0.00% | 0.0 | no | Add visible FAQ or code section for the exact engine code that gains impressions. |
| `/engines/nigeria-used-engines-from-china.html` | country_engine | nigeria | 0 | 0 | 0.00% | 0.0 | no | Add internal links from matching brand and model pages when impressions appear. |
| `/engines/hyundai-kia-engines-for-nigeria-importers.html` | brand_country_engine | nigeria | 0 | 0 | 0.00% | 0.0 | no | Split Hyundai and Kia into separate pages if either brand receives enough impressions. |

## High Impressions, Low CTR

No tracked rows crossed the low-CTR threshold.

## Ranking Opportunities

No tracked rows were in positions 8-20.

## New Query Candidates

No new query candidates crossed the minimum impression threshold.

## Pages With No GSC Rows In This Export

- `/guides/` (guide_hub, global)
- `/guides/buying-used-engines-from-china.html` (guide, global)
- `/guides/fob-vs-cif-shipping-guide.html` (guide, global)
- `/engines/ghana-used-engines-from-china.html` (country_engine, ghana)
- `/engines/toyota-engines-for-ghana-importers.html` (brand_country_engine, ghana)
- `/engines/nigeria-used-engines-from-china.html` (country_engine, nigeria)
- `/engines/hyundai-kia-engines-for-nigeria-importers.html` (brand_country_engine, nigeria)

## Required Weekly Actions

- Review at least 20 query/page rows when data volume allows.
- Pick at least 5 page actions: title/meta rewrite, FAQ expansion, internal links, page split, or sitemap/indexing check.
- Save this report under `docs/reports/seo/` and link follow-up code/content changes in the next APSEO execution report.
- Do not claim indexing or ranking improvements unless confirmed in GSC.

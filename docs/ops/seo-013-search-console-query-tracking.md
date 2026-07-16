# SEO-013 Search Console Query Tracking

Date: 2026-07-16
Status: Framework implemented, waiting for real GSC export data
Production impact: none

## Purpose

The next SEO phase needs Search Console input before more content is generated blindly. This framework turns GSC query/page exports into a repeatable weekly review.

## Implemented

- Watchlist: `data/seo/gsc-query-watchlist.json`
- Report script: `scripts/seo-gsc-weekly-report.mjs`
- Report output directory: `docs/reports/seo/`

Tracked pages currently include:

- `/guides/`
- `/guides/buying-used-engines-from-china.html`
- `/guides/fob-vs-cif-shipping-guide.html`
- `/engines/ghana-used-engines-from-china.html`
- `/engines/toyota-engines-for-ghana-importers.html`
- `/engines/nigeria-used-engines-from-china.html`
- `/engines/hyundai-kia-engines-for-nigeria-importers.html`

## Weekly Input

Export GSC performance data with these columns when possible:

- Query
- Page
- Clicks
- Impressions
- CTR
- Position
- Date, optional

Run:

```bash
node scripts/seo-gsc-weekly-report.mjs --csv path/to/gsc-export.csv
```

If data is not available yet:

```bash
node scripts/seo-gsc-weekly-report.mjs --watchlist-only
```

## Review Rules

The script flags:

- high impressions with low CTR
- average positions from 8 to 20
- new query candidates not covered by the tracked page's target query list
- tracked pages missing from the export

## Current Blocker

No real Search Console export was found in the repo during this implementation step. Until GSC rows are available, this is a tracking framework and baseline, not a performance diagnosis.

## Next Operating Step

Once GSC data is available, run the weekly report and use the output to choose 5 concrete page actions:

- title/meta rewrite
- FAQ expansion
- internal links
- page split
- sitemap/indexing investigation

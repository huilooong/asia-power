# SEO Reports

This directory stores weekly APSEO reports generated from Google Search Console exports and AsiaPower internal analytics.

## Search Console Weekly Loop

1. Export GSC performance rows for the target period.
2. Include query and page dimensions when possible.
3. Run:

```bash
node scripts/seo-gsc-weekly-report.mjs --csv path/to/gsc-export.csv
```

If GSC data is not available yet, generate the watchlist baseline:

```bash
node scripts/seo-gsc-weekly-report.mjs --watchlist-only
```

The current tracked query and landing-page set lives in:

```text
data/seo/gsc-query-watchlist.json
```

## Required Review Outcome

Each weekly report should produce at least 5 concrete actions when data volume allows:

- title or meta rewrite
- FAQ expansion
- internal link addition
- page split or new page candidate
- sitemap/indexing investigation

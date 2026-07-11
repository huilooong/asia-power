# Growth Indexing Readiness Review

Date: 2026-07-11

## Summary

AsiaPower growth SEO pages are ready for Google discovery and Search Console submission.

## Checked Assets

- Growth URLs checked: 38
- Sitemap coverage: 38 / 38
- Robots blocked: 0 / 38
- Live indexability check: 38 / 38 passed

## Validation Results

- robots.txt: reachable at https://asia-power.com/robots.txt
- sitemap.xml: reachable at https://asia-power.com/sitemap.xml
- Sitemap reference in robots.txt: present
- Growth URLs in sitemap: complete
- HTTP status: all checked URLs returned 200
- Content-Type: all checked growth URLs returned text/html
- Canonical: all checked growth URLs matched their final URL
- noindex: none detected
- Title/meta description: present on all checked growth URLs

## Search Console Submission

Use this file for manual URL inspection / submission:

- docs/cto/growth-search-console-submit-urls.txt

## Priority Submission Order

1. https://asia-power.com/engines/africa-half-cut-engines.html
2. https://asia-power.com/engines/ghana-half-cut-engines.html
3. https://asia-power.com/engines/nigeria-half-cut-engines.html
4. Brand pages: Toyota, Honda, Nissan, Kia, Mitsubishi
5. Cluster pages
6. Donor detail pages

## Notes

- The pages are discoverable through /engines/ internal links and sitemap.xml.
- The current robots.txt content allows /engines/ pages.
- robots.txt is served as application/octet-stream, which is not ideal but the content is readable and includes a valid Sitemap directive.
- No production infrastructure changes were made during this review.

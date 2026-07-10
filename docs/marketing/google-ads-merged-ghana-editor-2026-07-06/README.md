# Google Ads Editor Package — Ghana Search (Merged Final)

Generated: 2026-07-06

This is the **merged final** package combining Cursor safety rules with Claude model-specific keywords and ad copy.

Compare notes: `docs/marketing/google-ads-merge-analysis-2026-07-06.md`

Do **not** import desktop `asiapower-search-ads-v3.csv` directly — it uses Enabled status and deprecated Broad Match Modified.

Import order:

1. 01-campaigns.csv
2. 02-ad-groups.csv
3. 03-keywords.csv
4. 04-responsive-search-ads.csv
5. 05-negative-keywords.csv

All campaigns, ad groups, keywords and ads are **Paused**.

Merged improvements vs original package:

- Manual CPC bid strategy (was Maximize clicks)
- 9 engine ad groups with model-specific RSA copy (was 7 groups with shared copy)
- 92 keywords including year-specific and RAV4/Prado/CR-V/Civic terms (was 59)
- URL display paths on ads (corolla/engine, etc.)
- 45 account negatives (was 40)

Tracking:

- GA4: G-PB2J3VRX5J
- Google Ads conversion: AW-971838178 / vR2aCLjrv8scEOKltM8D
- UTM on every keyword and ad URL

Before enable:

- Turn on auto-tagging
- Confirm payment method and daily budget (~$30/day total)
- Enable **GH_Search_Engines_HighIntent** only for first 7-day test

CEO guide: `docs/marketing/google-ads-ceo-setup-guide-2026-07-06.md`

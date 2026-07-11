# APSales Global Demand Sources

Generated: 2026-07-11 20:30 UTC

## Purpose

This report expands AsiaPower demand discovery beyond Facebook. The goal is to find public buyer demand for engines, gearboxes and half-cuts across regional social platforms, forums, classifieds and video comments, then route qualified demand into APSales approval drafts.

## Safety Boundary

- Collect public business or public post information only.
- Do not bypass login, paywall, privacy settings or platform restrictions.
- Do not auto-comment, auto-DM, auto-email or auto-WhatsApp.
- Every external reply requires human approval.
- Prioritize direct buyer demand over generic audience growth.

## Channel Mix

- Total approved source seeds: 14
- Platforms: 14
- Regions: 6

### By Region

- East Africa: 2
- Global: 4
- Gulf: 2
- South Asia: 2
- Southeast Asia: 1
- West Africa: 3

### By Source Type

- classifieds: 7
- forum: 4
- social_groups: 1
- video_comments: 2

## Highest Priority Channels

| Rank | Priority | Risk | Region | Countries | Platform | Type | Why it matters | Allowed action |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | S | Medium | Global | Ghana, Nigeria, Kenya, UAE, Pakistan, Philippines, Jamaica | YouTube | video_comments | Repair videos and engine-swap videos contain direct questions about where to buy engines and gearboxes. | collect_public_comment_demand_and_create_reply_drafts |
| 2 | S | Medium | West Africa | Ghana | Tonaton | classifieds | Ghana vehicle and parts listings expose local demand for Toyota, Hyundai, Kia and Nissan parts. | collect_public_listing_signals_only |
| 3 | S | Medium | West Africa | Nigeria | Nairaland | forum | Users ask repair, import, used engine and spare-parts questions in long-running threads. | collect_public_threads_and_create_reply_drafts |
| 4 | S | Medium | West Africa | Nigeria | Jiji | classifieds | Auto-parts listings and buyer comments reveal models, pricing and active local demand. | collect_public_listing_signals_only |
| 5 | S | High | Global | Ghana, Nigeria, Kenya, Tanzania, Uganda, UAE | Facebook Groups | social_groups | High-density country-specific auto-parts groups, but account safety must be protected. | browse_joined_or_public_groups_and_create_reply_drafts |
| 6 | A | Medium | East Africa | Tanzania | ZoomTanzania | classifieds | Tanzania marketplace demand for Japanese used vehicles and replacement parts. | collect_public_listing_signals_only |
| 7 | A | Medium | East Africa | Kenya | Pigiame | classifieds | Kenya classifieds show parts and vehicle demand around Nairobi and Mombasa. | collect_public_listing_signals_only |
| 8 | A | Medium | South Asia | Pakistan | PakWheels | forum | Pakistan has active engine-swap, half-cut and Japanese parts discussions. | collect_public_threads_and_create_reply_drafts |
| 9 | A | Medium | Gulf | Saudi Arabia, Jordan, Kuwait, Oman, Qatar | OpenSooq | classifieds | Arabic marketplace demand for engines, transmissions and used vehicles. | collect_public_listing_signals_only |
| 10 | A | Medium | Gulf | UAE | Dubizzle | classifieds | Dubai export, dismantling and used-parts listings connect to Africa/Middle East re-export demand. | collect_public_listing_signals_only |
| 11 | A | High | Global | Ghana, Nigeria, Kenya, Tanzania, UAE | TikTok | video_comments | Short repair and parts videos often contain public buying questions, especially by country. | collect_public_comment_demand_and_create_reply_drafts |
| 12 | B | Medium | South Asia | India | Team-BHP | forum | Technical discussions reveal engine/gearbox compatibility and long-tail SEO questions. | collect_public_questions_for_content_only |
| 13 | B | Medium | Global | United States, Canada, Australia, Nigeria, Ghana | Reddit | forum | Repair communities surface buyer questions and compatibility problems, but direct import intent is lower. | collect_public_questions_for_content_and_drafts_when_commercial |
| 14 | B | Medium | Southeast Asia | Philippines, Malaysia, Singapore | Carousell | classifieds | Used-parts listings and public searches indicate vehicle parc and pricing. | collect_public_listing_signals_only |

## Target Queries

### YouTube — global-youtube-comments
- G4KD engine replacement comments
- 2TR-FE engine swap where to buy
- Toyota gearbox replacement Africa

### Tonaton — gh-tonaton-auto-parts
- site:tonaton.com engine Ghana
- site:tonaton.com gearbox Ghana
- site:tonaton.com spare parts Ghana

### Nairaland — ng-nairaland-autos
- site:nairaland.com engine replacement Nigeria
- site:nairaland.com tokunbo engine
- site:nairaland.com gearbox problem Toyota

### Jiji — ng-jiji-auto-parts
- site:jiji.ng engine Toyota Nigeria
- site:jiji.ng gearbox Nigeria
- site:jiji.ng half cut Nigeria

### Facebook Groups — global-facebook-groups
- auto parts Ghana group
- spare parts Nigeria group
- Toyota parts Kenya group

### ZoomTanzania — tz-zoomtanzania-auto
- site:zoomtanzania.com engine Tanzania
- site:zoomtanzania.com gearbox Tanzania
- site:zoomtanzania.com spare parts

### Pigiame — ke-pigiame-auto-parts
- site:pigiame.co.ke engine Kenya
- site:pigiame.co.ke gearbox Kenya
- site:pigiame.co.ke Toyota engine

### PakWheels — pk-pakwheels-forum
- site:pakwheels.com/forums engine swap
- site:pakwheels.com/forums half cut
- site:pakwheels.com/forums used engine import

### OpenSooq — gulf-opensooq-auto-parts
- site:opensooq.com engine parts
- site:opensooq.com gearbox
- site:opensooq.com spare parts Toyota

### Dubizzle — ae-dubizzle-auto-parts
- site:dubai.dubizzle.com engine parts Dubai
- site:dubai.dubizzle.com gearbox
- site:dubai.dubizzle.com half cut

### TikTok — global-tiktok-comments
- used engine Ghana TikTok
- tokunbo parts Nigeria TikTok
- half cut engine Africa TikTok

### Team-BHP — in-teambhp
- site:team-bhp.com/forum engine replacement
- site:team-bhp.com/forum gearbox replacement

### Reddit — global-reddit-auto-subs
- site:reddit.com/r/MechanicAdvice engine replacement
- site:reddit.com/r/cars gearbox replacement
- site:reddit.com used engine import

### Carousell — sea-carousell-auto-parts
- site:carousell.com engine Toyota
- site:carousell.com gearbox
- site:carousell.com half cut

## Operational Rule

All channels feed the same downstream workflow:

Public channel signal -> local intel JSONL -> buyer intent scoring -> APSales reply draft -> human approval -> manual or approved reply -> AsiaPower landing page / WhatsApp / inquiry form.

Do not create a separate sales process per platform. The channel changes; the APSales approval workflow stays the same.

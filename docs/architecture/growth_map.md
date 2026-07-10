# Growth Map

Audit date: 2026-07-04

Keywords scanned: growth, traffic, analytics, facebook, tiktok, seo, scheduler, worker, autopilot.

## Existing Capabilities

### Traffic / Analytics

- Site-side analytics collection in `server/lib/site-analytics.js`.
- Admin analytics UI in `admin/analytics.html` and `js/admin-analytics.js`.
- Internal IP filtering in `server/lib/analytics-internal-ips.js`.
- Weekly analytics reporting through `scripts/analytics-weekly-report.py` and `.sh`.
- Search trend recording APIs in production server.
- Existing traffic reports and CSVs under `reports/`.

### SEO

- Static SEO metadata sync: `scripts/sync-seo-static-meta.mjs`.
- Sitemap generation: `server/lib/sitemap.js`, `scripts/generate-sitemap.mjs`.
- Catalog prerender/SEO libraries: `server/lib/half-cut-seo.js`, `half-cut-prerender.js`, `catalog-list-prerender.js`, `inventory-catalog-seo.js`.
- Frontend SEO JS: `js/seo.js`, `js/seo-engines.js`.
- Hreflang sync: `scripts/sync-hreflang-batch.mjs`.
- Brand/engine/category landing pages exist.

### Facebook / Social

- Official API posting abstraction: `customer_gateway/social_api.py`.
- Social autopilot queue: `customer_gateway/social_autopilot.py`, `scripts/apsales-social-autopilot.py`.
- Browser automation for Facebook friends/feed/groups/messenger.
- Session manager and login capture.
- Facebook daily run orchestration.
- Facebook target group config and social engagement policy.
- Social content batch under `docs/social-content/batch-001`.

### TikTok / Short Video

- TikTok/social content scripts and generated videos under `docs/tiktok/` and `docs/social-content/batch-001/videos/`.
- Content docs for TikTok/Reels education and inventory promos.
- No detected live TikTok publishing integration.

### Email Growth

- Cloudflare Email Worker code and setup scripts.
- Node email inbound proxy and outbound Resend support.
- Python email inbound/outbound, draft approval, outreach batch.
- Customer outreach queue and email runbook.

### Maps / Prospecting

- Africa-wide Maps prospecting modules and scripts.
- Lead capture into `memory/customer_gateway/*` and export reports.
- Customer master table export.

### Scheduler / Worker

- Cron files under `deploy/cron/` for social autopilot, Facebook daily, DM, friends, morning report, Zijng heartbeat.
- Launchd plists under `deploy/launchd/` and `ops/launchd/`.
- Cloudflare Worker for email routing.
- Runtime heartbeat/supervisor modules in `runtime/`.

### Autopilot

- `scripts/apsales-growth-autopilot.py`
- `scripts/apsales-social-autopilot.py`
- `scripts/apsales-zijing-run.py`
- `customer_gateway/growth_autopilot.py`
- `customer_gateway/social_autopilot.py`
- `customer_gateway/zijing_routing.py`

## Missing Capabilities

- Single policy gate for all outbound growth actions.
- Unified queue model across email, social, Maps, and drafts.
- Attribution model from social/SEO/email to website lead/conversion.
- Real CRM lifecycle states tied to leads, outreach, replies, quotes, and orders.
- TikTok publishing/analytics integration.
- Deduplicated customer identity graph across WhatsApp, email, Maps, Facebook, website forms.
- Growth experiment framework: hypothesis, channel, budget/rate limit, expected KPI, stop condition.
- Central scheduler registry showing what is installed, active, paused, and owner-approved.
- Formal data retention policy for reports/logs/customer exports.

## Duplicate Capabilities

- Social orchestration duplicated between growth autopilot, social autopilot, Facebook daily run, alternate run, and Zijng run.
- Email routing duplicated between Node server and Python customer gateway.
- Analytics internal IP filters duplicated in Node and Python.
- SEO generation split across frontend JS, Node prerender, and scripts.
- Customer reports duplicated between WhatsApp intelligence, market aggregate, morning report, and customer export.

## Current Growth Maturity

AsiaPower has many individual growth mechanisms, but not yet a controlled growth system. The raw capabilities exist: traffic tracking, SEO pages, social content, Facebook browser automation, email routing, Maps prospecting, and reports. The missing layer is governance: one queue, one approval system, one attribution model, one scheduler inventory.


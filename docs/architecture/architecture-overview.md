# AsiaPower Architecture Overview

Audit date: 2026-07-04

Scope: static repository audit only. No business code was modified, no scripts were executed, no accounts were accessed.

## System Shape

AsiaPower is currently a mixed monorepo:

- Static public website: root HTML pages, catalog directories, CSS/JS assets.
- Node inventory server: local and production HTTP servers plus `server/lib/*` business libraries.
- Python AI OS: APCOO, APSales, APInventory agents, tools, runtime, safety, audit, memory.
- Customer Gateway: WhatsApp/email/social/customer-intelligence modules under `customer_gateway/`.
- Integrations: Telegram, WeCom, Facebook browser automation under `integrations/`.
- Operational scripts: deployment, QXB import, analytics, social growth, email setup, reports under `scripts/`.
- Data and generated artifacts: `data/`, `memory/`, `reports/`, `work/`, `uploads/`.

## Major Modules

| Module | Location | Responsibility | Current status |
|---|---|---|---|
| Website / catalog frontend | `index.html`, `brands/`, `engines/`, `half-cuts/`, `trucks/`, `machinery/`, `supplier-portal/`, `js/`, `css/` | Public B2B site, half-cut catalog, brand/engine pages, supplier upload UI, admin UI | Active, broad surface area |
| Inventory server | `server/half-cut-local-server.js`, `deploy/inventory-site-server.js`, `server/lib/` | HTTP APIs, uploads, approvals, public inventory, leads, analytics, email proxy, VIN decode, CIF estimates | Active, production-critical |
| VIN / QXB integration | `server/lib/vin/`, `inventory_core/qxb_*`, QXB scripts | VIN decode, QXB import, OCR, photo selection, vehicle mapping/localization | Active but partly one-off/batch oriented |
| APSales | `sales_core/`, `profiles/apsales.yaml`, `customer_gateway/`, APSales scripts | Buyer enquiries, CRM context, sales drafting, growth, outreach | Active but over-expanded |
| APCOO | `coo_core/`, `integrations/telegram_coo_*`, `runtime/` | COO routing, planning, reporting, critic, bot operation | Active internal AI OS |
| APInventory / ZiLong | `inventory_core/`, `integrations/wecom_group_upload.py`, supplier portal | Supplier inventory ingestion, QXB/photo workflow, upload review | Active, split between Python and Node |
| Customer Gateway | `customer_gateway/` | WhatsApp intelligence, email routing/outbound, social autopilot, maps leads, draft queues | Active, highest responsibility mixing |
| Integrations | `integrations/` | Telegram, WeCom, social browser sessions and Facebook actions | Active, high operational risk |
| Growth / Traffic / Analytics | `server/lib/site-analytics.js`, `admin/analytics.html`, `scripts/analytics-*`, growth scripts, reports | Site traffic tracking, reports, social/Maps/email growth | Active but duplicated |
| Safety / audit | `safety/`, `audit/`, `truth/`, `coo_core/approval_gate.py` | Risk classification, approval logging, truth guard, recovery | Active but not consistently enforced across Node/Python/social scripts |
| Deployment / ops | `deploy/`, `ops/`, `scripts/deploy-*`, `scripts/*cloudflare*`, cron/launchd files | Server deployment, Cloudflare/Resend/WeCom setup, scheduled jobs | Active but dangerous and scattered |

## Main Call Flows

### Public website to inventory backend

1. HTML pages load shared JS (`js/components.js`, `js/config.js`, `js/seo.js`, catalog-specific JS).
2. Catalog pages call APIs such as `/api/half-cuts/public`, `/api/half-cuts/public/item`, `/api/vin/decode`, `/api/leads/*`, `/api/analytics/event`, `/api/search/record`.
3. `deploy/inventory-site-server.js` routes production APIs.
4. Shared libraries in `server/lib/` handle storage, lead validation, public redaction, media upload, analytics, VIN decode, email proxy.

### Supplier upload to inventory

1. Supplier portal pages load `js/supplier-half-cut-upload.js`, `js/half-cut-upload-layer.js`, VIN/catalog helpers.
2. Upload endpoints are handled by `server/lib/half-cut-api.js`.
3. Photo/video storage uses local files or R2 via `server/lib/media-storage.js` and `server/lib/r2-storage.js`.
4. Admin review flows use `admin/half-cut-review.html`, `js/admin-half-cut-review.js`, and `/api/half-cuts/state`.
5. Public catalog is sanitized through `server/lib/half-cut-public.js`.

### VIN / QXB path

1. Supplier upload can call `/api/vin/decode`.
2. `server/lib/vin/decode-route.js` calls `server/lib/vin/qxb-client.js`, mapping/localization, and JSON-backed knowledge base.
3. Batch QXB workflows live in `inventory_core/qxb_pipeline.py` and `scripts/qxb-*`.
4. QXB outputs land in `reports/qxb-*`, `data/qxb-photos*`, `work/qxb-agent`, and sometimes approved inventory JSON.

### AI OS path

1. `main.py`, Telegram, and WeCom entrypoints dispatch to `coo_core.dispatcher` or `coo_core.cli_router`.
2. `agents/router.py` chooses APCOO/APSales/APInventory.
3. Agent handlers use `tools/*`, constitution/profile loaders, and customer/inventory modules.
4. Persistent state is mostly JSON/JSONL under `data/`, `memory/`, `reports/`, and `audit/`.

### Customer Gateway path

1. WhatsApp read-only import/listen modules normalize inbound messages.
2. Conversation analysis, classifiers, customer profile builders, and sales intelligence write to `memory/customer_gateway` and `memory/sales_intelligence`.
3. Drafts are saved via `draft_queue.py`; email approvals can trigger outbound Resend send if enabled.
4. Growth modules generate outreach drafts, maps leads, social post queues, and progress reports.

### Social growth path

1. Scripts such as `apsales-social-autopilot.py`, `apsales-facebook-daily-run.py`, `apsales-zijing-run.py` call `customer_gateway/social_*` and `integrations/social_browser/*`.
2. Official API path exists in `customer_gateway/social_api.py`.
3. Browser fallback path uses Playwright persistent sessions under `memory/customer_gateway/social_sessions`.
4. Cron/launchd files schedule these actions.

## Deprecated / Obsolete / Likely Historical

- Root README still describes older simple static pages (`engines.html`, `gearboxes.html`) while the repo now has category directories and a Node backend.
- `reports/middle-east-africa-halfcut-market-2026-07-04.md` explicitly says obsolete due to unverified assumptions.
- `reports/africa-me-halfcut-intelligence-2026-07-04.md` says obsolete and points to morning reports.
- Several QXB preview HTML files and logs are one-time validation artifacts, not durable reports.
- `scripts/patch-*` scripts are one-off migration/repair utilities unless still referenced by a runbook.
- Older social scripts are superseded by `apsales-facebook-daily-run.py` or `apsales-zijing-run.py`, but remain callable.
- `deploy/inventory-site-server.js` and `server/half-cut-local-server.js` duplicate routing with different breadth; local server is useful, but route drift risk is high.

## Duplicate Areas

- Email routing exists in both Node (`server/lib/email-*`) and Python (`customer_gateway/email_*`).
- Analytics filtering exists in `server/lib/analytics-internal-ips.js` and `scripts/analytics-weekly-report.py`.
- Social publishing exists via official API (`social_api.py`) and browser automation (`integrations/social_browser/*`).
- Facebook work is split across daily run, browse, DM, accept friends, groups, alternate run, autopilot, and Zijng routing.
- QXB import/upload/reupload/remaining/corrected scripts overlap heavily.
- Deployment/setup exists across `deploy/`, `ops/`, `scripts/deploy-production.mjs`, Cloudflare scripts, and command files under `docs/`.
- Customer intelligence has two generations: WhatsApp gateway modules and APBRAIN/APLIVE conversation learning modules.

## Responsibilities That Are Mixed

- `customer_gateway/` mixes read-only intelligence, outbound email, social posting, maps scraping, CEO approvals, dashboard progress, and growth autopilot.
- `deploy/inventory-site-server.js` mixes static hosting, API routing, analytics, leads, email, admin auth, inventory, shipping, and legacy item/posts APIs.
- `scripts/` mixes safe local tooling, destructive deployment, production mutation, external account automation, tests, and one-off data repair.
- `reports/` mixes durable business reports, raw logs, generated previews, operational state, and large data exports.
- `docs/` mixes documentation, executable `.command` launchers, generated social assets, and backups.

## Architectural Risk Assessment

The core website and inventory catalog are substantially implemented. The weakest architectural boundary is not feature absence; it is uncontrolled operational coupling. Growth automation, customer messaging, social browser sessions, email send, and production deployment all coexist as scripts with inconsistent gates. The system needs a stabilization layer before more feature development.


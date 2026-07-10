# Scripts Audit

Audit date: 2026-07-04

Policy: static review only. No scripts were executed.

Risk scale:

- Low: local generation, static analysis, or read-only report.
- Medium: writes local project data or generated assets.
- High: touches production, network APIs, account sessions, outbound notifications, or bulk data.
- Critical: can deploy, send externally, mutate DNS/email, operate Facebook/social accounts, or alter production state.

## Script Inventory

| Script | Purpose | Still used? | Can delete? | Recommendation | Risk |
|---|---|---:|---:|---|---|
| `aggregate-market-intelligence.py` | Aggregates verified market intelligence from memory/customer data | Yes | No | Keep | Low |
| `analytics-weekly-report.py` | Builds traffic markdown/CSV from analytics JSON | Yes | No | Keep | Low |
| `analytics-weekly-report.sh` | Pulls production analytics over `scp`, then generates report | Yes | No | Keep but require operator approval | High |
| `apply-cloudflare-email-token.mjs` | Applies Cloudflare token, deploys email worker/routes | Rare/setup | No until email architecture stable | Quarantine under ops, never casual run | Critical |
| `apsales-africa-maps-scrape.py` | Scrapes Africa Google Maps leads, drafts outreach | Yes/experimental | No | Keep disabled by default | High |
| `apsales-distribution-daily-digest.py` | Sends daily APSales distribution digest | Maybe | No | Keep if notification channel active | Medium |
| `apsales-email-outreach-batch.py` | Sends CEO-approved email followups | Yes but dangerous | No | Keep behind explicit approval and env gates | Critical |
| `apsales-facebook-accept-friends.py` | Accepts Facebook friend requests | Yes | No | Keep only as manual approved action | Critical |
| `apsales-facebook-broadcast-post.py` | Posts one Facebook timeline promotion | Maybe | No | Keep disabled/manual only | Critical |
| `apsales-facebook-browse-friends.py` | Browses Facebook feed for market intel | Superseded by daily run | Possibly later | Keep for debug, mark legacy | High |
| `apsales-facebook-daily-run.py` | One-session daily Facebook actions | Yes | No | Keep but do not run automatically without approval | Critical |
| `apsales-facebook-dm-friends.py` | Sends Facebook friend DMs | Yes/experimental | No | Freeze until policy reviewed | Critical |
| `apsales-growth-autopilot.py` | Cron entry for customer finding and traffic actions | Yes | No | Keep disabled until gates unified | High |
| `apsales-maps-leads-run.py` | Google Maps prospecting fallback | Yes | No | Keep but cap and approval required | High |
| `apsales-meta-ig-setup.py` | Discovers IG business account via Meta Graph | Setup | No | Keep under ops/setup | High |
| `apsales-record-distribution-action.py` | Logs verified distribution action and notifies CEO | Yes | No | Keep | Medium |
| `apsales-seed-wave1-test-batch.py` | Registers approved social test batch | Maybe historical | Maybe | Keep until batch-001 closed | Medium |
| `apsales-social-alternate-run.py` | Alternates Facebook/X actions | Superseded/experimental | Maybe | Mark legacy unless used by `zijing-run` | Critical |
| `apsales-social-autopilot.py` | Publishes approved queue and scans replies | Yes | No | Keep disabled until official API/browser split is clarified | Critical |
| `apsales-social-login.py` | Captures social login sessions | Setup | No | Keep manual only; never cron | Critical |
| `apsales-social-reply-watch.py` | Scans/reminds about social replies | Yes | No | Keep read/notify only | High |
| `apsales-zijing-idle-heartbeat.py` | Activity heartbeat for live dashboard | Maybe | No | Keep if dashboard stays | Low |
| `apsales-zijing-run.py` | Mode-aware unified APSales growth runner | Yes | No | Keep as only orchestration entry after cleanup | Critical |
| `apsales-zijing-watch.py` | Terminal dashboard for Zijng work status | Yes | No | Keep | Low |
| `audit-site-links.mjs` | Static link checker | Yes | No | Keep | Low |
| `backfill-lead-context.mjs` | Backfills lead context | Maybe historical | Maybe | Keep until migration state documented | Medium |
| `batch-chassis-blur.py` | Batch VIN/chassis photo redaction | Yes | No | Keep, run manually with review | High |
| `build-logo-assets.mjs` | Generates logo assets | Rare | Maybe | Keep in asset tooling | Medium |
| `build-vehicle-title-lexicon.mjs` | Builds title lexicon bundle | Yes | No | Keep | Low |
| `bump-css-cache.mjs` | Updates cache-busting versions | Yes | No | Keep | Medium |
| `chassis-blur-one.py` | Blurs one chassis plate image; used by Node hook | Yes | No | Keep | Medium |
| `chassis-blur-r2.mjs` | Reads/writes R2 objects for chassis blur | Maybe | No | Keep but manual only | High |
| `check-admin-js.sh` | Syntax/regression guard for admin JS | Yes | No | Keep | Low |
| `cloudflare-email-full-setup.mjs` | Full Cloudflare email routing setup/deploy | Setup | No | Quarantine under ops | Critical |
| `cloudflare-email-routes.mjs` | Ensures Cloudflare Email routes | Setup | No | Quarantine under ops | Critical |
| `cloudflare-email-sending-probe.mjs` | Sends/probes email setup | Setup/test | Maybe | Keep until email verified, then archive | Critical |
| `deploy-domestic-lighthouse.sh` | Deploys WeCom callback to remote server | Maybe | No | Keep under deploy, require approval | Critical |
| `deploy-production.mjs` | Production deployment/rsync/restart/notify | Yes | No | Keep, but single owned deploy path only | Critical |
| `download-qxb-photos.py` | Downloads QXB photos from Excel export | Yes/batch | No | Keep | High |
| `export_customer_master_table.py` | Exports customer master table | Yes | No | Keep | Low |
| `fix-inventory-record.mjs` | Patches inventory records | Rare/manual | No | Keep with backup requirement | High |
| `generate-morning-market-report.py` | Generates morning engine-demand report | Yes | No | Keep | Medium |
| `generate-sitemap.mjs` | Generates sitemap | Yes | No | Keep | Low |
| `import-qxb-vehicles.py` | Imports QXB Excel to model dictionary | Yes/batch | No | Keep | Medium |
| `ocr-qxb-vins.py` | OCRs VIN/chassis from QXB photos | Yes/batch | No | Keep | Medium |
| `patch-brand-page-scripts.mjs` | One-off brand page patcher | Historical | Yes later | Archive after confirming no runbook needs it | Medium |
| `patch-server-cif-api.mjs` | One-off server CIF API patcher | Historical | Yes later | Archive | High |
| `patch-site-layout-assets.mjs` | One-off layout asset patcher | Historical | Yes later | Archive | Medium |
| `process-logo.py` | Processes master logo assets | Rare | Maybe | Keep in asset tooling | Medium |
| `qxb-batch-remaining.py` | Uploads remaining non-parked QXB rows | Yes/batch | No | Keep until QXB backlog complete | High |
| `qxb-batch-upload.py` | Batch QXB upload inspect/process/submit-review | Yes/batch | No | Keep | High |
| `qxb-mark-parked.py` | Marks hard QXB rows parked | Yes/batch | No | Keep | Medium |
| `qxb-retrain-vin-scan.py` | Rebuilds VIN priors and retries OCR | Yes/batch | No | Keep | Medium |
| `qxb-reupload-all-failed.py` | Rechecks/reuploads failed QXB rows | Yes/batch | No | Keep until backlog complete | High |
| `qxb-reupload-corrected.py` | Reuploads CEO-corrected rows | Yes/batch | No | Keep | High |
| `qxb-upload-approved-inventory.py` | Builds/uploads QXB approved inventory | Yes/batch | No | Keep | High |
| `resend-dns-cloudflare.mjs` | Configures Resend DNS in Cloudflare | Setup | No | Quarantine | Critical |
| `setup-cloudflare-email-worker.mjs` | Sets up Cloudflare email worker | Setup | No | Quarantine | Critical |
| `setup-email-outbound.mjs` | Sets up Resend/Cloudflare outbound email | Setup | No | Quarantine | Critical |
| `start-half-cut-local.mjs` | Starts local half-cut server | Yes/dev | No | Keep | Low |
| `start-inventory-site-local.mjs` | Starts local inventory site server | Yes/dev | No | Keep | Low |
| `sync-hreflang-batch.mjs` | Syncs hreflang blocks | Yes | No | Keep | Medium |
| `sync-seo-static-meta.mjs` | Syncs static SEO metadata | Yes | No | Keep | Medium |
| `telegram-backup-alert.js` | Sends Telegram backup alerts | Maybe | No | Keep if ops notifications active | Medium |
| `telegram-common.js` | Shared Telegram env/lib helper | Yes | No | Keep | Low |
| `telegram-daily-report.js` | Sends daily Telegram report | Maybe | No | Keep if scheduled | Medium |
| `telegram-hourly-report.js` | Sends hourly Telegram report | Maybe | No | Keep if scheduled | Medium |
| `telegram-lead-reminder.js` | Sends lead reminders | Yes | No | Keep | Medium |
| `telegram-test.js` | Sends Telegram test message | Test | Maybe | Keep but mark manual | High |
| `telegram-whatsapp-inquiry-watch.js` | Watches WhatsApp inquiry files and notifies Telegram | Maybe | No | Keep if WhatsApp pipeline active | Medium |
| `test-final-qa.mjs` | Production final QA fetch checks | Yes | No | Keep | Medium |
| `test-inventory-site-media.mjs` | Production-like media upload tests | Yes/test | No | Keep but only against test target | High |
| `test-media-upload-local.mjs` | Local media upload tests | Yes/test | No | Keep | Medium |
| `test-phase2-local.mjs` | Local phase 2 browser-mocked tests | Maybe | Maybe | Keep if still relevant | Low |
| `test-phase2.1-local.mjs` | Local VIN/masking/approval tests | Maybe | Maybe | Keep if still relevant | Low |
| `test-supplier-i18n-logo.mjs` | Supplier i18n/logo tests | Maybe | Maybe | Keep | Low |
| `verify-production.mjs` | Production HTTP verification | Yes | No | Keep, read-only but external | Medium |
| `verify-sales-domain.mjs` | Verifies/updates Resend and Cloudflare DNS/domain | Setup | No | Quarantine | Critical |
| `vin-batch-correct.js` | One-off VIN batch corrections on local copies | Historical | Maybe later | Keep until correction log closed | High |
| `vin-connectivity-test.js` | QXB VIN API connectivity test | Yes/test | No | Keep | High |
| `wecom-setup-wizard.py` | Writes WeCom env config | Setup | No | Keep manual only | High |
| `wecom-test-send.py` | Sends WeCom test message | Test | Maybe | Keep but manual only | High |
| `wecom-verify-config.py` | Verifies WeCom credentials | Setup/test | No | Keep | High |

## Immediate Script Governance Recommendations

1. Split `scripts/` into `scripts/dev`, `scripts/reporting`, `scripts/qxb`, `scripts/ops`, `scripts/growth`, `scripts/legacy`.
2. Add a top-level `scripts/README.md` with owner, allowed environment, and run authorization for each Critical/High script.
3. Disable or remove scheduler references to old Facebook scripts; keep one orchestration entry only.
4. Move Cloudflare/Resend/production deploy scripts behind an explicit `ops/` approval process.
5. Treat `patch-*` scripts and old QXB retry logs as migration artifacts and archive after backup.


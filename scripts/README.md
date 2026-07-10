# AsiaPower Scripts Index

Last updated: 2026-07-04

Purpose: single index for every script in this directory. This document is governance only; it does not change any business logic.

Do not run `High` or `Critical` scripts casually. Any script that sends messages, posts to social platforms, changes DNS/email, deploys code, touches production, or uses logged-in browser sessions requires explicit operator approval.

## Risk Levels

- `Low`: local generation, static analysis, read-only report, or local dev helper.
- `Medium`: writes local project data, generated assets, local state, or sends internal notifications.
- `High`: touches production data, network APIs, account sessions, outbound notifications, bulk imports, or R2/remote storage.
- `Critical`: can deploy, send externally, mutate DNS/email, operate Facebook/social accounts, or alter production state.

## Script Index

| Script | Purpose | Risk | Production use | Keep? | Run policy |
|---|---|---|---|---|---|
| `aggregate-market-intelligence.py` | Aggregate verified Africa/ME half-cut market intelligence from memory/customer data | Low | Reporting source | Yes | Safe local read/report |
| `analytics-weekly-report.py` | Build traffic markdown/CSV from analytics JSON | Low | Reporting | Yes | Safe when input data is local |
| `analytics-weekly-report.sh` | Pull production analytics via `scp`, then generate report | High | Yes | Yes | Approval required; read-only remote pull |
| `apply-cloudflare-email-token.mjs` | Apply Cloudflare token and deploy email worker/routes | Critical | Setup/ops only | Yes | Ops approval only; do not run from daily workflow |
| `apsales-africa-maps-scrape.py` | Scrape Africa Google Maps leads and create outreach drafts | High | Experimental growth | Yes | Approval required; keep capped/disabled by default |
| `apsales-distribution-daily-digest.py` | Generate/send APSales distribution daily digest | Medium | Maybe scheduled | Yes | Run only if notification channel is approved |
| `apsales-email-outreach-batch.py` | Send CEO-approved email followups to website leads | Critical | Yes, gated | Yes | Explicit approval and env gates required |
| `apsales-facebook-accept-friends.py` | Accept pending Facebook friend requests | Critical | Growth ops | Yes | Manual approved action only |
| `apsales-facebook-broadcast-post.py` | Post one image-rich promotion to Facebook timeline | Critical | Maybe | Yes | Manual approved action only |
| `apsales-facebook-browse-friends.py` | Browse Facebook feed for market intelligence | High | Superseded/debug | Yes | Manual/debug only; prefer daily runner if approved |
| `apsales-facebook-daily-run.py` | One-session Facebook daily action runner | Critical | Yes/experimental | Yes | Explicit approval; do not auto-run until scheduler reviewed |
| `apsales-facebook-dm-friends.py` | Send Facebook friend DMs | Critical | Experimental | Yes | Freeze unless CEO explicitly approves batch |
| `apsales-growth-autopilot.py` | Cron entry for customer finding and traffic actions | High | Intended scheduled growth | Yes | Keep disabled until outbound gate exists |
| `apsales-maps-leads-run.py` | Google Maps prospecting fallback when social is blocked/idle | High | Growth ops | Yes | Approval required; cap per run |
| `apsales-meta-ig-setup.py` | Discover Instagram Business account ID via Meta Graph API | High | Setup only | Yes | Manual setup only |
| `apsales-record-distribution-action.py` | Log verified distribution actions and notify CEO | Medium | Yes | Yes | Allowed for audit/status logging |
| `apsales-seed-wave1-test-batch.py` | Register CEO-approved wave1 test batch as pending manual posts | Medium | Historical/batch setup | Yes for now | Keep until batch-001 is closed |
| `apsales-social-alternate-run.py` | Alternate Facebook/X social actions | Critical | Superseded/experimental | Yes for now | Mark legacy; do not schedule |
| `apsales-social-autopilot.py` | Publish approved social queue and scan replies | Critical | Intended scheduled growth | Yes | Keep disabled until social policy is unified |
| `apsales-social-login.py` | Capture social login browser sessions | Critical | Setup only | Yes | Manual only; never cron |
| `apsales-social-reply-watch.py` | Watch social replies and notify CEO for follow-up drafts | High | Maybe scheduled | Yes | Read/notify only; no auto-reply |
| `apsales-zijing-idle-heartbeat.py` | Emit idle heartbeat for live Zijng dashboard | Low | Maybe scheduled | Yes | Safe status heartbeat |
| `apsales-zijing-run.py` | Unified mode-aware APSales growth runner | Critical | Yes/experimental | Yes | Prefer as only growth entry after scheduler cleanup |
| `apsales-zijing-watch.py` | Terminal status dashboard for Zijng work | Low | Ops/status | Yes | Safe read-only status |
| `audit-site-links.mjs` | Static site link checker | Low | QA | Yes | Safe local/HTTP check |
| `backfill-lead-context.mjs` | Backfill lead context fields | Medium | Migration/historical | Yes for now | Run only with backup and known input |
| `batch-chassis-blur.py` | Batch blur/redact VIN/chassis photo suffixes | High | Data repair | Yes | Manual review required |
| `build-logo-assets.mjs` | Generate logo image assets | Medium | Asset tooling | Yes | Local asset generation only |
| `build-vehicle-title-lexicon.mjs` | Build vehicle title lexicon bundle | Low | Build/support | Yes | Safe local generation |
| `bump-css-cache.mjs` | Update cache-busting versions | Medium | Release support | Yes | Local write; review diff |
| `chassis-blur-one.py` | Blur one chassis plate image; used by Node upload hook | Medium | Yes, supporting hook | Yes | Safe with reviewed image path |
| `chassis-blur-r2.mjs` | Read/write R2 objects for chassis blur | High | Data repair | Yes | Manual approval; remote object mutation |
| `check-admin-js.sh` | Syntax-check admin JS and guard known regressions | Low | QA | Yes | Safe local check |
| `cloudflare-email-full-setup.mjs` | Full Cloudflare email routing setup/deploy | Critical | Setup/ops only | Yes | Ops approval only |
| `cloudflare-email-routes.mjs` | Ensure Cloudflare Email routes | Critical | Setup/ops only | Yes | Ops approval only |
| `cloudflare-email-sending-probe.mjs` | Probe Cloudflare/Resend email sending setup | Critical | Setup/test | Yes for now | Ops approval; may send/probe externally |
| `deploy-domestic-lighthouse.sh` | Deploy WeCom callback to domestic Lighthouse server | Critical | Deployment | Yes | Deployment approval only |
| `deploy-production.mjs` | Deploy production site/server and notify | Critical | Yes | Yes | Deployment approval only |
| `download-qxb-photos.py` | Download QXB photos from Excel export | High | Batch import | Yes | Network/bulk data; run with target review |
| `export_customer_master_table.py` | Merge customer sources into one export table | Low | Reporting/export | Yes | Local read/report; treat output as sensitive |
| `fix-inventory-record.mjs` | Patch inventory records manually | High | Data repair | Yes | Backup and review required |
| `generate-morning-market-report.py` | Generate CEO morning engine-demand report | Medium | Scheduled/reporting | Yes | Safe if sources are local; scheduler review needed |
| `generate-sitemap.mjs` | Generate sitemap | Low | Build/release | Yes | Safe local generation |
| `import-qxb-vehicles.py` | Import QXB Excel rows into model dictionary | Medium | Batch import | Yes | Local data mutation; review diff |
| `ocr-qxb-vins.py` | OCR VIN/chassis numbers from downloaded QXB photos | Medium | Batch import | Yes | Local processing; review output |
| `patch-brand-page-scripts.mjs` | One-off patch for brand page script tags | Medium | Historical | Maybe archive later | Do not run unless migration is reopened |
| `patch-server-cif-api.mjs` | One-off patch for server CIF API wiring | High | Historical | Maybe archive later | Do not run unless migration is reopened |
| `patch-site-layout-assets.mjs` | One-off layout/assets patcher | Medium | Historical | Maybe archive later | Do not run unless migration is reopened |
| `process-logo.py` | Process master logo into web assets | Medium | Asset tooling | Yes | Local asset generation only |
| `qxb-batch-remaining.py` | Upload remaining non-parked QXB rows | High | Batch import | Yes | Manual batch run; review progress |
| `qxb-batch-upload.py` | Batch QXB inspect/process/upload/submit-review | High | Batch import | Yes | Manual batch run; review progress |
| `qxb-mark-parked.py` | Mark hard QXB rows as parked/deferred | Medium | Batch workflow | Yes | Local state mutation; review output |
| `qxb-retrain-vin-scan.py` | Rebuild VIN OCR priors and retry scan | Medium | Batch workflow | Yes | Local processing |
| `qxb-reupload-all-failed.py` | Recheck/reupload failed QXB rows | High | Batch workflow | Yes | Manual batch run; review logs |
| `qxb-reupload-corrected.py` | Reupload CEO-corrected QXB rows | High | Batch workflow | Yes | Manual batch run; review corrected rows |
| `qxb-upload-approved-inventory.py` | Build/upload QXB vehicles into approved inventory | High | Batch import | Yes | Manual run only; review output |
| `resend-dns-cloudflare.mjs` | Configure Resend DNS in Cloudflare | Critical | Setup/ops only | Yes | Ops approval only |
| `setup-cloudflare-email-worker.mjs` | Set up Cloudflare email worker | Critical | Setup/ops only | Yes | Ops approval only |
| `setup-email-outbound.mjs` | Set up Resend/Cloudflare outbound email | Critical | Setup/ops only | Yes | Ops approval only |
| `start-half-cut-local.mjs` | Start local half-cut dev server | Low | Dev only | Yes | Safe local dev |
| `start-inventory-site-local.mjs` | Start local inventory-site dev server | Low | Dev only | Yes | Safe local dev |
| `sync-hreflang-batch.mjs` | Sync hreflang blocks | Medium | SEO/build | Yes | Local write; review diff |
| `sync-seo-static-meta.mjs` | Sync static SEO metadata | Medium | SEO/build | Yes | Local write; review diff |
| `telegram-backup-alert.js` | Send Telegram backup alerts | Medium | Ops notifications | Yes | Notification approval required |
| `telegram-common.js` | Shared Telegram env/lib helper | Low | Support module | Yes | Not a standalone operational script |
| `telegram-daily-report.js` | Send daily Telegram report | Medium | Maybe scheduled | Yes | Notification approval required |
| `telegram-hourly-report.js` | Send hourly Telegram report | Medium | Maybe scheduled | Yes | Notification approval required |
| `telegram-lead-reminder.js` | Send lead reminders via Telegram | Medium | Maybe scheduled | Yes | Notification approval required |
| `telegram-test.js` | Send Telegram test message | High | Test only | Maybe | Manual test only |
| `telegram-whatsapp-inquiry-watch.js` | Watch WhatsApp inquiry files and notify Telegram | Medium | Maybe scheduled | Yes | Read/notify only |
| `test-final-qa.mjs` | Final production QA fetch checks | Medium | QA/release | Yes | Read-only external checks |
| `test-inventory-site-media.mjs` | Production-like media upload tests | High | QA | Yes | Use test target only; may upload |
| `test-media-upload-local.mjs` | Local media upload tests | Medium | QA/dev | Yes | Local server only |
| `test-phase2-local.mjs` | Local phase 2 smoke tests with mocked browser APIs | Low | Historical QA | Maybe | Safe local test |
| `test-phase2.1-local.mjs` | Local VIN/masking/approval tests | Low | Historical QA | Maybe | Safe local test |
| `test-supplier-i18n-logo.mjs` | Supplier i18n/logo regression checks | Low | QA | Yes | Safe local test |
| `verify-production.mjs` | Verify production HTTP/API health | Medium | Release/ops | Yes | Read-only external checks |
| `verify-sales-domain.mjs` | Verify/update Resend and Cloudflare DNS/domain | Critical | Setup/ops only | Yes | Ops approval only |
| `vin-batch-correct.js` | One-off VIN batch correction on local copies | High | Historical data repair | Yes for now | Do not rerun without backup and scope |
| `vin-connectivity-test.js` | Test QXB VIN API connectivity | High | Test/setup | Yes | External API call; approval if network/account credentials involved |
| `wecom-setup-wizard.py` | Write WeCom config into `.env` | High | Setup only | Yes | Manual setup only; inspect env first |
| `wecom-test-send.py` | Send WeCom test message | High | Test only | Maybe | Manual test only |
| `wecom-verify-config.py` | Verify WeCom credentials without sending customer messages | High | Setup/test | Yes | External credential check; approval recommended |

## Governance Notes

- Prefer `apsales-zijing-run.py` as the only future APSales growth orchestration entry after scheduler cleanup.
- Treat `patch-*` scripts as migration artifacts; archive only after confirming no runbook still references them.
- Treat Cloudflare, Resend, deployment, Facebook, WeCom send, Telegram send, and email send scripts as approval-gated operations.
- Keep QXB batch scripts until the QXB backlog and correction log are closed.
- This index is a control document. Update it whenever a script is added, archived, or promoted to production use.

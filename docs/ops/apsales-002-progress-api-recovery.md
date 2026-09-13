# APSales promotion page API recovery — 2026-09-13

Status: Completed. CEO approved; production deployed and browser verified.

## Purpose and verified cause

The production `/admin/apsales-progress.html` displays `api not found`. The current production frontend requests `/api/admin/apbd/solo-trade` and `/api/admin/apbd/native-enrichment/status`; both returned HTTP 404 during this investigation.

Release `REL-20260912031903-api-6cfc421bc` replaced the server entrypoint with an older variant. Its pre-deploy snapshot contains three APBD routes and initialization missing from the current entrypoint. The current entrypoint is byte-identical to this checkout's pre-repair `deploy/inventory-site-server.js`. The retained production `lib/apbd-admin.js` matches the previously released module (SHA-256 `084f6657412b70253f8b2b7c001cb36f2083c1e8199cd35a309e7f86242226c3`).

Read-only execution of the retained snapshot builder returned 706 linked records. This confirms records remain readable, not a complete historical data-integrity audit. No enrichment run or external send was triggered.

## Deliverables

Workspace root: `/Users/longhui/Desktop/AsiaPower`

```text
deploy/inventory-site-server.js           modified: restore module loading, controller, limiter, three routes
server/half-cut-local-server.js           modified: restore equivalent local routes
server/lib/apbd-admin.js                  added: identical to retained production module
tests/test_apbd_admin.js                  added: module and route-handler regression tests
docs/ops/apsales-002-progress-api-recovery.md added: this report
```

No page redesign. Preview URL: not applicable. Production URL: https://asia-power.com/admin/apsales-progress.html

## Validation

- Node syntax checks passed for both server entrypoints.
- Six tests passed: redaction, run argument validation, fixed subprocess invocation, both entrypoints' route presence, and execution of each entrypoint's actual APBD handler blocks with isolated dependencies (401, 200, 429, 202).
- Changed server files pass whitespace checks.
- Authenticated end-to-end production validation remains pending deployment. Handler tests use simulated dependencies; no claim of a full local service/browser test.

## Deployment and rollback impact

Restore the three APBD routes while preserving current inventory fixes. No data migration or customer prompt changes. Production deployment requires CEO approval and OPS-005 Release Manager, a clean isolated release checkout, push, backup, and validation. The existing broad `api` target also syncs other server modules and service files; review its complete planned file set against current production before using it. Do not deploy the current dirty workspace or restore the entire old server snapshot, which contains unrelated differences.

Rollback should restore only files changed by this approved repair from its own pre-deploy backup. Do not roll back customer/runtime data.

Next action: after approval, prepare the isolated release, verify scope, deploy with Release Manager, then confirm the browser loads the existing records and unauthenticated APBD access returns 401. Do not trigger enrichment merely to validate rendering.


## Approved release and completion

- Release: `REL-20260913181806-api-apbd-a912b70c6`
- Production commit: `a912b70c6a88781864c467b144d8e07bdb9fccdf`
- Clean release checkout: `/Users/longhui/Desktop/AsiaPower-apsales-progress-recovery`
- Branch: `codex/apsales-progress-recovery-20260913` (pushed to origin).
- Added scoped `api-apbd` target in `scripts/deploy-production.mjs` and `scripts/lib/release-manager.mjs`; exactly server.js and lib/apbd-admin.js are published/snapshotted. Three differing production prerender/SEO modules and package-lock.json were excluded by this scope.
- `scripts/release-restore.mjs` now restarts the service for this target after restoring its two snapshots. This tooling-only follow-up does not change deployed server code.
- Backup: `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260913-181808.tar.gz`.
- Release record: `releases/REL-20260913181806-api-apbd-a912b70c6/release.json` in the release checkout and production inventory-site directory.
- Preflight: clean, pushed, valid target, two source files, approval, backup; all passed.
- Postflight: nginx configuration, critical public URLs, and both service states; all passed.
- Seven local tests passed (six module/handler tests and one release scope test).
- Live unauthenticated GET solo-trade, GET enrichment status, and POST enrichment run all returned HTTP 401. The unauthorized POST performed no enrichment.
- Existing authenticated Chrome admin tab displayed the populated APBD workbench, 745 / 745 customer rows, and selected customer evidence. This is a later live snapshot than the earlier 706-record diagnosis; no customer records were modified by this repair.
- In-app browser without a login correctly displayed the Admin login prompt instead of `api not found`.
- Production UI/frontend was not redeployed. No authenticated enrichment start or external send was performed.

Next action: none required for this incident. Retain this fix when merging future API releases; broad releases still require comparison against the actual deployed files.

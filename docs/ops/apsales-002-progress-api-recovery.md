# APSales promotion page API recovery — 2026-09-13

Status: Local repair validated; production deployment pending CEO approval.

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

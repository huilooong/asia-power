# OPS-007 — Supplier Referral Codes

**Status:** Completed and deployed  
**Date:** 2026-08-28  
**Production release:** `REL-20260828114843-api-5e2be1a9d`  
**Branch:** `codex/supplier-referral-v1`

## Purpose

Give every registered supplier a stable, reusable personal referral code and retain durable attribution for every future supplier registration. Administrator accounts are also eligible so AsiaPower staff can invite suppliers directly.

The historical phone-bound, one-time AsiaPower admission code remains supported. The registration endpoint now requires either a personal referral code or the existing AsiaPower admission code in both password and SMS OTP modes.

## Deliverables

| Deliverable | Path |
|---|---|
| Referral code and attribution store | `server/lib/supplier-referrals.js` |
| Registration integration | `server/lib/phone-otp-auth.js` |
| Production and local API wiring | `deploy/inventory-site-server.js`, `server/half-cut-local-server.js` |
| Dry-run/apply backfill tool | `scripts/backfill-supplier-referral-codes.mjs` |
| Safety and registration tests | `tests/supplier-auth-safety.test.js` |
| CEO UI preview | `docs/previews/supplier-referral-codes-v1/supplier-referral-codes-preview.html` |

## Production behavior

- Personal code format: `AP-XXXX-XXXX`, case-insensitive and tolerant of omitted hyphens.
- One active reusable code per supplier or administrator account.
- A newly registered supplier receives its own personal code automatically.
- New supplier user rows retain `referredByUserId`, `invitationSource`, `invitationId`, and `referredAt`.
- The private attribution event store records inviter, invitee, invitation source, and registration time.
- `GET /api/supplier/referral-code` returns only the signed-in supplier or administrator's code.
- `GET /api/admin/supplier-referrals` returns the complete code and attribution audit to administrators only.
- Both new endpoints return HTTP `401` without a signed-in session.
- Code and attribution files use mode `0600`.

Historical registrations were not assigned invented inviters. Existing accounts received personal codes, but attribution begins with registrations completed after this release.

## Production migration result

| Check | Result |
|---|---:|
| Registered suppliers | 38 |
| Administrators eligible to invite | 2 |
| Eligible accounts | 40 |
| Active referral codes | 40 |
| Unique code values | 40 |
| Unique code owners | 40 |
| Private file mode | `0600` |

The verified personal code for the administrator account named `惠龙` was returned directly to the CEO and is intentionally excluded from Git history and this report.

## Validation

- `node --check`: deployment script, migration script, production server, local server, auth module, and referral store passed.
- Node test suite: **40 passed, 0 failed**.
- Registration safety tests cover stable/reusable codes, supplier and admin backfill, legacy one-time admission codes, inviter attribution, new-owner code creation, and invitation enforcement in SMS OTP mode.
- Browser preview: desktop and 390 px narrow viewport verified; narrow page width remained equal to viewport and the attribution table scrolls inside its card.
- Browser console: no warnings or errors.
- Production: referral backfill **40/40**, Nginx configuration pass, inventory service active, critical URL validation pass, public release ID pass.

## Release evidence and rollback

Successful release:

- Release ID: `REL-20260828114843-api-5e2be1a9d`
- Git commit deployed: `5e2be1a9db778479464cd79520a1000876762c44`
- Backup: `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260828-114845.tar.gz`
- Restore: `RESTORE_CONFIRM=REL-20260828114843-api-5e2be1a9d node scripts/release-restore.mjs REL-20260828114843-api-5e2be1a9d`
- Release record: `releases/REL-20260828114843-api-5e2be1a9d/release.json`

Two earlier attempts were not reported as successful:

1. `REL-20260828114338-api-af97ea39d` stopped because validation read the referral file before the startup backfill completed. The readiness check now waits for the non-empty file.
2. `REL-20260828114518-api-93e314b21` completed functional checks but failed on a stale Cloudflare `config.js` release marker. The successful release observed the new marker after cache expiry. The configured Cloudflare purge credentials returned an authentication warning and should be repaired separately.

## Deployment impact

Backend and data-model behavior is live. No production portal UI was changed in this release. A supplier can use the existing required invitation-code field immediately; the field accepts the new personal code.

The production `npm install` audit reported four high-severity dependency advisories. They were not introduced or auto-fixed by this task; dependency remediation requires a separate compatibility review.

## UI review gate

The production UI addition remains behind CEO review, in accordance with the engineering standard. The preview proposes:

- a “My referral code” card in the supplier workspace;
- clearer registration wording for personal referral code versus AsiaPower admission code;
- an administrator attribution table.

Preview URL: `http://127.0.0.1:8765/docs/previews/supplier-referral-codes-v1/supplier-referral-codes-preview.html`

## File tree

```text
docs/
├── ops/ops-007-supplier-referral-codes.md
└── previews/supplier-referral-codes-v1/
    └── supplier-referral-codes-preview.html
scripts/
└── backfill-supplier-referral-codes.mjs
server/lib/
├── phone-otp-auth.js
└── supplier-referrals.js
tests/
└── supplier-auth-safety.test.js
```

## Next recommended task

Approve or revise the UI preview, then implement and deploy the supplier self-service card and administrator attribution view through the `portal` and `admin` Release Manager targets.

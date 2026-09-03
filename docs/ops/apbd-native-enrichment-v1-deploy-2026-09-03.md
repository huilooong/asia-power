# APBD Native Enrichment v1 — Production Deployment

## Outcome

- Branch: `codex/apbd-native-enrichment-v1`
- Deployed commit: `9623f4398afc06002f078edbcd429ba8672519a0`
- Production page: `https://asia-power.com/admin/apsales-progress.html`
- External sending remained disabled. No Gmail draft or message was created.

## Delivered

- APBD Solo Trade campaign workflow, public-source discovery, evidence scoring, optional Hunter/Apollo adapters, APBD bridge, draft-only outreach gates and exports.
- First-party `apbd-native-enrichment-v1` validation for observed public emails, official-domain relationship, DNS reachability, role mailboxes and evidence-backed people.
- Authenticated Admin read/status/run APIs with a four-runs-per-hour limiter and a fixed no-shell background command.
- Admin Promotion page with APBD and APSales tabs, a redacted 23-lead queue, provider truth, filters, evidence detail and a two-step Native run confirmation.

## Validation

- Python: 48 relevant tests passed.
- Node: 4 Admin adapter/route/safety tests passed.
- Syntax: Admin JavaScript, API servers, adapter and release scripts passed syntax checks.
- Redaction: Admin snapshot contained no email address, API key or raw provider contact.
- Browser: 1280 px and 390 px layouts had no document-level horizontal overflow and no browser errors; APSales tab loaded correctly.
- Production: Admin HTML/CSS/JS returned HTTP 200; unauthenticated Admin APIs returned HTTP 401; `inventory-site.service` and Nginx were active.
- Production server-side snapshot: 23 leads, 23 linked APBD companies, no exposed email/API key, and zero sent messages.

## Production data merge

- Campaign `solo-3fea1234bd`: 23 leads linked, 23 created, 0 existing records overwritten.
- Merge backup: `/root/.openclaw/workspace/AsiaPower/runtime/apbd/backups/solo-trade-import-20260903T132321Z`
- Native-enrichment backup: `/root/.openclaw/workspace/AsiaPower/runtime/apbd/leads/backups/companies-before-native-enrichment-20260903T132340Z.json`
- Native result: 23 companies checked; 16 public emails; 15 official-domain matches; 1 free mailbox; 10 role mailboxes; 0 evidence-backed named decision makers; 0 send-eligible; 0 sent.

## Releases and rollback

- APBD: `REL-20260903131317-apbd-9623f4398` — passed. Backup: `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-data-20260903-131320.tar.gz`
- Admin: `REL-20260903131707-admin-9623f4398` — passed. Backup: `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260903-131709.tar.gz`
- API: `REL-20260903131927-api-9623f4398` — service and functional checks passed; the immediate Release Manager run was marked failed only because Cloudflare still served the previous Release ID during its 60-second TTL. Follow-up OPS-003 validation after expiry passed 129 checks with 0 failures and is archived under the release's `revalidation/` directory. Backup: `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260903-131929.tar.gz`

Release rollback uses:

```text
RESTORE_CONFIRM=<RELEASE_ID> node scripts/release-restore.mjs <RELEASE_ID>
```

The production data merge can be restored independently from the two APBD runtime backups above.

## Known warnings

- Local Cloudflare purge credentials were unavailable. The 60-second cache expired naturally and the follow-up validation passed.
- `npm audit` reported four existing high-severity dependency findings during the API deployment. No forced dependency upgrade was performed in this release.
- Browser production data view still requires an Admin login. The unauthenticated boundary was verified in the browser; the full redacted payload was verified directly on the production server.

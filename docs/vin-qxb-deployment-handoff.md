# VIN / QXB Integration — Deployment Handoff

Status as of 2026-06-27: **interface + knowledge base infrastructure complete and verified with 1 real VIN. No inventory data has been touched. No batch correction has happened. Do not start batch correction without explicit user confirmation.**

This document is the handoff point between "local interface build" (done) and "server-side batch validation + correction" (not started). Read this fully before doing anything with real inventory data.

---

## 1. What's done

- QXB VIN decode API client — confirmed working, real signature scheme implemented.
- JSON-backed Vehicle Knowledge Base, behind a Repository abstraction (swappable for Supabase/Postgres later without touching business code).
- Mapping Layer draft (QXB raw fields → AsiaPower vehicle schema) — built from exactly **one** real response.
- Chinese → English display localization layer, with a small verified seed dictionary + a generic rule for BMW/Mercedes-Benz alphanumeric series names. Unknown values fall through to the Unknown Queue instead of being guessed.
- A connectivity test script.

## 2. File map

| Module | Path |
|---|---|
| Generic JSON repository abstraction | [server/lib/vin/repository.js](../server/lib/vin/repository.js) |
| Knowledge base (dictionaries, cache, unknown queue, mapping history) | [server/lib/vin/knowledge-base.js](../server/lib/vin/knowledge-base.js) |
| QXB API client + confirmed signing | [server/lib/vin/qxb-client.js](../server/lib/vin/qxb-client.js) |
| Mapping Layer (QXB fields → AsiaPower schema) | [server/lib/vin/mapping-layer.js](../server/lib/vin/mapping-layer.js) |
| Chinese→English display translation | [server/lib/vin/localize.js](../server/lib/vin/localize.js) |
| Manual-seed translation dictionary (verified entries only) | [server/lib/vin/zh-en-seed.js](../server/lib/vin/zh-en-seed.js) |
| Connectivity test script | [scripts/vin-connectivity-test.js](../scripts/vin-connectivity-test.js) |
| Knowledge base data files (created on first use) | `data/knowledge-base/*.json` |
| Existing JSON store helper reused for atomic writes + `.bak` | [server/lib/json-store.js](../server/lib/json-store.js) |

None of the existing inventory files were modified: `data/half-cut-submissions.json`, `data/half-cut-approved.json` are untouched.

## 3. `.env` variables required

Already added to [.env.example](../.env.example):

```
QXB_APPID=
QXB_SECRET=
```

On the server, copy real values into `.env` (never commit `.env`). Confirmed real credentials exist in `接口授权-2026.6.27.xlsx` (sent by the vendor) — do not hardcode them anywhere in source.

## 4. Confirmed API call shape (do not re-derive — already verified against the real server)

- Endpoint: `http://open-api2.0.nanxinwang.com`
- Path: `/VinDecoder/decode` (乘用车精准解码版 — **this is the only interface this account is authorized for**; `/VinDecoder/decodeNormal` returns `number:-6` unauthorized, do not use it)
- Method: `POST`, `Content-Type: application/x-www-form-urlencoded`
- Required params: `appid`, `version` (must be `"4.6.0"` for this path — `"1.0.0"` gives `number:-11` version error), `timestamp` (unix seconds), `sign`, plus the interface param `vin`
- Signing: collect `{appid, version, timestamp, secret, ...interfaceParams}`, drop empty-string values and `callback`, sort keys ASCII-ascending, urlencode each value, join as `k=v&k=v...`, MD5, uppercase. `secret` is used only to compute `sign` — never sent in the actual request.
- All of this is implemented in `buildSignedParams()` / `decodeVin()` in `qxb-client.js`. Don't reimplement — reuse it.

## 5. Running the connectivity test on the server

```bash
node scripts/vin-connectivity-test.js <VIN>
```

- Requires `QXB_APPID`/`QXB_SECRET` in `.env`.
- Defaults to the placeholder test VIN (`MR0BA3CD500123456` from the `SUB-TEST` submission record) if no argument given — that VIN is **not real inventory**, connectivity-only.
- Prints the full request (sign included, secret redacted) and full raw response.
- Automatically checks `data/knowledge-base/vin-cache.json` first and skips the API call if that VIN was already decoded — delete the relevant entry (or the whole file) if you need to force a fresh call.

## 6. How to sample-test 5–10 real inventory VINs (next step, not yet done)

1. Pull real VINs from whatever the server's actual inventory source is at that point (check `data/half-cut-submissions.json` and `data/half-cut-approved.json` for entries with a 17-character `vin` field that are **not** test/placeholder records — i.e., real supplier name, real photos, not `SUB-TEST`).
2. For each VIN, run `node scripts/vin-connectivity-test.js <VIN>` (or write a small batch wrapper that loops over them and calls `decodeVin` directly via `server/lib/vin/qxb-client.js` — don't duplicate the signing logic).
3. For each result, run it through `applyMapping()` ([mapping-layer.js](../server/lib/vin/mapping-layer.js)) and `localizeForDisplay()` ([localize.js](../server/lib/vin/localize.js)).
4. Produce a report per VIN: VIN, existing inventory record (if any), raw API response, mapped fields, localized fields, anything that landed in the Unknown Queue.
5. **Show this report to the user and get explicit confirmation before touching any inventory file.** This mirrors what was done locally with the single real VIN `LGBN22E28AY002810` — see `data/knowledge-base/vin-cache.json` and the conversation history for that precedent.

## 7. How to view the VIN Cache

```bash
cat data/knowledge-base/vin-cache.json
```

Or programmatically:
```js
const { createVehicleKnowledgeBase } = require('./server/lib/vin/knowledge-base');
const kb = createVehicleKnowledgeBase(path.join(rootDir, 'data'));
kb.getCachedVin('SOME17CHARVIN0000');
```
Every successful decode is cached by VIN so the same VIN is never re-requested (saves API quota/cost).

## 8. How to view the Unknown Queue

```bash
cat data/knowledge-base/unknown-queue.json
```

Or:
```js
kb.listUnknown('pending'); // unresolved items needing human review
```

Each item has `type` (`brand` | `model` | `fuel_type` | `drivetrain`), the raw value seen, the VIN it came from, and `status: 'pending'`. After human review, resolve with:
```js
kb.resolveUnknown(itemId, { status: 'approved' | 'rejected', reviewedBy: 'name' });
```
Approving an item does **not** automatically write it into the dictionaries yet — that wiring (auto-learn after approval) is not built. Whoever does the server-side batch pass should decide whether to add that wiring or keep dictionary updates manual via `kb.learnBrand()`/`kb.learnModel()`/etc.

## 9. How to view Mapping results

- `data/knowledge-base/vehicle-mapping.json` — `fields` is the active mapping (currently empty/draft state in code, not yet promoted via `recordMappingDecision()`), `history` is every before/after change ever made to it, `note` is a free-text log of what's been tried/learned (currently documents the auth-discovery process and the one real test).
- The actual field-mapping logic lives in code, not just data: [mapping-layer.js](../server/lib/vin/mapping-layer.js) `DIRECT_FIELD_MAP` and `NEEDS_DICTIONARY`. This is intentional — the JSON file tracks *decisions and history*, the code is the executable mapping itself.
- To see a mapping result for a cached VIN:
  ```js
  const { applyMapping } = require('./server/lib/vin/mapping-layer');
  const cached = kb.getCachedVin('SOME17CHARVIN0000');
  console.log(applyMapping(cached.rawResponse));
  ```

## 10. Conditions to enter batch inventory correction

Do **not** start batch correction until ALL of the following are true:

1. At least 5–10 real inventory VINs have been sample-tested (Section 6) and the report has been shown to and confirmed by the user.
2. The Mapping Layer's `DIRECT_FIELD_MAP` has been validated against those samples (not just the single VIN it was drafted from).
3. The Unknown Queue items from the sample have been reviewed by a human and either approved into the dictionaries or rejected.
4. The user has explicitly said to proceed with batch correction — a generic "looks good" on the sample report is not sufficient; get an explicit go-ahead for the batch step specifically.

## 11. Required backups before any batch correction

- `server/lib/json-store.js`'s `saveJsonAtomic()` already keeps a `.bak` of the previous version on every write — this is already wired into the Repository layer, so every knowledge base write is auto-backed-up. Verify this is *also* used for the actual inventory files being corrected (`half-cut-submissions.json`, `half-cut-approved.json`) — if the batch-correction script writes through `loadJson`/`saveJsonAtomic`, this is automatic.
- In addition, before running ANY batch write to inventory: copy the full `data/` directory to a timestamped backup folder (e.g. `data/_backups/pre-vin-correction-<timestamp>/`) so there's a known-good snapshot beyond the single `.bak` rotation.
- Every batch-correction run must log Before → After per record (per field changed) somewhere durable — extend `vehicle-mapping.json`'s `history` pattern, or write a dedicated `data/knowledge-base/correction-log.json`, so every change is traceable and reversible.
- Fields that must NEVER be touched by any correction logic, no matter what the API returns: price, supplier info, photos, inventory status, review status, notes, any business-only metadata. The mapping layer doesn't currently even read these fields, which is correct — keep it that way.

## 12. Where the next Agent should start

1. Read this file fully, then read `data/knowledge-base/vehicle-mapping.json`'s `note` field for the live state of auth/mapping discovery.
2. Confirm `.env` has real `QXB_APPID`/`QXB_SECRET` on the server.
3. Run `node scripts/vin-connectivity-test.js` with the placeholder VIN first, just to confirm the deployed environment can reach the API (network/firewall sanity check) — this should still succeed against `decode`/v4.6.0.
4. Find real VINs in the server's actual inventory data (Section 6, step 1).
5. Run the 5–10 VIN sample test, produce the report, **stop and get user confirmation** before writing anything.
6. Only after confirmation: design the batch-correction script with backups (Section 11), and run it.
7. After any successful batch run, update the knowledge base dictionaries with newly confirmed brand/model/fuel/drivetrain mappings, and update this handoff doc's "Status" line at the top.

## Reusable capabilities established this phase

- A general-purpose JSON Repository pattern (`repository.js`) that any future AsiaPower knowledge-base-style feature can reuse without re-deriving the atomic-write/backup pattern.
- A confirmed, documented signing algorithm for the QXB platform — this generalizes to *any* other QXB interface (not just VIN decode), since the signing spec is platform-wide, not endpoint-specific. If AsiaPower later licenses another QXB interface (e.g. vehicle valuation `/api/car/valuation`, mentioned in the vendor's signing-spec example), `buildSignedParams()` can be reused as-is.
- A "verify against official sources, don't guess" workflow for building translation dictionaries — demonstrated for vehicle brand/model names, generalizable to engine codes, gearbox codes, or any other vocabulary AsiaPower needs to localize.
- The Unknown Queue / dictionary-learning pattern is generic enough to extend to engine and gearbox vocabularies, not just brand/model — the same `learnEngine`/`learnGearbox` methods already exist in `knowledge-base.js`, just unused so far.

**Code is the Deliverable. Knowledge is the Asset.** — this document plus `data/knowledge-base/vehicle-mapping.json` are the durable record of what was learned this phase; the code is just the executable form of that knowledge.

# OPS-006 Website Traffic Remediation

**Status:** P0 guardrails implemented and validated locally; production deployment not executed.

## Outcome

The traffic diagnosis is actionable, but the live environment still has two release-integrity failures:

- Cloudflare returns `max-age=14400` for `config.js`, `components.js`, `pwa-app-shell.js`, and `sw.js`; the origin returns the intended `max-age=60`.
- Live `config.js` still reports `releaseId: local-dev` while the recorded release expected `REL-20260725093954-api-984a51638`.

The existing post-release validator reported these as passes or non-blocking warnings. This change makes them hard failures for future public releases.

## Implemented

- Added a 301 compatibility redirect from `/engines/contact.html` to `/contact.html`, preserving the query string.
- Added `/used-cars/detail.html` to sitemap sample classification and legacy half-cut redirect validation.
- Added public cache-policy checks for the critical release assets; they must expose `max-age=60`.
- Made release-ID stamping verify the actual stamped value instead of treating a shell marker alone as success.
- Added regression tests for used-car route coverage and cache-policy detection.

## Validation

- Local syntax checks: passed.
- Local regression tests: 4 passed.
- Live read-only OPS-003 validation: 124 passed, 5 failed as intended on the current production drift.
- No production files, Cloudflare settings, or cache entries were changed.

## Production gate

Before deployment, CEO review is required for the SEO/production change, followed by the Release Manager flow with backup, validation, and rollback evidence. Cloudflare must also be configured or manually purged for the four critical assets.

## Files

- `deploy/inventory-site-server.js`
- `scripts/lib/post-release-validation.mjs`
- `scripts/lib/release-manager.mjs`
- `tests/post-release-validation.test.mjs`

# Supplier Inventory Management V1 — Production Implementation Report

Date: 2026-08-23
Branch: `codex/supplier-inventory-management-v1`

## Delivered boundary

- Suppliers can list and open only inventory owned by their authenticated supplier account.
- Price, inventory status, and public/delisted visibility update immediately and are audit logged.
- Brand, model, year, VIN, mileage, core specifications, photos, and video are stored as a revision and require admin approval. The currently approved public record remains live until approval.
- Photo/video order, cover priority, additions, and removals are editable. Video is the preferred cover; the first ordered photo is the fallback.
- Removed approved media is copied to a private evidence archive before its public copy is removed. The evidence endpoint requires authentication and ownership/admin authorization.
- “Delete” is implemented as recoverable delisting. It does not delete the inventory record or its media.
- Suppliers cannot set or remove verification status.
- Vehicle brand presentation in the supplier editor is uppercase without rewriting the official brand translation dictionaries.
- China-based supplier access does not require Google or WhatsApp.
- When SMS OTP is disabled, supplier registration requires a one-time, phone-bound admin invitation. A phone number alone cannot reset an existing password.

## Files and components

### API and data services

- `server/lib/half-cut-api.js`
- `server/lib/half-cut-public.js`
- `server/lib/inventory-revisions.js`
- `server/lib/inventory-audit-log.js`
- `server/lib/media-evidence-archive.js`
- `server/lib/supplier-invites.js`
- `server/lib/phone-otp-auth.js`
- `server/lib/phone-password-auth.js`
- `server/lib/supplier-gate.js`
- `server/lib/r2-storage.js`
- `server/lib/sitemap.js`
- `deploy/inventory-site-server.js`
- `server/half-cut-local-server.js`

### Supplier and admin UI

- `supplier-portal/dashboard.html`
- `js/supplier-dashboard.js`
- `css/portal-app.css`
- `login/index.html`
- `js/login.js`
- `admin/inventory.html`
- `js/admin-review-cards.js`
- `js/admin-supplier-invites.js`
- `css/admin-v4.css`

### Deployment and validation

- `scripts/deploy-production.mjs`
- `scripts/lib/release-manager.mjs`
- `tests/supplier-inventory-revisions.test.js`
- `tests/supplier-auth-safety.test.js`
- `tests/fixtures/supplier-dashboard-preview-server.mjs`

## Preserved contracts

- Public URLs, slugs, SEO routes, existing stock IDs, enquiry endpoints, and quote logic are unchanged.
- Approved inventory remains the source of truth for public catalog/detail rendering.
- Existing inventory data is not migrated or rewritten by this release.
- Trusted batch upload remains available only through the existing key plus trusted-IP path; a raw browser key is not treated as a supplier identity.
- Existing uncommitted files outside this boundary are excluded from the commit and deployment worktree.

## Risk controls

- Revision approval merges only review-controlled fields; it preserves the latest immediate price, status, visibility, ownership, and stock identity.
- Public catalog, detail, prerender, and sitemap all suppress delisted records.
- Private evidence metadata and invite-code hashes are stored with restrictive file permissions.
- The invitation code is displayed once; admin history stores only a hint, never the raw code.
- Production deployment must use Release Manager snapshots and a clean, pushed commit.

## Rollback

1. Use the Release Manager recovery metadata for the API, portal, and admin release IDs.
2. Restore the captured remote files/service snapshot for the failed target.
3. Existing approved inventory JSON is backward compatible; revision, evidence, audit, and invitation files can remain dormant if the previous application version is restored.
4. If a revision was approved after deployment, roll back the individual inventory record from the Release Manager/data backup instead of deleting audit or evidence history.

## Acceptance criteria

- Supplier A cannot view or change Supplier B inventory.
- Immediate fields publish without promoting unapproved critical changes.
- A later price/status update cannot overwrite a pending revision.
- Approval promotes the revision while retaining the newest price/status.
- Rejection leaves the current public record unchanged.
- Delisting removes the item from public list, detail, sitemap, and prerender without deleting the record.
- Removed approved media is archived before public removal and remains available only through an authenticated evidence route.
- New supplier registration without SMS rejects missing, wrong-phone, expired, or reused invitations.
- Existing password reset rejects phone-only requests when SMS OTP is unavailable.
- Desktop and mobile supplier inventory list/editor have no console errors and preserve video-first cover behavior.

## Validation record before deployment

- JavaScript syntax checks: pass.
- Supplier inventory/auth focused tests: 6/6 pass.
- Client/API route audit: pass, no missing `/api/half-cuts/*` handlers.
- Public privacy, delisted prerender, export-used-car title, and post-release validation tests: pass.
- PWA regression: pass, 0 failures.
- Two broader repository checks fail identically on clean `HEAD` and the working tree: historical `components.js` cache-key drift and three legacy supplier i18n/logo assertions. They are baseline issues, not regressions introduced by this implementation.

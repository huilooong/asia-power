# Half-Cut Phase 2 — Backend Mapping (Future)

Local demo layers map to production storage as follows.

## localStorage → JSON files (Option A)

| localStorage key | Server file | Purpose |
|------------------|-------------|---------|
| `halfCutSubmissions` | `data/half-cut-submissions.json` | Pending / approved / rejected submissions |
| `halfCutApprovedInventory` | `data/half-cut-inventory.json` | Published catalog records |
| Photo `dataUrl` blobs | `uploads/half-cuts/{submissionId}/` | Image files on disk |

## localStorage → Supabase (Option B)

| Demo object | Supabase table | Notes |
|-------------|----------------|-------|
| Submission record | `half_cut_submissions` | Includes full VIN, `decode_method`, `review_status` |
| Photo metadata | `half_cut_photos` | FK to submission; URL points to Storage |
| Approved inventory | `half_cut_inventory` | Public feed; `vin` column admin-only |
| — | Storage bucket `half-cut-photos` | Replaces base64 `dataUrl` |

## Layer responsibilities

| Layer | File | Future API |
|-------|------|------------|
| Upload | `js/half-cut-upload-layer.js` | `POST /api/half-cuts/submissions` |
| Review | `js/half-cut-review-layer.js` | `POST .../approve`, `POST .../reject` |
| Inventory | `js/half-cut-inventory-layer.js` | `GET /api/half-cuts/public` (VIN stripped) |
| VIN | `js/half-cut-vin.js` | Server-side decode service |

## VIN security rule (production)

- Full VIN: stored in submissions + inventory tables (restricted columns).
- Public API: `maskedVin` only via `HalfCutInventoryLayer.toPublicItem()`.
- Never expose full VIN in sitemap, JSON-LD, or WhatsApp templates.

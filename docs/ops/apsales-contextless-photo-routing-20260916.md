# APSales contextless photo routing repair

## Incident

On 2026-09-16 a customer sent an image in a WhatsApp conversation that the
bridge had no saved deal context for. OCR found no vehicle nameplate facts. The
deterministic fallback assumed the image was a failed VIN submission and asked
for a chassis nameplate. The human operator immediately took over and continued
the actual headlamp discussion.

## Root cause and change

`decidePlateFailureReply()` treated every OCR-failed image with empty deal state
as a VIN/nameplate attempt. It now asks for the part and vehicle make, model and
year, and requests a label close-up only when relevant. Existing behavior is
preserved when a part intent or confirmed vehicle identifier already exists.
Short-window duplicate suppression remains active.

## Files

- `deploy/apsales-live-draft/apsales-human-visibility.mjs`
- `tests/test_plate_failure_reply.js`
- `docs/ops/apsales-contextless-photo-routing-20260916.md`

## Validation and rollback

The targeted regression covers the observed empty-context image path, duplicate
suppression, escalation, known part intent and confirmed vehicle paths. The
production change must use the `apsales-openclaw` Release Manager target, which
snapshots the bridge modules and records the restore command. No customer test
message is sent.

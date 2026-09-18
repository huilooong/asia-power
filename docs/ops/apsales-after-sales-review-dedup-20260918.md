# APSales after-sales review reply deduplication

## Incident

On 2026-09-17 a customer reported that an installed engine had locked and asked
about replacement or refund. The bridge correctly routed the complaint to human
review, but then sent the same acknowledgement for three stacked images and a
follow-up question within about two minutes. The human takeover guard worked as
soon as the operator replied, but the earlier repeated acknowledgements were
unnecessary.

## Change

The bridge still records every inbound message and appends every human-review
request. For after-sales incidents, it now sends one customer acknowledgement
and one operator alert during a ten-minute review window. Additional text or
media in that window is retained without another automatic reply or alert. A
new incident after the window receives a fresh acknowledgement.

This does not alter global sending, pricing, refunds, or human takeover. No
customer test message is used.

## Files and validation

- `deploy/apsales-live-draft/apsales-turn-policy.mjs`
- `deploy/apsales-live-draft/bridge.mjs`
- `tests/test_apsales_reply_control.mjs`

The regression reproduces a five-message incident stack and verifies one reply
inside the window plus a fresh reply after expiry. Production deployment uses
the `apsales-openclaw` Release Manager target, with snapshots and restore data.

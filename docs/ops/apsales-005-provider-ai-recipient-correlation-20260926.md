# APSales provider-AI recipient correlation — 2026-09-26

## Problem

The provider-AI quarantine worked, but WhatsApp could not translate six newly
observed provider messages from at least one LID-backed chat to E.164. Their
private quarantine records therefore stored `recipient_e164: null`, which can
collapse distinct conversations into one unknown-recipient bucket during
monitoring.

## Change

`deploy/apsales-live-draft/bridge.mjs` now stores the private WhatsApp chat JID
alongside E.164 and derives `recipient_identity` from E.164 first, then the chat
JID. The quarantine boundary, global owner pause, customer send path and
reusable-evidence exclusion are unchanged.

## Validation and release

- Run `node --check deploy/apsales-live-draft/bridge.mjs`.
- Run the complete APSales Node test set.
- Deploy only through Release Manager target `apsales-openclaw` after commit and
  push.
- Verify the global pause revision remains
  `dbfb7f53-3ab8-42fd-a009-44c269a73635` and do not send a customer test
  message.

Rollback uses the Release Manager restore command recorded by the deployment.

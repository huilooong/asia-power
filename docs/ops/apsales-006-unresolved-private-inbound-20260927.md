# APSales unresolved private inbound retention — 2026-09-27

## Problem

The bridge labelled every inbound message without a resolved E.164 number as
`non-customer`. Four direct `@lid` messages were dropped from review during the
latest heartbeat even though a private LID can belong to a real customer.

## Change

Direct `@lid` messages without E.164 are now retained in
`memory/customer_gateway/unresolved_private_inbound.ndjson` with
`awaiting_identity_resolution`. They cannot trigger an automatic reply and are
excluded from reusable evidence. Groups, broadcasts and resolved-number chats
keep their existing behavior.

## Validation and release

- Run the complete APSales Node test set.
- Deploy only through Release Manager target `apsales-openclaw`.
- Verify global pause revision `dbfb7f53-3ab8-42fd-a009-44c269a73635` remains
  active and send no customer test message.


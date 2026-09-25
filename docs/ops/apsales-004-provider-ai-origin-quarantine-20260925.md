# APSales provider-AI origin quarantine — 2026-09-25

## Purpose

The WhatsApp bridge treated every non-bridge `fromMe` message as a human team reply. Meta-hosted WhatsApp Business Agent messages use `CE...` message IDs, so provider-generated replies entered `team_replies` and, in three observed cases on 2026-09-25, were also stored as reusable sales evidence. This happened while the owner-wide APSales reply pause remained active.

## Deliverables

- `deploy/apsales-live-draft/apsales-human-visibility.mjs`
  - Classify `CE...` outbound IDs as `provider_ai` after the exact bridge-echo check.
  - Exclude historical `CE...` entries from the human-team prompt context.
- `deploy/apsales-live-draft/bridge.mjs`
  - Quarantine provider-AI outbound messages to `memory/customer_gateway/provider_ai_outbound.ndjson`.
  - Do not append them to human `team_replies` or reusable evidence.
- `tests/test_apsales_reply_control.mjs`
  - Regression coverage for provider-AI classification, human-reply preservation, inbound preservation and prompt-context filtering.

## Scope and behavior

This repair does not send customer messages and does not change the owner pause. It cannot stop Meta-hosted AI from replying; that account-level Business Agent must still be disabled in authenticated WhatsApp Business or Meta business tools. The bridge now prevents those external replies from contaminating APSales human-learning context.

## Validation

- Baseline hashes of the three production bridge files matched commit `421bdab190cc1759423e2e01b26a97a6441b5d01` before editing.
- `node --test tests/test_apsales_reply_control.mjs`: 11 passed, 0 failed.
- `node --check` passed for the bridge and visibility modules.

## Deployment and rollback

Deploy only with Release Manager target `apsales-openclaw`, which snapshots the installed extension files and records the release ID, hashes and restore command. Restart only `apsales-whatsapp-bridge.service`; verify the owner pause remains effective and do not send a customer test message.

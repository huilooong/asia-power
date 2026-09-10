# APSales WhatsApp conversation scope repair

## Purpose

Prevent a verified private school conversation from being reopened as a sales enquiry when a later message is only a greeting or acknowledgement. Preserve the ability to enter the normal sales flow when the same contact later states an explicit vehicle or parts need.

## Files added

- `customer_gateway/ai_reply_control.py`
- `deploy/apsales-live-draft/apsales-human-takeover.mjs`
- `deploy/apsales-live-draft/apsales-reply-control.mjs`
- `deploy/apsales-live-draft/apsales-turn-policy.mjs`
- `scripts/apsales-ai-control.py`
- `tests/test_ai_reply_control.py`
- `tests/test_apsales_reply_control.mjs`

## Files modified

- `deploy/apsales-live-draft/bridge.mjs`
- `deploy/apsales-live-draft/apsales-whatsapp-session.mjs`
- `docs/zijing-training/LIVE-RULES.md`
- `sales_coach/detectors.py`
- `scripts/deploy-production.mjs`
- `scripts/lib/release-manager.mjs`

## Deployment impact

The WhatsApp bridge stores `conversation_scope` in the existing per-contact deal-state JSON. An explicit non-business message sets the scope to `non_business`; later greetings, acknowledgements, and unknown messages are retained without an automatic reply. Explicit business intent changes the scope to `business` and restores normal routing. Existing manual takeover controls continue to block all automatic sends for a paused contact.

The `apsales-openclaw` Release Manager target now ships, snapshots, syntax-checks, and validates the reply-control, human-takeover, turn-policy, and Python control modules that the bridge imports.

## Rollback impact

Release Manager snapshots every changed production path before deployment. Restore with `RESTORE_CONFIRM=<release-id> node scripts/release-restore.mjs <release-id>`. The deploy target also keeps a timestamped bridge backup under `/root/.openclaw/releases/apsales-openclaw-*`.

## Validation

- Node syntax checks for the bridge, session, policy, takeover, reply control, deployment script, and Release Manager.
- Python compilation for the classifier and reply-control modules.
- Regression sequence: school update -> non-business scope; later `Hi Sir` -> retain only; later `Need engine` -> business routing.
- Reply-control tests cover persisted pauses, restart behavior, final transport send checks, corrupt-state fail-closed behavior, and delayed human-device synchronization.
- Production validation checks the running systemd bridge process and live module syntax after deployment.

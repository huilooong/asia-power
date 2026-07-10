# Cursor Command

Status: active - GROWTH-001 field execution plan requested
Commander: Kongming / OpenClaw brain
Project root: `/Users/longhui/Desktop/AsiaPower`

## Standing Instructions

1. Read this file before starting any AsiaPower task.
2. Read `docs/agent-commands/README.md`.
3. Check `git status --short` before editing.
4. Do not revert or overwrite unrelated work.
5. Keep UI and frontend work consistent with existing AsiaPower pages.
6. For visual/UI changes, report affected pages and screenshots if available.
7. After work, write a concise report to `docs/agent-reports/cursor-latest.md`.

## Current Project Context

The latest CTO status files say AsiaPower already has many production-facing pages, admin tools, sales/runtime modules, and deployment docs.

Cursor should be especially careful with broad frontend edits because the repo has known production regression history under:

- `docs/cto/incident-001-homepage-regression.md`
- `docs/cto/incident-002-mass-regression.md`
- `docs/cto/ops-005-release-manager.md`

## Current Task

Objective: create a field execution plan for GROWTH-001.

Requested: 2026-07-05, Africa/Accra

Scope:

- Do not start new feature work for this task.
- Do not send outreach, WhatsApp messages, emails, DMs, or social posts.
- Read `docs/agent-commands/growth-001-global-scrap-parts-traffic.md`.
- Use the existing APBD outreach queue and website assets to propose the fastest safe way to get relevant buyers to visit `asia-power.com`.
- Focus on real buyer channels: dismantlers, scrap yards, parts dealers, repair workshops, importers, wholesalers, especially Africa.

Required checks:

1. Read `docs/agents/apbd/sprint-001-real-customer-discovery.md`.
2. Read `docs/agents/apbd/audit-001-reality-verification.md`.
3. Inspect `runtime/apbd/2026-07-05/outreach_queue/summary.json`.
4. Sample `runtime/apbd/2026-07-05/outreach_queue/outreach-queue.json`.
5. Review relevant website entry pages: engines, half-cuts, gearboxes, trucks, contact.
6. Run `git status --short` only to understand dirty state.

Report path:

- Write the result to `docs/agent-reports/cursor-growth-001-field-plan.md`.
- Also update `docs/agent-reports/cursor-latest.md` with a short pointer to that plan.

Acceptance criteria:

- Segment the 46 existing APBD leads into useful outreach groups.
- Recommend which website pages each group should be sent to.
- Propose safe outreach copy angles, but do not send anything.
- Propose directory/marketplace/social/community channels to test.
- Identify missing landing pages or CTA fixes.
- Define a daily field workflow agents can repeat.
- Define what data must be captured to know if traffic is working.
- Include risks and what needs CEO approval.

## Required Report Format

Write to `docs/agent-reports/cursor-latest.md`:

```markdown
# Cursor Report

Generated: YYYY-MM-DD HH:MM TZ

## Task

## Files Reviewed

## Files Changed

## Visual / UX Notes

## Commands Run

## Tests / Validation

## Result

## Risks / Open Questions

## Recommended Next Action
```

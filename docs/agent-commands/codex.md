# Codex Command

Status: active - GROWTH-001 strategy requested
Commander: Kongming / OpenClaw brain
Project root: `/Users/longhui/Desktop/AsiaPower`

## Standing Instructions

1. Read this file before starting any AsiaPower task.
2. Read `docs/agent-commands/README.md`.
3. Check `git status --short` before editing.
4. Do not revert or overwrite unrelated work.
5. Prefer narrow, verifiable changes over broad rewrites.
6. For production-impacting work, read the relevant CTO docs first.
7. After work, write a concise report to `docs/agent-reports/codex-latest.md`.

## Current Project Context

The latest CTO status files say the project already has active APCOO, APSales, and APInventory systems, plus partial APCGO, APBD, APSEO, and WhatsApp work.

The main risk is overlapping ownership, not lack of features. Before expanding runtime, clarify ownership boundaries for:

- APCGO vs APBD
- Opportunity vs GrowthOpportunity
- `runtime/` vs `apsales_runtime/`
- Knowledge Graph vs Growth Database
- markdown memory vs runtime MemoryStore
- approval gate vs approval routing

## Current Task

Objective: create a CTO-level agent operating plan for GROWTH-001.

Requested: 2026-07-05, Africa/Accra

Scope:

- Do not write production code for this task.
- Do not run outreach, deployment, Telegram bots, Facebook scripts, WhatsApp scripts, or email sending.
- Read `docs/agent-commands/growth-001-global-scrap-parts-traffic.md`.
- Use existing repository evidence and current CTO docs.
- Produce a practical operating plan for how AsiaPower agents should make the website visible to global used auto parts / scrap parts / dismantler / repair workshop buyers, especially Africa.

Required checks:

1. Read `docs/cto/project-status-scan.md`.
2. Read `docs/cto/project-status-summary.md`.
3. Read `docs/agents/apcgo/growth-playbook.md`.
4. Read `docs/product/seo/apseo-011-roadmap.md`.
5. Read APBD latest report or docs if needed.
6. Run `git status --short` only to understand current dirty state.

Report path:

- Write the result to `docs/agent-reports/codex-growth-001-plan.md`.
- Also update `docs/agent-reports/codex-latest.md` with a short pointer to that plan.

Acceptance criteria:

- Define agent ownership: APBD, APCGO, APSEO, APSales, APCOO.
- Propose a 7-day execution plan.
- Propose a 30-day execution plan.
- Identify quick wins using existing assets.
- Identify what requires CEO approval.
- Identify what must not be automated.
- Define KPIs: qualified visits, source, inquiries, approval queue, conversion.
- Point to exact repo files used as evidence.
- Include risks and recommended next decision for CEO.

## Required Report Format

Write to `docs/agent-reports/codex-latest.md`:

```markdown
# Codex Report

Generated: YYYY-MM-DD HH:MM TZ

## Task

## Files Reviewed

## Files Changed

## Commands Run

## Tests / Validation

## Result

## Risks / Open Questions

## Recommended Next Action
```

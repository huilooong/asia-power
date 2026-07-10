# Agent Command Board

Owner: Kongming / OpenClaw brain

Purpose: this folder is the single command board for human-operated or external agents working on AsiaPower.

Rules:

1. Agents must read their own command file before starting work:
   - Codex: `docs/agent-commands/codex.md`
   - Cursor: `docs/agent-commands/cursor.md`
2. Agents must not rely on verbal context only. If a decision matters, write it down.
3. Agents must report results under `docs/agent-reports/`.
4. Before touching production-impacting files, agents must check existing CTO docs and mention the exact files reviewed.
5. Do not overwrite unrelated dirty work. The repo can contain active work from other agents.
6. Reports must include files changed, tests run, risks, and next recommended action.
7. Kongming reads these files as the coordination source of truth.

Standard report locations:

- Latest Codex report: `docs/agent-reports/codex-latest.md`
- Latest Cursor report: `docs/agent-reports/cursor-latest.md`
- Task reports archive: `docs/agent-reports/inbox/YYYYMMDD-HHMM-agent-task.md`

Current CTO baseline:

- `docs/cto/project-status-scan.md`
- `docs/cto/project-status-summary.md`


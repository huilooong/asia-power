# APBD Runtime MVP — Delivery Report

**Task:** APBD-001 Runtime MVP  
**Status:** Implemented and runnable  
**Date:** 2026-07-05

---

## Implemented Modules

| Module | Path | Purpose |
|--------|------|---------|
| Package init | `agents/apbd/__init__.py` | Public exports |
| Runtime loop | `agents/apbd/runtime.py` | Load config → run tasks → summary → wait approval |
| Scheduler | `agents/apbd/scheduler.py` | Manual / run_once / daily (placeholder) |
| Task queue | `agents/apbd/task_queue.py` | Daily task objects on filesystem |
| State | `agents/apbd/state.py` | Idle / Running / Waiting Approval / Completed / Error |
| Tools | `agents/apbd/tools.py` | Interface stubs only (`run`, `status`, `result`) |
| Models | `agents/apbd/models.py` | Task, DailySummary, enums |
| Config | `agents/apbd/config.py` | Default task list + paths |
| README | `agents/apbd/README.md` | Operator quick start |
| CLI wiring | `coo_core/cli_router.py`, `main.py` | `/apbd start|status|stop` |

---

## Runtime Flow

```text
/apbd start
  ↓
Load configuration (agents/apbd/config.py)
  ↓
Load today's task list (or bootstrap 5 default tasks)
  ↓
For each pending task:
  Running {ToolName}
  tool.run(payload)          # stub only
  Save result → results/{task_id}.json
  Completed
  ↓
Write summary.json
  ↓
State → waiting_approval
  ↓
Log: Waiting for approval
```

**States:** `idle` → `running` → `waiting_approval` (success) or `error` (failure)

---

## Directory Structure

### Code (relative → absolute)

| Relative | Absolute |
|----------|----------|
| `agents/apbd/` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/` |
| `runtime/apbd/` | `/Users/longhui/Desktop/AsiaPower/runtime/apbd/` |
| `main.py` | `/Users/longhui/Desktop/AsiaPower/main.py` |

### Runtime output tree (after `/apbd start`)

```text
runtime/apbd/
├── state.json
└── YYYY-MM-DD/
    ├── logs/
    │   └── runtime.log
    ├── results/
    │   └── apbd-{id}.json
    ├── tasks/
    │   └── apbd-{id}.json
    ├── tasks.jsonl
    └── summary.json
```

Example (2026-07-05 run):

```text
runtime/apbd/
├── state.json
└── 2026-07-05/
    ├── logs/runtime.log
    ├── results/          (5 task result files)
    ├── tasks/            (5 task state files)
    ├── tasks.jsonl
    └── summary.json
```

---

## CLI Commands

```bash
python main.py "/apbd start"
python main.py "/apbd status"
python main.py "/apbd stop"
```

---

## Tool Interfaces (stubs)

| Tool | Artifact type |
|------|---------------|
| `LeadFinderTool` | leads |
| `KeywordFinderTool` | keywords |
| `CompetitorTool` | competitors |
| `ContentPlannerTool` | content_plan |
| `DistributionTool` | distribution |

No external APIs, scraping, or business logic in this sprint.

---

## Scheduler Modes

| Mode | MVP |
|------|-----|
| `manual` | Default — CEO runs `/apbd start` |
| `run_once` | Same execution path |
| `daily` | Documented only — future cron/launchd hook |

Env override: `APBD_SCHEDULE_MODE=manual|run_once|daily`

---

## Future Extension Points

| Area | Extension |
|------|-----------|
| **Tools** | Replace stub `run()` with real lead/SEO/competitor logic |
| **Scheduler** | Wire `daily` mode to launchd/cron calling `/apbd start` |
| **Approval** | `/apbd approve` → move state to `completed`, notify CEO dashboard |
| **Task source** | Load tasks from YAML/market config instead of hardcoded list |
| **Persistence** | Optional DB; keep filesystem audit trail |
| **Integration** | Feed qualified leads into APSales `InquiryReceived` path (APSALES-102) |
| **Telegram** | Mirror CLI commands in bot handler |

---

## Lessons Learned

1. **Runtime before intelligence** — A working daily loop with stub tools proves the operating model (execute → store → approve) before investing in scraping/APIs.
2. **Filesystem-first** — Daily folders (`YYYY-MM-DD/`) give CEO-visible artifacts without a database.
3. **Single CLI entry** — Reusing `main.py` + `cli_router` keeps APBD consistent with APSales/APInventory.
4. **State merge matters** — Partial state updates must merge with existing `state.json`, not reset to defaults (fixed in MVP).
5. **Approval gate** — Ending in `waiting_approval` enforces human review before any future auto-publish actions.

---

## Verification

```bash
.venv/bin/python3 main.py "/apbd start"
.venv/bin/python3 main.py "/apbd status"
```

Expected: 5 tasks completed, `phase=waiting_approval`, files under `runtime/apbd/YYYY-MM-DD/`.

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/runtime-mvp.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/runtime-mvp.md` |

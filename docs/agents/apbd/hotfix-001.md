# APBD-HOTFIX-001 — Task Order & Config Sync

**Date:** 2026-07-05  
**Overall Result:** **PASS**

---

## Scope

Two blocking fixes from APBD-TEST-001. No new features, tools, or business logic changes.

---

## Fix 1 — Task Execution Order

**Problem:** Tasks ran in filesystem/glob order when `created_at` timestamps were identical.

**Change:**

| File | Change |
|------|--------|
| `agents/apbd/config.py` | Added `task_tool_order()` — maps `tool_name` → config spec index |
| `agents/apbd/task_queue.py` | `load_all()` and `next_pending()` sort by config tool order, not filesystem |

**Deterministic order:**

```text
LeadFinderTool → KeywordFinderTool → CompetitorTool → MissionPlannerTool → (stubs)
```

---

## Fix 2 — Task Synchronization

**Problem:** Task queue bootstrapped before `MissionPlannerTool` was added never picked up new config tools without manual reset.

**Change:**

| File | Change |
|------|--------|
| `agents/apbd/task_queue.py` | Added `sync_with_specs()` — merges config specs with existing tasks by `tool_name`; creates missing tasks as `pending` |
| `agents/apbd/runtime.py` | `start()` always calls `sync_with_specs()` before task loop |

Missing tools are appended to the queue automatically; existing task state (completed/pending) is preserved.

---

## Verification

**Command:**

```bash
python main.py "/apbd start"
```

**Pre-test simulation (no manual queue reset):**

- Deleted `MissionPlannerTool` task file to simulate stale queue
- Reset other tasks to `pending` to observe execution order

**Runtime log (2026-07-05 06:39 UTC):**

```text
Task sync: added 1 task(s) from config
Task list ready (6 tasks)
Running LeadFinderTool
Running KeywordFinderTool
Running CompetitorTool
Running MissionPlannerTool
Running ContentPlannerTool
Running DistributionTool
Waiting for approval
```

**State:** `phase=waiting_approval`  
**Tasks:** 6/6 completed, 0 failed

---

## Files Modified

- `agents/apbd/config.py`
- `agents/apbd/task_queue.py`
- `agents/apbd/runtime.py`

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/hotfix-001.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/hotfix-001.md` |

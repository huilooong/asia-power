# APBD-RUNNER-001 — Continuous Business Development Loop

**Task:** APBD-RUNNER-001  
**Date:** 2026-07-05  
**Overall Result:** **PASS**

---

## Mission

APBD runs continuously as a 24/7 employee: discover → analyze → plan → queue content → sleep → repeat.

No browser, publishing, deployment, outreach, or website modification.

---

## Implemented Files

| Relative | Absolute |
|----------|----------|
| `agents/apbd/runner.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/runner.py` |
| `agents/apbd/mission_planner.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/mission_planner.py` (content queue generation) |
| `agents/apbd/runtime.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/runtime.py` (`/apbd run`, `/apbd once`, `/apbd stop`) |
| `agents/apbd/config.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/config.py` (runner interval config) |
| `agents/apbd/models.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/models.py` (`SLEEPING` phase) |
| `agents/apbd/state.py` | `/Users/longhui/Desktop/AsiaPower/agents/apbd/state.py` (runner state fields) |

---

## Execution Loop

```text
Start
  ↓
LeadFinder
  ↓
KeywordFinder
  ↓
CompetitorFinder
  ↓
MissionPlanner
  ↓
Generate Executive Plan
  ↓
Generate Content Queue
  ↓
Sleep (configurable, default 6 hours)
  ↓
Repeat   (continuous mode only)
```

---

## CLI

```bash
python main.py "/apbd once"    # single cycle
python main.py "/apbd run"     # continuous loop
python main.py "/apbd stop"    # stop between steps or during sleep
python main.py "/apbd status"  # show phase / runner state
```

### Interval configuration

| Setting | Default | Override |
|---------|---------|----------|
| Loop interval | 6 hours (21600s) | `APBD_RUNNER_INTERVAL_SECONDS=3600` |
| Sleep polling | 30s chunks | `config.runner.sleep_chunk_seconds` |

---

## Content Queue

Generated automatically by MissionPlanner after executive plan.

**Path:** `runtime/apbd/YYYY-MM-DD/content_queue/`

| File | Purpose |
|------|---------|
| `content-queue.json` | Structured tasks for Content Agent |
| `content-queue.csv` | CEO / ops review |
| `summary.json` | Counts by priority |

Each task includes:

- Keyword
- Target Page
- Search Intent
- Buyer Intent
- Business Reason
- Priority
- Suggested URL
- Recommended Internal Links
- CTA
- Evidence

---

## Runtime States

| Phase | Meaning |
|-------|---------|
| `running` | Cycle in progress |
| `waiting_approval` | Cycle complete — review outputs |
| `sleeping` | Continuous mode — waiting for next cycle |
| `idle` | Stopped |
| `error` | Step failed |

State file: `runtime/apbd/state.json`  
Runner log: `runtime/apbd/YYYY-MM-DD/logs/runner.log`

---

## Verification

**Command:**

```bash
python main.py "/apbd once"
```

**Runner log (2026-07-05 06:52 UTC):**

```text
Running LeadFinder
Completed LeadFinder
Running KeywordFinder
Completed KeywordFinder
Running CompetitorFinder
Completed CompetitorFinder
Running MissionPlanner
Completed MissionPlanner
Generate Executive Plan
Generate Content Queue
Cycle complete — waiting approval
```

**Result:**

| Check | Status |
|-------|--------|
| Loop order correct | ✓ |
| Executive plan path written | ✓ |
| Content queue directory created | ✓ |
| Phase `waiting_approval` | ✓ |
| No browser | ✓ |
| CLI `/apbd once` | ✓ |

**Note:** Second same-day run may produce 0 new keywords/competitors due to cross-run dedup in discovery tools (existing behaviour). Runner and content queue infrastructure still operate correctly.

---

## Runtime Tree (after `/apbd once`)

```text
runtime/apbd/YYYY-MM-DD/
├── leads/
├── keywords/
├── competitors/
├── missions/
│   └── executive-plan.md
├── content_queue/
│   ├── content-queue.json
│   ├── content-queue.csv
│   └── summary.json
├── logs/
│   └── runner.log
└── summary.json
```

---

## Safety

- `assert_apbd_no_browser_ui()` at cycle entry
- Discovery tools unchanged (API / local / HTTP only)
- Content queue is work instructions only — no auto publish

---

## Report Path

| | Path |
|---|------|
| **Relative** | `docs/agents/apbd/apbd-runner.md` |
| **Absolute** | `/Users/longhui/Desktop/AsiaPower/docs/agents/apbd/apbd-runner.md` |

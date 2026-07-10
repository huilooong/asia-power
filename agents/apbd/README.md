# APBD Runtime MVP

AI Business Development employee — **runtime only** (no scraping, no external APIs).

## Quick start

```bash
python main.py "/apbd start"
python main.py "/apbd status"
python main.py "/apbd stop"
```

## Output

Each run writes to:

```
runtime/apbd/YYYY-MM-DD/
  logs/runtime.log
  results/{task_id}.json
  tasks/{task_id}.json
  summary.json
```

Global state: `runtime/apbd/state.json`

## Tools (stubs)

- `LeadFinderTool`
- `KeywordFinderTool`
- `CompetitorTool`
- `ContentPlannerTool`
- `DistributionTool`

Each exposes `run()`, `status()`, `result()` — business logic comes later.

## Schedule modes

| Mode | MVP |
|------|-----|
| `manual` | Default — CEO runs `/apbd start` |
| `run_once` | Same as manual |
| `daily` | Architecture placeholder only |

Set `APBD_SCHEDULE_MODE=run_once|manual|daily` to override.

## Docs

See `docs/agents/apbd/runtime-mvp.md`.

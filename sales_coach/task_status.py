"""Explicit progress receipts. No execution or deployment is implied by a plan file."""
import json
from datetime import datetime, timezone
from pathlib import Path

STAGES = ("detected", "triaged", "assigned", "implemented", "tested", "approved", "deployed", "verified")
REQUIRED = {"triaged": "triage_note", "assigned": "owner", "implemented": "commit", "tested": "test_report", "approved": "approval_id", "deployed": "release_id", "verified": "verification_report"}


def advance_task(task_path: Path, stage: str, **receipt) -> dict:
    task = json.loads(task_path.read_text())
    current = task.get("status", "detected")
    if stage not in STAGES or STAGES.index(stage) != STAGES.index(current) + 1:
        raise ValueError("Only one verified workflow step at a time")
    if not str(receipt.get(REQUIRED[stage]) or "").strip():
        raise ValueError(f"Missing receipt: {REQUIRED[stage]}")
    task.update(receipt)
    task["status"] = stage
    task.setdefault("receipts", []).append({"stage": stage, "at": datetime.now(timezone.utc).isoformat(), **receipt})
    task_path.write_text(json.dumps(task, ensure_ascii=False, indent=2))
    return task
